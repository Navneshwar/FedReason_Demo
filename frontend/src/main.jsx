import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleOff,
  Database,
  FileUp,
  Fingerprint,
  Layers3,
  Network,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import './styles.css'

const API = '/api'

const DEFAULT_ORGS = {
  Org_A: { display_name: 'Organization A', dataset: 'CICIDS2017', type: 'Enterprise Network' },
  Org_B: { display_name: 'Organization B', dataset: 'CIC_UNSW_NB15', type: 'Heterogeneous Metadata' },
  Org_C: { display_name: 'Organization C', dataset: 'CICIoT2023', type: 'IoT/OT Traffic' },
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value || 0)
}

function pct(value) {
  return `${((value || 0) * 100).toFixed(1)}%`
}

function severityClass(severity) {
  return `severity severity-${String(severity || '').toLowerCase()}`
}

function verdictLabel(alert) {
  if (alert.fsra_flag && alert.neural_flag) return 'Dual-channel confirmed'
  if (alert.fsra_flag) return 'FSRA rule matched'
  return 'Neural channel flagged'
}

function App() {
  const [tab, setTab] = useState('data')
  const [orgs, setOrgs] = useState(DEFAULT_ORGS)
  const [uploads, setUploads] = useState({})
  const [config, setConfig] = useState(null)
  const [health, setHealth] = useState(null)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)
  const [runError, setRunError] = useState('')
  const [expandedAlert, setExpandedAlert] = useState(null)

  const fetchMeta = useCallback(async () => {
    try {
      const [h, c] = await Promise.all([
        fetch(`${API}/health`).then((r) => r.json()),
        fetch(`${API}/config`).then((r) => r.json()),
      ])
      setHealth(h)
      setConfig(c)
      if (c.organizations) setOrgs(c.organizations)
    } catch (error) {
      setHealth({ status: 'offline', error: error.message })
    }
  }, [])

  useEffect(() => { fetchMeta() }, [fetchMeta])

  const upload = async (orgId, file) => {
    if (!file) return
    const form = new FormData()
    form.append('organization', orgId)
    form.append('file', file)
    setUploads((prev) => ({ ...prev, [orgId]: { state: 'uploading', filename: file.name } }))
    try {
      const response = await fetch(`${API}/upload`, { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || data.message || 'Upload failed')
      setUploads((prev) => ({ ...prev, [orgId]: data }))
    } catch (error) {
      setUploads((prev) => ({ ...prev, [orgId]: { state: 'error', message: error.message, filename: file.name } }))
    }
  }

  const clearOrg = async (orgId) => {
    await fetch(`${API}/uploads/${orgId}`, { method: 'DELETE' })
    setUploads((prev) => ({ ...prev, [orgId]: null }))
  }

  const loadDemoData = async () => {
    const demoFiles = {
      Org_A: '/demo/organization_A.csv',
      Org_B: '/demo/organization_B.csv',
      Org_C: '/demo/organization_C.csv',
    }
    for (const orgId of Object.keys(demoFiles)) {
      const fileResponse = await fetch(demoFiles[orgId])
      if (!fileResponse.ok) continue
      const blob = await fileResponse.blob()
      const file = new File([blob], `${orgId.toLowerCase()}_demo.csv`, { type: 'text/csv' })
      await upload(orgId, file)
    }
  }

  const runFedReason = async () => {
    setRunning(true)
    setRunError('')
    setRunResult(null)
    try {
      const response = await fetch(`${API}/run`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Run failed')
      setRunResult(data)
      setTab('run')
    } catch (error) {
      setRunError(error.message)
    } finally {
      setRunning(false)
    }
  }

  const uploadedCount = Object.values(uploads).filter(Boolean).length
  const totalAlerts = runResult?.summary?.alerts || 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Shield size={20} /></div>
          <div>
            <div className="brand-title">FedReason</div>
            <div className="brand-subtitle">Federated neuro-symbolic cyber threat intelligence</div>
          </div>
        </div>
        <div className="topbar-status">
          <div className={`connection-pill ${health?.status === 'ok' ? 'online' : 'offline'}`}>
            <span className="dot" />
            {health?.status === 'ok' ? 'Local backend online' : 'Backend unavailable'}
          </div>
          <div className="artifact-pill">
            <Fingerprint size={15} />
            Frozen research artifacts
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">LOCAL REVIEW DEMO</div>
          <h1>Collaborate on threat intelligence.<br /><span>Keep raw flows local.</span></h1>
          <p>
            Upload each organization’s model-ready flow CSV, run the frozen FedProx neural channel together with the frozen FSRA semantic rules, and inspect explainable threat alerts locally.
          </p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => setTab('data')}>
              <UploadCloud size={17} /> Attach organization data
            </button>
            <button className="secondary-btn" onClick={runFedReason} disabled={running || !uploadedCount}>
              <Play size={16} /> {running ? 'Running…' : 'Run FedReason'}
            </button>
          </div>
        </div>
        <div className="architecture-card">
          <div className="arch-title">Demo execution path</div>
          <div className="arch-flow">
            <ArchNode icon={<Database size={17} />} label="Local flows" />
            <ArrowRight size={17} className="arch-arrow" />
            <ArchNode icon={<Layers3 size={17} />} label="FedProx MLP" />
            <ArrowRight size={17} className="arch-arrow" />
            <ArchNode icon={<Network size={17} />} label="FSRA rules" />
            <ArrowRight size={17} className="arch-arrow" />
            <ArchNode icon={<ShieldAlert size={17} />} label="Alert" />
          </div>
          <div className="arch-note">No live federated retraining occurs in this UI; inference uses the frozen local artifacts.</div>
        </div>
      </section>

      <nav className="tabs">
        <button className={tab === 'data' ? 'tab active' : 'tab'} onClick={() => setTab('data')}>
          <Database size={17} /> Organization Data
          <span className="tab-count">{uploadedCount}/3</span>
        </button>
        <button className={tab === 'run' ? 'tab active' : 'tab'} onClick={() => setTab('run')}>
          <ShieldAlert size={17} /> Run FedReason
          {totalAlerts > 0 && <span className="tab-alert">{totalAlerts}</span>}
        </button>
      </nav>

      {tab === 'data' ? (
        <main className="content-area">
          <section className="section-head">
            <div>
              <div className="section-kicker">STEP 01</div>
              <h2>Attach organization traffic</h2>
              <p>Each silo uploads its own flow file. The backend reads only the 14 frozen model features.</p>
            </div>
            <button className="ghost-btn" onClick={loadDemoData}>
              <RefreshCw size={15} /> Load demo files
            </button>
          </section>

          <div className="info-banner">
            <AlertTriangle size={17} />
            <div>
              <strong>CSV is the live inference format.</strong> Raw PCAP/PCAPNG files are accepted for attachment, but this demo does not include packet-to-flow extraction. Convert PCAP to the 14-feature flow CSV first.
            </div>
          </div>

          <div className="org-grid">
            {Object.entries(orgs).map(([orgId, meta], index) => (
              <OrganizationCard
                key={orgId}
                index={index}
                orgId={orgId}
                meta={meta}
                upload={uploads[orgId]}
                onUpload={upload}
                onClear={clearOrg}
              />
            ))}
          </div>

          <section className="feature-contract">
            <div className="contract-title">Frozen 14-feature contract</div>
            <div className="feature-list">{(config?.features || []).map((feature) => <span key={feature}>{feature}</span>)}</div>
          </section>
        </main>
      ) : (
        <main className="content-area">
          <section className="section-head">
            <div>
              <div className="section-kicker">STEP 02</div>
              <h2>Run the FedReason pipeline</h2>
              <p>Neural prediction is combined with the active FSRA semantic rule channel for explainable alerts.</p>
            </div>
            <button className="primary-btn compact" onClick={runFedReason} disabled={running || !uploadedCount}>
              <Play size={16} /> {running ? 'Analyzing flows…' : 'Run analysis'}
            </button>
          </section>

          {!runResult && !runError && (
            <EmptyRunState uploadedCount={uploadedCount} onRun={runFedReason} />
          )}
          {runError && <ErrorBox message={runError} />}
          {runResult && <RunDashboard result={runResult} expandedAlert={expandedAlert} setExpandedAlert={setExpandedAlert} />}
        </main>
      )}

      <footer className="footer">
        <div>FedReason local review UI · simulated organizations · no raw-log federation</div>
        <div>Backend: FastAPI · Frontend: React + Vite</div>
      </footer>
    </div>
  )
}

