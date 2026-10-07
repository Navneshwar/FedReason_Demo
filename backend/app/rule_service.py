from __future__ import annotations

from pathlib import Path
import json
import math
from typing import Any

import numpy as np

from .config import (
    FEATURES,
    LOCKED_ACTIVE_RULE_IDS,
    MITRE_FALLBACK,
    PHASE4_ALERT_CANDIDATES,
    RULE_CANDIDATES,
)


def _json_clean(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _json_clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_clean(v) for v in value]
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def _first_existing(candidates: list[Path]) -> Path | None:
    return next((p for p in candidates if p.exists()), None)


def _extract_rule_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("rules"), list):
        return payload["rules"]
    return []


def _normalise_rule(rule: dict[str, Any]) -> dict[str, Any]:
    return {
        "fsra_rule_id": str(rule.get("fsra_rule_id") or rule.get("rule_id")),
        "target_class": int(rule.get("target_class", 0)),
        "conditions": rule.get("conditions") or {},
        "corroborating_orgs": list(rule.get("corroborating_orgs") or []),
        "corroborating_org_count": int(rule.get("corroborating_org_count", len(rule.get("corroborating_orgs") or []))),
        "aggregated_confidence_score": float(rule.get("aggregated_confidence_score", rule.get("fused_precision", 0.0)) or 0.0),
        "fused_precision": float(rule.get("fused_precision", 0.0) or 0.0),
        "candidate_attack_family": rule.get("candidate_attack_family"),
        "candidate_mitre_id": rule.get("candidate_mitre_id"),
        "candidate_mitre_technique": rule.get("candidate_mitre_technique"),
        "source_rule_ids": list(rule.get("source_rule_ids") or []),
        "mapping_source_label": rule.get("mapping_source_label"),
    }


def _fallback_rules_from_phase4(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    seen: dict[str, dict[str, Any]] = {}
    for alert in payload if isinstance(payload, list) else []:
        triggered = alert.get("triggered_fsra_rule") or {}
        rid = triggered.get("fsra_rule_id")
        if rid not in LOCKED_ACTIVE_RULE_IDS or rid in seen:
            continue
        conditions: dict[str, dict[str, Any]] = {}
        for cond in triggered.get("conditions_satisfied") or []:
            feature = cond.get("feature")
            if feature in FEATURES:
                conditions[feature] = {
                    "min": cond.get("min", -math.inf),
                    "max": cond.get("max", math.inf),
                }
        threat = alert.get("threat_intelligence") or {}
        seen[rid] = {
            "fsra_rule_id": rid,
            "target_class": 1,
            "conditions": conditions,
            "corroborating_orgs": list(triggered.get("corroborating_orgs") or []),
            "corroborating_org_count": int(triggered.get("corroborating_org_count", 0) or 0),
            "aggregated_confidence_score": float(alert.get("confidence_score", 0.0) or 0.0),
            "fused_precision": float(alert.get("fused_precision", 0.0) or 0.0),
            "candidate_attack_family": threat.get("attack_family"),
            "candidate_mitre_id": threat.get("mitre_technique_id"),
            "candidate_mitre_technique": threat.get("mitre_technique_name"),
            "source_rule_ids": [
                x.get("local_rule_id")
                for x in (alert.get("federated_lineage_trace") or {}).get("contributing_local_rules", [])
                if x.get("local_rule_id")
            ],
            "mapping_source_label": "Phase 4 demo fallback",
        }
    return list(seen.values())


class RuleService:
    def __init__(self):
        self.source_path: Path | None = None
        self.source_label = "Unavailable"
        self.rules: list[dict[str, Any]] = []
        self._load()

    def _load(self):
        phase3 = _first_existing(RULE_CANDIDATES)
        if phase3:
            payload = json.loads(phase3.read_text(encoding="utf-8"))
            all_rules = [_normalise_rule(r) for r in _extract_rule_list(payload)]
            rules = [r for r in all_rules if r["fsra_rule_id"] in LOCKED_ACTIVE_RULE_IDS and r["target_class"] == 1]
            if rules:
                self.source_path = phase3
                self.source_label = "Frozen Phase 3 FSRA rule artifact"
                self.rules = rules
                return

        phase4 = _first_existing(PHASE4_ALERT_CANDIDATES)
        if phase4:
            self.source_path = phase4
            self.source_label = "Phase 4 validation-alert fallback (demo only)"
            self.rules = _fallback_rules_from_phase4(phase4)
            return

        self.source_label = "No FSRA rule artifact found"
        self.rules = []

    def reload(self):
        self._load()

    @staticmethod
    def _condition_satisfied(value: float, bounds: dict[str, Any]) -> bool:
        lo = bounds.get("min", -math.inf)
        hi = bounds.get("max", math.inf)
        lo = -math.inf if lo is None else float(lo)
        hi = math.inf if hi is None else float(hi)
        # Phase 3 build_rule_mask semantics: value > min and value <= max.
        return (value > lo) and (value <= hi)

    def match(self, scaled_row: np.ndarray) -> list[dict[str, Any]]:
        if scaled_row.size != len(FEATURES):
            raise ValueError(f"Expected {len(FEATURES)} scaled features, got {scaled_row.size}.")
        feature_values = dict(zip(FEATURES, scaled_row.astype(float)))
        hits = []
        for rule in self.rules:
            conditions = rule.get("conditions") or {}
            results = []
            all_ok = True
            for feature, bounds in conditions.items():
                if feature not in feature_values:
                    all_ok = False
                    break
                value = float(feature_values[feature])
                ok = self._condition_satisfied(value, bounds)
                raw_min = bounds.get("min")
                raw_max = bounds.get("max")
                safe_min = None if raw_min is None or not np.isfinite(float(raw_min)) else float(raw_min)
                safe_max = None if raw_max is None or not np.isfinite(float(raw_max)) else float(raw_max)
                results.append({
                    "feature": feature,
                    "value": value,
                    "min": safe_min,
                    "max": safe_max,
                    "satisfied": ok,
                })
                if not ok:
                    all_ok = False
            if all_ok:
                hits.append({**rule, "conditions_satisfied": results})
        return hits

    def enrich_threat_intel(self, rule: dict[str, Any]) -> dict[str, Any]:
        rid = rule["fsra_rule_id"]
        fallback = MITRE_FALLBACK.get(rid, {})
        mitre_id = rule.get("candidate_mitre_id") or fallback.get("mitre_id")
        technique = rule.get("candidate_mitre_technique") or fallback.get("technique")
        family = rule.get("candidate_attack_family") or fallback.get("family")
        playbook = dict(fallback.get("playbook") or {})
        return {
            "mitre_id": mitre_id,
            "technique": technique,
            "family": family,
            "playbook": playbook or None,
        }
