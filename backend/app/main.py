from __future__ import annotations

from pathlib import Path
import json
import shutil
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import (
    FEATURES,
    MODEL_CANDIDATES,
    ORGANIZATIONS,
    RULE_CANDIDATES,
    SCALER_CANDIDATES,
    UPLOADS_DIR,
)
from .engine import analyze_uploads
from .model_service import load_model_bundle
from .rule_service import RuleService
from .research_analysis import RESEARCH_ANALYSIS


def _json_safe(value):
    import math
    import numpy as np
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [_json_safe(v) for v in value]
    if isinstance(value, (float, np.floating)):
        x = float(value)
        return x if math.isfinite(x) else None
    if isinstance(value, (int, np.integer)):
        return int(value)
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    return value


app = FastAPI(title="FedReason Local Demo API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_ORGS = set(ORGANIZATIONS)
ALLOWED_EXTENSIONS = {".csv", ".pcap", ".pcapng"}


@app.get("/api/health")
def health():
    model_ok = any(p.exists() for p in MODEL_CANDIDATES)
    scaler_ok = any(p.exists() for p in SCALER_CANDIDATES)
    rule_ok = any(p.exists() for p in RULE_CANDIDATES)
    return {
        "status": "ok" if model_ok and scaler_ok else "degraded",
        "model_found": model_ok,
        "scaler_found": scaler_ok,
        "phase3_rules_found": rule_ok,
        "features": FEATURES,
        "organizations": ORGANIZATIONS,
    }


@app.get("/api/config")
def get_config():
    rule_service = RuleService()
    return {
        "features": FEATURES,
        "organizations": ORGANIZATIONS,
        "locked_active_rule_ids": ["FSRA_RULE_002", "FSRA_RULE_011", "FSRA_RULE_018"],
        "rule_source": rule_service.source_label,
        "rule_count": len(rule_service.rules),
        "upload_extensions": sorted(ALLOWED_EXTENSIONS),
        "model_candidates": [str(p) for p in MODEL_CANDIDATES],
        "scaler_candidates": [str(p) for p in SCALER_CANDIDATES],
    }


@app.post("/api/upload")
async def upload_file(
    organization: str = Form(...),
    file: UploadFile = File(...),
):
    if organization not in ALLOWED_ORGS:
        raise HTTPException(status_code=400, detail=f"Unknown organization: {organization}")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Upload CSV, PCAP, or PCAPNG files only.")

    org_dir = UPLOADS_DIR / organization
    org_dir.mkdir(parents=True, exist_ok=True)
    # Keep the user-facing name but prevent path traversal.
    safe_name = Path(file.filename or "upload.csv").name
    target = org_dir / safe_name
    with target.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if ext in {".pcap", ".pcapng"}:
        return {
            "organization": organization,
            "filename": safe_name,
            "file_type": ext[1:].upper(),
            "rows": 0,
            "valid_rows": 0,
            "invalid_rows": 0,
            "status": "UPLOADED_PENDING_EXTRACTION",
            "message": "PCAP uploaded successfully. The local demo does not include a packet-to-flow extractor; use CSV for live inference.",
        }

    try:
        import pandas as pd
        df = pd.read_csv(target)
        missing = [f for f in FEATURES if f not in df.columns]
        valid = 0
        invalid = len(df)
        if not missing:
            import numpy as np
            vals = df[FEATURES].apply(pd.to_numeric, errors="coerce").replace([np.inf, -np.inf], np.nan)
            mask = ~vals.isna().any(axis=1)
            valid = int(mask.sum())
            invalid = int((~mask).sum())
        else:
            return {
                "organization": organization,
                "filename": safe_name,
                "file_type": "CSV",
                "rows": int(len(df)),
                "valid_rows": 0,
                "invalid_rows": int(len(df)),
                "status": "INVALID_SCHEMA",
                "message": "Missing required FedReason feature columns: " + ", ".join(missing),
            }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not validate CSV: {exc}")

    return {
        "organization": organization,
        "filename": safe_name,
        "file_type": "CSV",
        "rows": int(len(df)),
        "valid_rows": valid,
        "invalid_rows": invalid,
        "status": "UPLOADED",
        "message": f"CSV accepted: {valid:,} valid model-ready rows.",
    }


@app.delete("/api/uploads/{organization}")
def clear_organization(organization: str):
    if organization not in ALLOWED_ORGS:
        raise HTTPException(status_code=400, detail="Unknown organization")
    org_dir = UPLOADS_DIR / organization
    if org_dir.exists():
        shutil.rmtree(org_dir)
    return {"status": "cleared", "organization": organization}


@app.get("/api/research-analysis")
def research_analysis():
    """Return frozen Phase 1–6 research metrics for the frontend analysis dashboard."""
    return _json_safe(RESEARCH_ANALYSIS)


@app.post("/api/run")
def run_fedreason():
    try:
        return _json_safe(analyze_uploads())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"FedReason run failed: {exc}")


@app.get("/api/runs/latest")
def latest_run():
    latest = Path(__file__).resolve().parents[2] / "runtime" / "analysis" / "latest.json"
    if not latest.exists():
        raise HTTPException(status_code=404, detail="No run has been completed yet.")
    return json.loads(latest.read_text(encoding="utf-8"))