function ArchNode({ icon, label }) {
  return <div className="arch-node"><div className="arch-icon">{icon}</div><span>{label}</span></div>
}

function OrganizationCard({ index, orgId, meta, upload, onUpload, onClear }) {
  const id = `file-${orgId}`
  const isUploaded = upload && upload.status?.startsWith('UPLOAD')
  const isPending = upload?.status === 'UPLOADED_PENDING_EXTRACTION'
  return (
    <article className="org-card">
      <div className="org-card-top">
        <div className="org-badge">0{index + 1}</div>
        <div>
          <div className="org-name">{meta.display_name}</div>
          <div className="org-id">{orgId}</div>
        </div>
        <div className="org-status">{isUploaded || isPending ? <CheckCircle2 size={16} /> : <CircleOff size={16} />}</div>
      </div>
      <div className="org-meta">
        <span>{meta.dataset}</span>
        <span>{meta.type}</span>
      </div>
      <label htmlFor={id} className={`dropzone ${isUploaded ? 'has-file' : ''}`}>
        <input
          id={id}
          type="file"
          accept=".csv,.pcap,.pcapng"
          onChange={(event) => onUpload(orgId, event.target.files?.[0])}
        />
        {upload?.state === 'uploading' ? (
          <>
            <RefreshCw className="spin" size={22} />
            <div>Uploading {upload.filename}…</div>
          </>
        ) : isUploaded || isPending ? (
          <>
            <CheckCircle2 size={22} />
            <div className="dropzone-title">{upload.filename}</div>
            <div className="dropzone-subtitle">{isPending ? 'PCAP attached — extraction required' : `${formatNumber(upload.valid_rows)} valid rows ready`}</div>
          </>
        ) : (
          <>
            <FileUp size={22} />
            <div className="dropzone-title">Drop a CSV or PCAP here</div>
            <div className="dropzone-subtitle">or click to browse local files</div>
          </>
        )}
      </label>
      {upload?.message && <div className="upload-message">{upload.message}</div>}
      {upload?.status === 'INVALID_SCHEMA' && <div className="upload-error"><XCircle size={15} /> {upload.message}</div>}
      <div className="org-actions">
        <div className="mini-stat"><span>Input</span><strong>{upload?.file_type || '—'}</strong></div>
        <div className="mini-stat"><span>Rows</span><strong>{formatNumber(upload?.rows)}</strong></div>
        {upload && <button className="clear-btn" onClick={() => onClear(orgId)}>Clear</button>}
      </div>
    </article>
  )
}

