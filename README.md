# FedReason — Local React + FastAPI Demo

This is a self-contained local demonstration UI for **FedReason — Federated Neuro-Symbolic Cyber Threat Intelligence with Federated Semantic Rule Aggregation (FSRA)**.

The demo is intentionally an **inference/reasoning showcase**, not a live federated training system. It reads the frozen local artifacts that were already produced in the research workflow:

- `models/phase1_standard_scaler.joblib`
- `models/phase2_fedprox_mlp.joblib`
- `models/phase3_aggregated_fsra_rules.json`
- `results/phase4_sample_generated_alerts.json` (demo fallback only)

The active semantic rules are locked to the final accepted Phase 3 IDs: `FSRA_RULE_002`, `FSRA_RULE_011`, and `FSRA_RULE_018`.

## 1. Put the research artifacts into the project

The final local tree should look like this:

```text
FedReason_Demo/
├─ backend/
├─ frontend/
├─ demo_data/
├─ metadata/
│  ├─ phase1_artifact_registry.json
│  ├─ phase1_mlp_config.json
│  └─ phase2_config.json
├─ models/
│  ├─ phase1_standard_scaler.joblib
│  ├─ phase2_fedprox_mlp.joblib
│  └─ phase2_fedprox_mlp.pt
├─ results/
│  ├─ phase4_sample_generated_alerts.json
│  └─ ...
├─ rules/
│  └─ phase3_aggregated_fsra_rules.json
└─ runtime/
```

The backend searches `models/` and `rules/` inside the project first. You can override the root with the environment variable `FEDREASON_ROOT`.

## 2. Start the backend (Windows PowerShell)

```powershell
cd "D:\Important documents(studies)\Projects\FedReason_Demo"
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at `http://127.0.0.1:8000` and its docs at `http://127.0.0.1:8000/docs`.

## 3. Start the React frontend

Open a second PowerShell window:

```powershell
cd "D:\Important documents(studies)\Projects\FedReason_Demo\frontend"
npm install
npm run dev
```

Open the Vite URL shown by the terminal, normally `http://localhost:5173`.

## 4. Recommended review flow

1. Open **Organization Data**.
2. Click **Load demo files** to load the packaged 60-row demo inputs into all three simulated organizations.
3. The demo data contains exact validation-derived alert snapshots plus synthetic benign-looking rows. They are explicitly demo data and must not be treated as new benchmark results.
4. Move to **Run FedReason**.
5. Run the analysis.
6. Expand an alert to show neural score, FSRA rule, consensus tier, contributing organizations, satisfied standardized conditions, ATT&CK mapping, and mitigation playbook.

## 5. Important methodological boundary

The UI does **not** retrain FedProx on the uploaded files. It loads the already-frozen Phase 2 FedProx model and applies it locally. The symbolic path uses the frozen Phase 3 active semantic rules.

The interactive demo uses a default neural decision threshold of `0.50` because the numeric per-domain validation thresholds used in the Phase 5 research evaluation were not included in the local artifact set. Therefore the UI's alert counts are **demo execution output**, not a reproduction of the paper's Phase 5 six-system benchmark numbers.

The UI also keeps **observed organization** separate from the frozen FSRA **contributing organization set**, which matters for cross-organizational rule reuse.

## 6. PCAP note

The backend accepts `.pcap` and `.pcapng` uploads so the UI can represent the intended workflow, but this codebase does not silently invent packet-to-flow extraction. A PCAP upload is stored and marked as `PENDING_EXTRACTION`. For live inference in this demo, use CSV files containing the 14 model-ready features.

## 7. API endpoints

- `GET /api/health` — local artifact health.
- `GET /api/config` — feature contract, organizations, and active rule IDs.
- `POST /api/upload` — attach a CSV/PCAP/PCAPNG file to an organization.
- `DELETE /api/uploads/{organization}` — clear one organization's uploads.
- `POST /api/run` — execute the local FedReason inference/reasoning path.
- `GET /api/runs/latest` — retrieve the most recent run result.
## 8. JSON safety for FSRA interval bounds

The frozen FSRA rules use open-ended intervals represented internally as `-inf`/`inf`. Python uses those values correctly for rule matching, but strict JSON responses cannot contain non-finite numbers. The backend therefore converts unbounded `min`/`max` fields to JSON `null` at the API boundary while preserving the original matching semantics. The frontend renders these as `∞`.

