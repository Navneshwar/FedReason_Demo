from __future__ import annotations

# Frozen research metrics used by the local review dashboard.
# These values mirror the accepted Phase 1–6 research artifacts and paper tables.

RESEARCH_ANALYSIS = {
    "data": {
        "simulated_silos": 3,
        "frozen_test_flows": 1158055,
        "pooled_attack_rate": 0.2317,
        "features": 14,
        "datasets": [
            {"dataset": "CICIDS2017", "test_rows": 424743, "attack_rate": 0.1969},
            {"dataset": "CIC-UNSW-NB15", "test_rows": 531589, "attack_rate": 0.0250},
            {"dataset": "CICIoT2023", "test_rows": 201723, "attack_rate": 0.8496},
        ],
    },
    "final_system_comparison": [
        {"name": "Centralized MLP", "accuracy": 0.9217, "attack_f1": 0.8316, "macro_f1": 0.8903, "balanced_accuracy": 0.8914, "roc_auc": 0.975},
        {"name": "FedAvg Neural", "accuracy": 0.7291, "attack_f1": 0.4613, "macro_f1": 0.6402, "balanced_accuracy": 0.6493, "roc_auc": 0.652},
        {"name": "FedProx Neural", "accuracy": 0.7594, "attack_f1": 0.5320, "macro_f1": 0.6850, "balanced_accuracy": 0.7003, "roc_auc": 0.732},
        {"name": "FSRA Symbolic Only", "accuracy": 0.8032, "attack_f1": 0.3116, "macro_f1": 0.5984, "balanced_accuracy": 0.5898, "roc_auc": 0.589},
        {"name": "FedReason Static", "accuracy": 0.8110, "attack_f1": 0.6209, "macro_f1": 0.7475, "balanced_accuracy": 0.7611, "roc_auc": 0.790},
        {"name": "FedReason Domain-Calibrated", "accuracy": 0.8877, "attack_f1": 0.7661, "macro_f1": 0.8461, "balanced_accuracy": 0.8549, "roc_auc": 0.790},
    ],
    "natural_silo": [
        {"method": "FedAvg", "accuracy_mean": 0.714, "accuracy_sd": 0.037, "attack_f1_mean": 0.407, "attack_f1_sd": 0.056, "macro_f1_mean": 0.609, "macro_f1_sd": 0.039, "roc_auc_mean": 0.654, "roc_auc_sd": 0.032},
        {"method": "FedProx", "accuracy_mean": 0.740, "accuracy_sd": 0.031, "attack_f1_mean": 0.492, "attack_f1_sd": 0.044, "macro_f1_mean": 0.659, "macro_f1_sd": 0.033, "roc_auc_mean": 0.719, "roc_auc_sd": 0.020},
    ],
    "per_silo_fedprox": [
        {"silo": "CICIDS2017", "accuracy": 0.768, "precision": 0.455, "recall": 0.914, "attack_f1": 0.607, "roc_auc": 0.910},
        {"silo": "CIC-UNSW-NB15", "accuracy": 0.857, "precision": 0.145, "recall": 0.970, "attack_f1": 0.252, "roc_auc": 0.935},
        {"silo": "CICIoT2023", "accuracy": 0.486, "precision": 0.981, "recall": 0.403, "attack_f1": 0.571, "roc_auc": 0.802},
        {"silo": "Pooled", "accuracy": 0.759, "precision": 0.484, "recall": 0.590, "attack_f1": 0.532, "roc_auc": 0.732},
    ],
    "dirichlet": [
        {"alpha": "10", "fedavg": 0.8803, "fedavg_sd": 0.0055, "fedprox": 0.8716, "fedprox_sd": 0.0006, "fedreason": 0.8592, "fedreason_sd": 0.0004, "rate_sd_pp": 6.8},
        {"alpha": "1", "fedavg": 0.8739, "fedavg_sd": 0.0082, "fedprox": 0.8642, "fedprox_sd": 0.0031, "fedreason": 0.8526, "fedreason_sd": 0.0028, "rate_sd_pp": 27.0},
        {"alpha": "0.5", "fedavg": 0.8769, "fedavg_sd": 0.0133, "fedprox": 0.8723, "fedprox_sd": 0.0123, "fedreason": 0.8599, "fedreason_sd": 0.0119, "rate_sd_pp": 22.4},
        {"alpha": "0.1", "fedavg": 0.7512, "fedavg_sd": 0.1888, "fedprox": 0.8277, "fedprox_sd": 0.0567, "fedreason": 0.8173, "fedreason_sd": 0.0550, "rate_sd_pp": 33.7},
    ],
    "fsra_rules": [
        {"rule": "FSRA_RULE_002", "mitre": "T1498", "technique": "Network Denial of Service", "silos": 3, "precision": 0.817, "validation_coverage": 0.0141},
        {"rule": "FSRA_RULE_011", "mitre": "T1595", "technique": "Active Scanning", "silos": 1, "precision": 0.944, "validation_coverage": 0.0398},
        {"rule": "FSRA_RULE_018", "mitre": "T1190", "technique": "Exploit Public-Facing Application", "silos": 1, "precision": 0.712, "validation_coverage": 0.0004},
    ],
    "corroboration": [
        {"k_min": 1, "rules": 3, "symbolic_precision": 0.8217, "symbolic_recall": 0.1922, "symbolic_f1": 0.3116, "dual_f1": 0.7661, "dual_auc": 0.790},
        {"k_min": 2, "rules": 1, "symbolic_precision": 0.3368, "symbolic_recall": 0.0204, "symbolic_f1": 0.0385, "dual_f1": 0.7646, "dual_auc": 0.730},
        {"k_min": 3, "rules": 1, "symbolic_precision": 0.3368, "symbolic_recall": 0.0204, "symbolic_f1": 0.0385, "dual_f1": 0.7646, "dual_auc": 0.730},
    ],
    "privacy": {
        "membership_inference": {"auc": 0.4938, "advantage": 0.0124, "members": 5000, "nonmembers": 5000},
        "gradient_inversion": [
            {"batch": 1, "mse": 1.434, "cosine": 0.6004},
            {"batch": 32, "mse": 2.609, "cosine": 0.0790},
        ],
    },
    "explainability": {
        "catalogue_rules": 20,
        "attack_rules": 6,
        "active_rules": 3,
        "demo_alerts": 10,
        "structured_alert_fields": ["rule ID", "conditions", "MITRE ATT&CK", "lineage", "playbook"],
        "test_data_used_for_alert_demo": False,
    },
    "notes": [
        "The three silos are simulated from public datasets, not real partner organizations.",
        "The integrated domain-calibrated FedReason result uses the seed-42 federated model and validation-derived domain thresholds.",
        "A calibrated FedProx-without-rules baseline was not run, so rule contribution is not fully isolated from calibration.",
        "Under Dirichlet partitions, FedReason trails FedProx by about 1.05–1.23 attack-F1 points at every alpha.",
        "The privacy audit is empirical and does not establish differential privacy, secure aggregation, or immunity to stronger attacks.",
        "Explainability is evaluated as structured artifact coverage, not human trust, MTTR, or analyst response time.",
    ],
}