function EmptyRunState({ uploadedCount, onRun }) {
  return (
    <div className="empty-run">
      <div className="empty-icon"><Activity size={24} /></div>
      <h3>{uploadedCount ? 'Ready to analyze' : 'Attach organization data first'}</h3>
      <p>
        {uploadedCount
          ? 'The backend will process all currently uploaded organization CSVs with the frozen FedProx model and active FSRA rules.'
          : 'Go back to Organization Data and attach at least one model-ready CSV.'}
      </p>
      {uploadedCount > 0 && <button className="primary-btn" onClick={onRun}><Play size={16} /> Run FedReason</button>}
    </div>
  )
}

function ErrorBox({ message }) {
  return <div className="error-box"><XCircle size={18} /><div><strong>Pipeline error</strong><p>{message}</p></div></div>
}

function RunDashboard({ result, expandedAlert, setExpandedAlert }) {
  const summary = result.summary || {}
  const alerts = result.alerts || []
  const ruleCounts = useMemo(() => {
    const map = {}
    alerts.forEach((a) => { if (a.fsra_rule_id) map[a.fsra_rule_id] = (map[a.fsra_rule_id] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [alerts])

  return (
    <>
      <div className="run-meta-line">
        <span><span className="live-dot" /> Run completed</span>
        <span>{summary.run_id}</span>
        <span>Neural threshold {Number(summary.threshold || 0.5).toFixed(2)}</span>
      </div>

      <section className="metrics-grid">
        <MetricCard title="Flows analyzed" value={formatNumber(summary.total_flows)} icon={<Activity size={18} />} />
        <MetricCard title="Malicious / flagged" value={formatNumber(summary.malicious_flows)} icon={<ShieldAlert size={18} />} accent />
        <MetricCard title="FSRA matches" value={formatNumber(summary.fsra_flags)} icon={<Network size={18} />} />
        <MetricCard title="High severity" value={formatNumber(summary.high_severity)} icon={<AlertTriangle size={18} />} />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-head"><div><h3>Organization coverage</h3><p>Observed organization is kept separate from frozen rule provenance.</p></div></div>
          <div className="org-table">
            {result.per_organization?.map((org) => (
              <div className="org-row" key={org.organization_id}>
                <div className="org-row-main">
                  <div className="tiny-avatar">{org.organization_id.replace('Org_', '')}</div>
                  <div><strong>{org.organization_name}</strong><span>{org.dataset}</span></div>
                </div>
                <div className="org-row-stat"><span>Flows</span><strong>{formatNumber(org.flows)}</strong></div>
                <div className="org-row-stat"><span>Alerts</span><strong>{formatNumber(org.alerts)}</strong></div>
                <div className="org-row-stat"><span>FSRA</span><strong>{formatNumber(org.fsra_flags)}</strong></div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><div><h3>Rule activity</h3><p>Only the three locked active semantic rules are used.</p></div></div>
          <div className="rule-list">
            {ruleCounts.length ? ruleCounts.map(([ruleId, count]) => <div className="rule-item" key={ruleId}><span className="rule-id">{ruleId}</span><span className="rule-count">{count}</span></div>) : <div className="muted">No FSRA rules fired.</div>}
          </div>
          <div className="rule-source"><span>Source</span><strong>{summary.rule_source}</strong></div>
        </div>
      </section>

      <section className="alert-panel">
        <div className="panel-head alert-head"><div><h3>Explainable threat alerts</h3><p>Each alert includes the observed silo, neural score, FSRA provenance, ATT&amp;CK mapping, and response guidance.</p></div><div className="alert-count-pill">{alerts.length} alert{alerts.length === 1 ? '' : 's'}</div></div>
        <div className="alerts-list">
          {alerts.length === 0 ? <div className="no-alerts"><CheckCircle2 size={20} /><span>No malicious flow was flagged in this run.</span></div> : alerts.map((alert) => (
            <AlertCard
              key={alert.alert_id}
              alert={alert}
              expanded={expandedAlert === alert.alert_id}
              onToggle={() => setExpandedAlert(expandedAlert === alert.alert_id ? null : alert.alert_id)}
            />
          ))}
        </div>
      </section>

      {result.warnings?.length > 0 && (
        <section className="warnings-panel">
          <div className="panel-head"><div><h3>Run warnings</h3><p>Review these before interpreting the demo output.</p></div></div>
          {result.warnings.map((w) => <div className="warning-row" key={w}><AlertTriangle size={15} /> {w}</div>)}
        </section>
      )}
    </>
  )
}

function MetricCard({ title, value, icon, accent }) {
  return <div className={`metric-card ${accent ? 'accent' : ''}`}><div className="metric-icon">{icon}</div><div><span>{title}</span><strong>{value}</strong></div></div>
}

function AlertCard({ alert, expanded, onToggle }) {
  return (
    <article className={`alert-card ${expanded ? 'expanded' : ''}`}>
      <div className="alert-main" onClick={onToggle}>
        <div className="severity-block"><div className={severityClass(alert.severity)}>{alert.severity}</div><div className="alert-verdict">{verdictLabel(alert)}</div></div>
        <div className="alert-center">
          <div className="alert-title-line"><strong>{alert.fsra_rule_id || 'NEURAL-SIGNAL'}</strong><span>{alert.mitre_id || 'No ATT&CK mapping'}</span></div>
          <div className="alert-technique">{alert.mitre_technique || 'Neural channel anomaly'}</div>
          <div className="alert-meta">Observed: {alert.organization_name} · Source file: {alert.source_filename} · Flow #{alert.flow_index + 1}</div>
        </div>
        <div className="alert-score"><span>Confidence</span><strong>{pct(alert.confidence_score)}</strong></div>
        <ChevronDown className={expanded ? 'chevron open' : 'chevron'} size={19} />
      </div>
      {expanded && (
        <div className="alert-detail">
          <div className="detail-grid">
            <DetailBlock title="Neural channel">
              <div className="detail-row"><span>Positive score</span><strong>{pct(alert.neural_score)}</strong></div>
              <div className="detail-row"><span>Decision</span><strong>{alert.neural_flag ? 'Flagged' : 'Below threshold'}</strong></div>
            </DetailBlock>
            <DetailBlock title="FSRA reasoning">
              <div className="detail-row"><span>Rule</span><strong>{alert.fsra_rule_id || '—'}</strong></div>
              <div className="detail-row"><span>Consensus</span><strong>{alert.consensus_tier || '—'}</strong></div>
              <div className="detail-row"><span>Contributors</span><strong>{alert.contributing_organizations?.join(', ') || '—'}</strong></div>
            </DetailBlock>
            <DetailBlock title="MITRE ATT&CK">
              <div className="detail-row"><span>Technique</span><strong>{alert.mitre_id || '—'}</strong></div>
              <div className="detail-row"><span>Name</span><strong>{alert.mitre_technique || '—'}</strong></div>
              <div className="detail-row"><span>Family</span><strong>{alert.attack_family || '—'}</strong></div>
            </DetailBlock>
            <DetailBlock title="Response playbook">
              <div className="playbook-title">{alert.playbook?.title || 'Investigate neural signal'}</div>
              <div className="playbook-action">{alert.playbook?.action || 'Inspect the affected flow and surrounding telemetry.'}</div>
            </DetailBlock>
          </div>
          {alert.conditions_satisfied?.length > 0 && (
            <div className="conditions">
              <div className="conditions-title">Standardized FSRA conditions satisfied</div>
              <div className="condition-table">
                {alert.conditions_satisfied.map((condition, index) => (
                  <div className="condition-row" key={`${condition.feature}-${index}`}>
                    <span>{condition.feature}</span><code>{Number(condition.value).toFixed(4)}</code><span>&gt; {formatBound(condition.min)}</span><span>≤ {formatBound(condition.max)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {alert.notes?.length > 0 && <div className="alert-note"><AlertTriangle size={15} /><span>{alert.notes.join(' ')}</span></div>}
          <div className="feature-snapshot">
            <div className="conditions-title">Raw flow snapshot</div>
            <div className="snapshot-grid">{Object.entries(alert.feature_snapshot || {}).map(([k, v]) => <div key={k}><span>{k}</span><strong>{Number(v).toFixed(4)}</strong></div>)}</div>
          </div>
        </div>
      )}
    </article>
  )
}

function DetailBlock({ title, children }) { return <div className="detail-block"><div className="detail-title">{title}</div>{children}</div> }
function formatBound(value) { return value === null || value === undefined ? '∞' : Number(value).toFixed(4) }

createRoot(document.getElementById('root')).render(<App />)
