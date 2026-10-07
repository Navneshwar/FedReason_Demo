from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .config import (
    ANALYSIS_DIR,
    FEATURES,
    LOCKED_ACTIVE_RULE_IDS,
    ORGANIZATIONS,
    UPLOADS_DIR,
)
from .model_service import load_model_bundle, score_frame
from .rule_service import RuleService


def _json_safe(value: Any) -> Any:
    """Recursively convert NaN/Infinity into JSON-safe values."""
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [_json_safe(v) for v in value]
    if isinstance(value, (np.floating, float)):
        x = float(value)
        return x if np.isfinite(x) else None
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    return value


def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path)


def _safe_float(value: Any) -> float:
    try:
        x = float(value)
        if not np.isfinite(x):
            return 0.0
        return x
    except Exception:
        return 0.0


def _severity(rule: dict[str, Any] | None, neural_score: float) -> str:
    if rule:
        rid = rule.get("fsra_rule_id")
        corr = int(rule.get("corroborating_org_count", 0) or 0)
        confidence = max(
            float(rule.get("aggregated_confidence_score", 0.0) or 0.0),
            float(rule.get("fused_precision", 0.0) or 0.0),
        )
        if rid == "FSRA_RULE_002" or corr >= 3 or confidence >= 0.90:
            return "HIGH"
        if confidence >= 0.70:
            return "MEDIUM"
        return "LOW"
    if neural_score >= 0.80:
        return "HIGH"
    if neural_score >= 0.65:
        return "MEDIUM"
    return "LOW"


def _consensus_tier(rule: dict[str, Any] | None) -> str | None:
    if not rule:
        return None
    corr = int(rule.get("corroborating_org_count", 0) or 0)
    if corr >= 3:
        return "Tier 1: Global Multi-Silo Consensus (3 Organizations)"
    if corr == 2:
        return "Tier 2: Cross-Silo Corroboration (2 Organizations)"
    return "Tier 3: Single-Silo Localized Consensus (1 Organization)"


