from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(os.getenv("FEDREASON_ROOT", Path(__file__).resolve().parents[2])).resolve()
MODELS_DIR = PROJECT_ROOT / "models"
RULES_DIR = PROJECT_ROOT / "rules"
RESULTS_DIR = PROJECT_ROOT / "results"
METADATA_DIR = PROJECT_ROOT / "metadata"
DEMO_DATA_DIR = PROJECT_ROOT / "demo_data"
RUNTIME_DIR = PROJECT_ROOT / "runtime"
UPLOADS_DIR = RUNTIME_DIR / "uploads"
ANALYSIS_DIR = RUNTIME_DIR / "analysis"

for _p in [MODELS_DIR, RULES_DIR, RESULTS_DIR, METADATA_DIR, DEMO_DATA_DIR, UPLOADS_DIR, ANALYSIS_DIR]:
    _p.mkdir(parents=True, exist_ok=True)

FEATURES = [
    "packet_rate",
    "total_packets",
    "header_length",
    "packet_size_min",
    "packet_size_max",
    "packet_size_mean",
    "packet_size_std",
    "fin_flag_ratio",
    "syn_flag_ratio",
    "psh_flag_ratio",
    "ack_flag_ratio",
    "ack_count",
    "syn_count",
    "fin_count",
]

ORGANIZATIONS = {
    "Org_A": {
        "display_name": "Organization A",
        "dataset": "CICIDS2017",
        "type": "Enterprise Network",
    },
    "Org_B": {
        "display_name": "Organization B",
        "dataset": "CIC_UNSW_NB15",
        "type": "Heterogeneous Metadata",
    },
    "Org_C": {
        "display_name": "Organization C",
        "dataset": "CICIoT2023",
        "type": "IoT/OT Traffic",
    },
}

LOCKED_ACTIVE_RULE_IDS = {
    "FSRA_RULE_002",
    "FSRA_RULE_011",
    "FSRA_RULE_018",
}

MODEL_CANDIDATES = [
    MODELS_DIR / "phase2_fedprox_mlp.joblib",
    PROJECT_ROOT / "models" / "phase2_fedprox_mlp.joblib",
]

SCALER_CANDIDATES = [
    MODELS_DIR / "phase1_standard_scaler.joblib",
    PROJECT_ROOT / "models" / "phase1_standard_scaler.joblib",
]

RULE_CANDIDATES = [
    MODELS_DIR / "phase3_aggregated_fsra_rules.json",
    RULES_DIR / "phase3_aggregated_fsra_rules.json",
]

PHASE4_ALERT_CANDIDATES = [
    RESULTS_DIR / "phase4_sample_generated_alerts.json",
    PROJECT_ROOT / "phase4_sample_generated_alerts.json",
]

MITRE_FALLBACK = {
    "FSRA_RULE_002": {
        "mitre_id": "T1498",
        "technique": "Network Denial of Service",
        "family": "DoS/DDoS",
        "playbook": {
            "id": "PB-DOS-01",
            "title": "Network Denial of Service Investigation",
            "tier": "Tier 1 — Traffic Containment",
            "action": "Rate-limit or isolate the affected source and inspect the traffic burst pattern and upstream telemetry.",
        },
    },
    "FSRA_RULE_011": {
        "mitre_id": "T1595",
        "technique": "Active Scanning",
        "family": "Reconnaissance",
        "playbook": {
            "id": "PB-RECON-01",
            "title": "Active Scanning Investigation",
            "tier": "Tier 2 — Reconnaissance Containment",
            "action": "Inspect scan targets, source distribution, exposed services, and apply containment or filtering where appropriate.",
        },
    },
    "FSRA_RULE_018": {
        "mitre_id": "T1190",
        "technique": "Exploit Public-Facing Application",
        "family": "Execution",
        "playbook": {
            "id": "PB-EXPLOIT-01",
            "title": "Exploit Public-Facing Service Investigation",
            "tier": "Tier 1 — Service Isolation",
            "action": "Inspect the exposed service, isolate the affected asset where necessary, and review application and authentication logs for exploitation evidence.",
        },
    },
}

DEFAULT_NEURAL_THRESHOLD = 0.50