def analyze_uploads(organization_ids: list[str] | None = None) -> dict[str, Any]:
    organization_ids = organization_ids or list(ORGANIZATIONS)
    bundle = load_model_bundle()
    rules = RuleService()
    run_id = f"RUN-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:6].upper()}"

    alerts: list[dict[str, Any]] = []
    per_org: list[dict[str, Any]] = []
    warnings: list[str] = []
    counters = Counter()
    total_flows = 0

    for org_id in organization_ids:
        meta = ORGANIZATIONS[org_id]
        org_dir = UPLOADS_DIR / org_id
        files = sorted(org_dir.glob("*.csv"))
        if not files:
            per_org.append({
                "organization_id": org_id,
                "organization_name": meta["display_name"],
                "dataset": meta["dataset"],
                "status": "NO_DATA",
                "files": [],
                "flows": 0,
                "alerts": 0,
            })
            continue

        frames = []
        source_names = []
        for path in files:
            try:
                df = _read_csv(path)
            except Exception as exc:
                warnings.append(f"{org_id}: could not read {path.name}: {exc}")
                continue
            missing = [f for f in FEATURES if f not in df.columns]
            if missing:
                warnings.append(f"{org_id}/{path.name}: missing required feature columns: {', '.join(missing)}")
                continue
            df = df.copy()
            df["_source_filename"] = path.name
            frames.append(df)
            source_names.append(path.name)

        if not frames:
            per_org.append({
                "organization_id": org_id,
                "organization_name": meta["display_name"],
                "dataset": meta["dataset"],
                "status": "INVALID_DATA",
                "files": source_names,
                "flows": 0,
                "alerts": 0,
            })
            continue

        frame = pd.concat(frames, ignore_index=True)
        scores, neural_flags, scaled, valid_mask = score_frame(bundle, frame)
        invalid_count = int((~valid_mask).sum())
        org_alerts = 0
        org_fsra = 0
        org_neural_only = 0
        rule_counts: Counter[str] = Counter()

        valid_indices = np.flatnonzero(valid_mask)
        scaled_index = 0
        for idx in range(len(frame)):
            if not valid_mask[idx]:
                continue
            row_scaled = scaled[scaled_index]
            scaled_index += 1
            hits = rules.match(row_scaled)
            best_rule = None
            if hits:
                # Prefer the rule with strongest corroboration, then fused precision, then stable ID.
                hits = sorted(
                    hits,
                    key=lambda r: (
                        int(r.get("corroborating_org_count", 0) or 0),
                        float(r.get("fused_precision", 0.0) or 0.0),
                        r.get("fsra_rule_id", ""),
                    ),
                    reverse=True,
                )
                best_rule = hits[0]

            neural_flag = bool(neural_flags[idx])
            fsra_flag = best_rule is not None
            fired = neural_flag or fsra_flag
            if not fired:
                continue

            neural_score = _safe_float(scores[idx])
            severity = _severity(best_rule, neural_score)
            threat = rules.enrich_threat_intel(best_rule) if best_rule else {}
            contributing_orgs = list(best_rule.get("corroborating_orgs") or []) if best_rule else []
            confidence = max(
                neural_score,
                float(best_rule.get("aggregated_confidence_score", 0.0) or 0.0) if best_rule else 0.0,
                float(best_rule.get("fused_precision", 0.0) or 0.0) if best_rule else 0.0,
            )
            confidence = float(min(1.0, max(0.0, confidence)))

            feature_snapshot = {
                feature: _safe_float(frame.iloc[idx][feature])
                for feature in FEATURES
            }
            notes = []
            if fsra_flag and contributing_orgs and org_id not in contributing_orgs:
                notes.append(
                    "Observed organization differs from the rule-contributing organization set; this is cross-organizational rule reuse, not a claim that the observed flow generated the contributing evidence."
                )
            if not fsra_flag and neural_flag:
                notes.append("Neural channel flagged this flow; no active FSRA rule matched the standardized feature vector.")
            if rules.source_label != "Frozen Phase 3 FSRA rule artifact":
                notes.append("FSRA rule matching is using the Phase 4 demo fallback because the frozen Phase 3 rule JSON was not found.")

            alert = {
                "alert_id": f"{run_id}-ALERT-{len(alerts)+1:03d}",
                "organization_id": org_id,
                "organization_name": meta["display_name"],
                "flow_index": idx,
                "verdict": "MALICIOUS ATTACK",
                "severity": severity,
                "neural_score": neural_score,
                "neural_flag": neural_flag,
                "fsra_flag": fsra_flag,
                "confidence_score": confidence,
                "fsra_rule_id": best_rule.get("fsra_rule_id") if best_rule else None,
                "mitre_id": threat.get("mitre_id") if best_rule else None,
                "mitre_technique": threat.get("technique") if best_rule else None,
                "attack_family": threat.get("family") if best_rule else None,
                "observed_organization": org_id,
                "contributing_organizations": contributing_orgs,
                "consensus_tier": _consensus_tier(best_rule),
                "conditions_satisfied": [
                    {k: v for k, v in condition.items() if k != "satisfied"}
                    for condition in (best_rule.get("conditions_satisfied") or [])
                    if condition.get("satisfied")
                ] if best_rule else [],
                "playbook": threat.get("playbook") if best_rule else None,
                "feature_snapshot": feature_snapshot,
                "source_filename": str(frame.iloc[idx].get("_source_filename", "unknown.csv")),
                "notes": notes,
            }
            alerts.append(alert)
            org_alerts += 1
            counters[severity] += 1
            if fsra_flag:
                org_fsra += 1
                rule_counts[best_rule["fsra_rule_id"]] += 1
            elif neural_flag:
                org_neural_only += 1

        per_org.append({
            "organization_id": org_id,
            "organization_name": meta["display_name"],
            "dataset": meta["dataset"],
            "type": meta["type"],
            "status": "OK",
            "files": source_names,
            "flows": int(len(frame)),
            "valid_rows": int(valid_mask.sum()),
            "invalid_rows": invalid_count,
            "alerts": org_alerts,
            "fsra_flags": org_fsra,
            "neural_only_flags": org_neural_only,
            "rules": dict(rule_counts),
        })
        total_flows += len(frame)

    malicious = len(alerts)
    summary = {
        "status": "COMPLETED",
        "run_id": run_id,
        "organizations": len([x for x in per_org if x.get("status") == "OK"]),
        "total_flows": total_flows,
        "malicious_flows": malicious,
        "neural_only_flags": sum(x.get("neural_only_flags", 0) for x in per_org),
        "fsra_flags": sum(x.get("fsra_flags", 0) for x in per_org),
        "alerts": len(alerts),
        "high_severity": counters.get("HIGH", 0),
        "medium_severity": counters.get("MEDIUM", 0),
        "low_severity": counters.get("LOW", 0),
        "rule_source": rules.source_label,
        "threshold": 0.50,
    }

    output = _json_safe({"summary": summary, "alerts": alerts, "per_organization": per_org, "warnings": warnings})
    serialized = json.dumps(output, indent=2, allow_nan=False)
    (ANALYSIS_DIR / f"{run_id}.json").write_text(serialized, encoding="utf-8")
    (ANALYSIS_DIR / "latest.json").write_text(serialized, encoding="utf-8")
    return output
