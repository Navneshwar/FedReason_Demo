import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, CheckCircle2, ChevronDown, CircleOff, Database,
  FileUp, Fingerprint, Layers3, Network, Play, RefreshCw, Shield, ShieldAlert, UploadCloud, XCircle,
  FlaskConical, LockKeyhole, Target, GitCompareArrows,
} from 'lucide-react'
import './styles.css'

const API = '/api'

const DEFAULT_ORGS = {
  Org_A: { display_name: 'Organization A', dataset: 'CICIDS2017', type: 'Enterprise Network' },
  Org_B: { display_name: 'Organization B', dataset: 'CIC_UNSW_NB15', type: 'Heterogeneous Metadata' },
  Org_C: { display_name: 'Organization C', dataset: 'CICIoT2023', type: 'IoT/OT Traffic' },
}

const RESEARCH_PALETTE = { primary: '#62d8c5', secondary: '#65a9e6', tertiary: '#d9b76c', muted: '#6f8195', danger: '#ef7e78' }

function formatNumber(value) { return new Intl.NumberFormat('en-IN').format(value || 0) }
function pct(value, digits = 1) { return `${((value || 0) * 100).toFixed(digits)}%` }
function decimal(value, digits = 3) { return Number(value || 0).toFixed(digits) }
function severityClass(severity) { return `severity severity-${String(severity || '').toLowerCase()}` }
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
  const [research, setResearch] = useState(null)
  const [researchLoading, setResearchLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)
  const [runError, setRunError] = useState('')
  const [expandedAlert, setExpandedAlert] = useState(null)

  const fetchMeta = useCallback(async () => {
    try {
      const [h, c, r] = await Promise.all([
        fetch(`${API}/health`).then((res) => res.json()),
        fetch(`${API}/config`).then((res) => res.json()),
        fetch(`${API}/research-analysis`).then((res) => res.json()),
      ])
      setHealth(h)
      setConfig(c)
      setResearch(r)
      if (c.organizations) setOrgs(c.organizations)
    } catch (error) {
      setHealth({ status: 'offline', error: error.message })
    } finally {
      setResearchLoading(false)
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
    const demoFiles = { Org_A: '/demo/organization_A.csv', Org_B: '/demo/organization_B.csv', Org_C: '/demo/organization_C.csv' }
    for (const orgId of Object.keys(demoFiles)) {
      const fileResponse = await fetch(demoFiles[orgId])
      if (!fileResponse.ok) continue
      const blob = await fileResponse.blob()
      const file = new File([blob], `${orgId.toLowerCase()}_demo.csv`, { type: 'text/csv' })
      await upload(orgId, file)
    }
  }

  const runFedReason = async () => {
    setRunning(true); setRunError(''); setRunResult(null)
    try {
      const response = await fetch(`${API}/run`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Run failed')
      setRunResult(data); setTab('run')
    } catch (error) { setRunError(error.message) }
    finally { setRunning(false) }
  }

  const uploadedCount = Object.values(uploads).filter(Boolean).length
  const totalAlerts = runResult?.summary?.alerts || 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Shield size={20} /></div>
          <div><div className="brand-title">FedReason</div><div className="brand-subtitle">Federated neuro-symbolic cyber threat intelligence</div></div>
        </div>
        <div className="topbar-status">
          <div className={`connection-pill ${health?.status === 'ok' ? 'online' : 'offline'}`}><span className="dot" />{health?.status === 'ok' ? 'Local backend online' : 'Backend unavailable'}</div>
          <div className="artifact-pill"><Fingerprint size={15} /> Frozen research artifacts</div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">LOCAL REVIEW DEMO</div>
          <h1>Collaborate on threat intelligence.<br /><span>Keep raw flows local.</span></h1>
          <p>Upload each organization’s model-ready flow CSV, run the frozen FedProx neural channel together with frozen FSRA semantic rules, and inspect explainable threat alerts locally.</p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => setTab('data')}><UploadCloud size={17} /> Attach organization data</button>
            <button className="secondary-btn" onClick={runFedReason} disabled={running || !uploadedCount}><Play size={16} /> {running ? 'Running…' : 'Run FedReason'}</button>
          </div>
        </div>
        <div className="architecture-card">
          <div className="arch-title">Demo execution path</div>
          <div className="arch-flow"><ArchNode icon={<Database size={17} />} label="Local flows" /><ArrowRight size={17} className="arch-arrow" /><ArchNode icon={<Layers3 size={17} />} label="FedProx MLP" /><ArrowRight size={17} className="arch-arrow" /><ArchNode icon={<Network size={17} />} label="FSRA rules" /><ArrowRight size={17} className="arch-arrow" /><ArchNode icon={<ShieldAlert size={17} />} label="Alert" /></div>
          <div className="arch-note">No live federated retraining occurs in this UI; inference uses frozen local artifacts.</div>
        </div>
      </section>

      <nav className="tabs">
        <button className={tab === 'data' ? 'tab active' : 'tab'} onClick={() => setTab('data')}><Database size={17} /> Organization Data <span className="tab-count">{uploadedCount}/3</span></button>
        <button className={tab === 'run' ? 'tab active' : 'tab'} onClick={() => setTab('run')}><ShieldAlert size={17} /> Run FedReason {totalAlerts > 0 && <span className="tab-alert">{totalAlerts}</span>}</button>
        <button className={tab === 'analysis' ? 'tab active' : 'tab'} onClick={() => setTab('analysis')}><BarChart3 size={17} /> Research Analysis <span className="tab-analysis">Frozen</span></button>
      </nav>

      {tab === 'data' && <DataTab orgs={orgs} uploads={uploads} config={config} upload={upload} clearOrg={clearOrg} loadDemoData={loadDemoData} />}
      {tab === 'run' && <RunTab running={running} uploadedCount={uploadedCount} runFedReason={runFedReason} runResult={runResult} runError={runError} expandedAlert={expandedAlert} setExpandedAlert={setExpandedAlert} />}
      {tab === 'analysis' && <AnalysisTab research={research} loading={researchLoading} />}

      <footer className="footer"><div>FedReason local review UI · simulated organizations · no raw-log federation</div><div>Backend: FastAPI · Frontend: React + Vite</div></footer>
    </div>
  )
}

function ArchNode({ icon, label }) { return <div className="arch-node"><div className="arch-icon">{icon}</div><span>{label}</span></div> }

function DataTab({ orgs, uploads, config, upload, clearOrg, loadDemoData }) {
  return <main className="content-area">
    <section className="section-head"><div><div className="section-kicker">STEP 01</div><h2>Attach organization traffic</h2><p>Each silo uploads its own flow file. The backend reads only the 14 frozen model features.</p></div><button className="ghost-btn" onClick={loadDemoData}><RefreshCw size={15} /> Load demo files</button></section>
    <div className="info-banner"><AlertTriangle size={17} /><div><strong>CSV is the live inference format.</strong> PCAP/PCAPNG can be attached for review, but this demo does not include packet-to-flow extraction. Convert PCAP to the 14-feature flow CSV first.</div></div>
    <div className="org-grid">{Object.entries(orgs).map(([orgId, meta], index) => <OrganizationCard key={orgId} index={index} orgId={orgId} meta={meta} upload={uploads[orgId]} onUpload={upload} onClear={clearOrg} />)}</div>
    <section className="feature-contract"><div className="contract-title">Frozen 14-feature contract</div><div className="feature-list">{(config?.features || []).map((feature) => <span key={feature}>{feature}</span>)}</div></section>
  </main>
}

function RunTab({ running, uploadedCount, runFedReason, runResult, runError, expandedAlert, setExpandedAlert }) {
  return <main className="content-area"><section className="section-head"><div><div className="section-kicker">STEP 02</div><h2>Run the FedReason pipeline</h2><p>Neural prediction is combined with the active FSRA semantic rule channel for explainable alerts.</p></div><button className="primary-btn compact" onClick={runFedReason} disabled={running || !uploadedCount}><Play size={16} /> {running ? 'Analyzing flows…' : 'Run analysis'}</button></section>{!runResult && !runError && <EmptyRunState uploadedCount={uploadedCount} onRun={runFedReason} />}{runError && <ErrorBox message={runError} />}{runResult && <RunDashboard result={runResult} expandedAlert={expandedAlert} setExpandedAlert={setExpandedAlert} />}</main>
}

function OrganizationCard({ index, orgId, meta, upload, onUpload, onClear }) {
  const id = `file-${orgId}`; const isUploaded = upload && upload.status?.startsWith('UPLOAD'); const isPending = upload?.status === 'UPLOADED_PENDING_EXTRACTION'
  return <article className="org-card"><div className="org-card-top"><div className="org-badge">0{index + 1}</div><div><div className="org-name">{meta.display_name}</div><div className="org-id">{orgId}</div></div><div className="org-status">{isUploaded || isPending ? <CheckCircle2 size={16} /> : <CircleOff size={16} />}</div></div><div className="org-meta"><span>{meta.dataset}</span><span>{meta.type}</span></div><label htmlFor={id} className={`dropzone ${isUploaded ? 'has-file' : ''}`}><input id={id} type="file" accept=".csv,.pcap,.pcapng" onChange={(event) => onUpload(orgId, event.target.files?.[0])} />{upload?.state === 'uploading' ? <><RefreshCw className="spin" size={22} /><div>Uploading {upload.filename}…</div></> : isUploaded || isPending ? <><CheckCircle2 size={22} /><div className="dropzone-title">{upload.filename}</div><div className="dropzone-subtitle">{isPending ? 'PCAP attached — extraction required' : `${formatNumber(upload.valid_rows)} valid rows ready`}</div></> : <><FileUp size={22} /><div className="dropzone-title">Drop a CSV or PCAP here</div><div className="dropzone-subtitle">or click to browse local files</div></>}</label>{upload?.message && <div className="upload-message">{upload.message}</div>}{upload?.status === 'INVALID_SCHEMA' && <div className="upload-error"><XCircle size={15} /> {upload.message}</div>}<div className="org-actions"><div className="mini-stat"><span>Input</span><strong>{upload?.file_type || '—'}</strong></div><div className="mini-stat"><span>Rows</span><strong>{formatNumber(upload?.rows)}</strong></div>{upload && <button className="clear-btn" onClick={() => onClear(orgId)}>Clear</button>}</div></article>
}

function EmptyRunState({ uploadedCount, onRun }) { return <div className="empty-run"><div className="empty-icon"><Activity size={24} /></div><h3>{uploadedCount ? 'Ready to analyze' : 'Attach organization data first'}</h3><p>{uploadedCount ? 'The backend will process all currently uploaded organization CSVs with the frozen FedProx model and active FSRA rules.' : 'Go back to Organization Data and attach at least one model-ready CSV.'}</p>{uploadedCount > 0 && <button className="primary-btn" onClick={onRun}><Play size={16} /> Run FedReason</button>}</div> }
function ErrorBox({ message }) { return <div className="error-box"><XCircle size={18} /><div><strong>Pipeline error</strong><p>{message}</p></div></div> }

function RunDashboard({ result, expandedAlert, setExpandedAlert }) {
  const summary = result.summary || {}; const alerts = result.alerts || []
  const ruleCounts = useMemo(() => { const map = {}; alerts.forEach((a) => { if (a.fsra_rule_id) map[a.fsra_rule_id] = (map[a.fsra_rule_id] || 0) + 1 }); return Object.entries(map).sort((a, b) => b[1] - a[1]) }, [alerts])
  return <>
    <div className="run-meta-line"><span><span className="live-dot" /> Run completed</span><span>{summary.run_id}</span><span>Neural threshold {Number(summary.threshold || 0.5).toFixed(2)}</span></div>
    <section className="metrics-grid"><MetricCard title="Flows analyzed" value={formatNumber(summary.total_flows)} icon={<Activity size={18} />} /><MetricCard title="Malicious / flagged" value={formatNumber(summary.malicious_flows)} icon={<ShieldAlert size={18} />} accent /><MetricCard title="FSRA matches" value={formatNumber(summary.fsra_flags)} icon={<Network size={18} />} /><MetricCard title="High severity" value={formatNumber(summary.high_severity)} icon={<AlertTriangle size={18} />} /></section>
    <RunAnalytics summary={summary} perOrganization={result.per_organization || []} alerts={alerts} ruleCounts={ruleCounts} />
    <section className="dashboard-grid"><div className="panel"><div className="panel-head"><div><h3>Organization coverage</h3><p>Observed organization is kept separate from frozen rule provenance.</p></div></div><div className="org-table">{result.per_organization?.map((org) => <div className="org-row" key={org.organization_id}><div className="org-row-main"><div className="tiny-avatar">{org.organization_id.replace('Org_', '')}</div><div><strong>{org.organization_name}</strong><span>{org.dataset}</span></div></div><div className="org-row-stat"><span>Flows</span><strong>{formatNumber(org.flows)}</strong></div><div className="org-row-stat"><span>Alerts</span><strong>{formatNumber(org.alerts)}</strong></div><div className="org-row-stat"><span>FSRA</span><strong>{formatNumber(org.fsra_flags)}</strong></div></div>)}</div></div><div className="panel"><div className="panel-head"><div><h3>Rule activity</h3><p>Only the three locked active semantic rules are used.</p></div></div><div className="rule-list">{ruleCounts.length ? ruleCounts.map(([ruleId, count]) => <div className="rule-item" key={ruleId}><span className="rule-id">{ruleId}</span><span className="rule-count">{count}</span></div>) : <div className="muted">No FSRA rules fired.</div>}</div><div className="rule-source"><span>Source</span><strong>{summary.rule_source}</strong></div></div></section>
    <section className="alert-panel"><div className="panel-head alert-head"><div><h3>Explainable threat alerts</h3><p>Each alert includes the observed silo, neural score, FSRA provenance, ATT&amp;CK mapping, and response guidance.</p></div><div className="alert-count-pill">{alerts.length} alert{alerts.length === 1 ? '' : 's'}</div></div><div className="alerts-list">{alerts.length === 0 ? <div className="no-alerts"><CheckCircle2 size={20} /><span>No malicious flow was flagged in this run.</span></div> : alerts.map((alert) => <AlertCard key={alert.alert_id} alert={alert} expanded={expandedAlert === alert.alert_id} onToggle={() => setExpandedAlert(expandedAlert === alert.alert_id ? null : alert.alert_id)} />)}</div></section>
    {result.warnings?.length > 0 && <section className="warnings-panel"><div className="panel-head"><div><h3>Run warnings</h3><p>Review these before interpreting the demo output.</p></div></div>{result.warnings.map((w) => <div className="warning-row" key={w}><AlertTriangle size={15} /> {w}</div>)}</section>}
  </>
}

function RunAnalytics({ summary, perOrganization, alerts, ruleCounts }) {
  const total = Number(summary.total_flows || 0)
  const flagged = Number(summary.malicious_flows ?? alerts.length ?? 0)
  const fsra = Number(summary.fsra_flags || 0)
  const neuralOnly = Math.max(flagged - fsra, 0)
  const benign = Math.max(total - flagged, 0)
  const alertRate = total ? flagged / total : 0
  const fsraRate = total ? fsra / total : 0

  const severityCounts = alerts.reduce((acc, alert) => {
    const key = String(alert.severity || 'LOW').toUpperCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const severityData = severityOrder.filter((name) => severityCounts[name]).map((name) => ({ name, value: severityCounts[name] }))

  return <section className="run-analytics">
    <div className="run-analytics-head">
      <div>
        <div className="section-kicker">RUN ANALYTICS</div>
        <h3>What happened in this run?</h3>
        <p>Live demo results from the uploaded organization files. The research benchmark remains in the separate Research Analysis tab.</p>
      </div>
      <div className="analytics-summary-pill"><span className="live-dot" /> {formatNumber(total)} flows processed</div>
    </div>

    <div className="run-chart-grid">
      <ChartFrame title="Alert rate by organization" subtitle="Compare suspicious-flow rate and FSRA coverage without letting raw flow volume dominate the chart.">
        <RunOrgRateChart data={perOrganization} />
      </ChartFrame>

      <ChartFrame title="Detection composition" subtitle="How the final flagged population is split between benign, neural-only, and FSRA-confirmed flows.">
        <RunOutcomeChart total={total} benign={benign} neuralOnly={neuralOnly} fsra={fsra} />
      </ChartFrame>

      <ChartFrame title="FSRA rule activity" subtitle="Number of alerts attributed to each frozen semantic rule.">
        <RunRuleChart data={ruleCounts} />
      </ChartFrame>

      <ChartFrame title="Alert severity" subtitle="Operational severity distribution for the alerts generated in this run.">
        <RunSeverityChart data={severityData} />
      </ChartFrame>
    </div>

    <div className="run-insight-row">
      <InsightTile label="Overall alert rate" value={pct(alertRate, 1)} detail={`${formatNumber(flagged)} of ${formatNumber(total)} flows flagged`} />
      <InsightTile label="FSRA confirmation rate" value={pct(flagged ? fsra / flagged : 0, 1)} detail={`${formatNumber(fsra)} flagged flows matched a semantic rule`} accent />
      <InsightTile label="Neural-only detections" value={formatNumber(neuralOnly)} detail="Flagged by the neural channel without an FSRA rule match" />
      <InsightTile label="High / critical" value={formatNumber((severityCounts.HIGH || 0) + (severityCounts.CRITICAL || 0))} detail="Priority alerts requiring the fastest review" danger />
    </div>
  </section>
}

function RunOrgRateChart({ data }) {
  const width = 760, height = 260, left = 54, right = 18, top = 20, bottom = 46
  const plotW = width - left - right, plotH = height - top - bottom
  const groupW = plotW / Math.max(data.length, 1)
  const maxVal = Math.max(.01, ...data.map((row) => Math.max((row.alerts || 0) / Math.max(row.flows || 1, 1), (row.fsra_flags || 0) / Math.max(row.flows || 1, 1))))
  const yMax = Math.min(1, Math.max(.1, Math.ceil(maxVal * 10) / 10))
  const [hover, setHover] = React.useState(null)
  const yAt = (v) => top + plotH - (v / yMax) * plotH
  return <svg className="chart-svg run-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img">
    <defs><linearGradient id="runRateGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#62d8c5" stopOpacity=".95" /><stop offset="100%" stopColor="#62d8c5" stopOpacity=".36" /></linearGradient></defs>
    {Array.from({ length: 5 }, (_, i) => { const v = yMax * i / 4; const y = yAt(v); return <g key={i}><line x1={left} y1={y} x2={width-right} y2={y} stroke="rgba(119,149,181,.10)" /><text x={left-8} y={y+3} textAnchor="end" fill="#718398" fontSize="9">{(v*100).toFixed(0)}%</text></g> })}
    {data.map((row, i) => {
      const alertRate = (row.alerts || 0) / Math.max(row.flows || 1, 1)
      const fsraRate = (row.fsra_flags || 0) / Math.max(row.flows || 1, 1)
      const gx = left + i * groupW + groupW/2
      const barW = Math.min(46, groupW * .28)
      const h = (alertRate / yMax) * plotH
      const x = gx - barW/2
      return <g key={row.organization_id}>
        <rect x={x} y={yAt(alertRate)} width={barW} height={Math.max(2,h)} rx="7" fill="url(#runRateGradient)" onMouseEnter={() => setHover({ label: row.organization_name, lines: [`Alert rate: ${(alertRate*100).toFixed(1)}%`, `FSRA rate: ${(fsraRate*100).toFixed(1)}%`, `Alerts: ${row.alerts}`, `FSRA: ${row.fsra_flags}`] })} onMouseLeave={() => setHover(null)} />
        <circle cx={gx} cy={yAt(fsraRate)} r="5" fill="#65a9e6" stroke="#07111c" strokeWidth="2" />
        <text x={gx} y={height-19} textAnchor="middle" fill="#74879b" fontSize="9">{row.organization_name?.replace('Organization ', 'Org ') || row.organization_id}</text>
      </g>
    })}
    {hover && <ChartTooltipText x={Math.min(480, width-205)} y={22} lines={[hover.label, ...hover.lines]} />}
    <g transform={`translate(${width-190},${height-18})`}><rect width="9" height="9" rx="2" fill="#62d8c5" /><text x="14" y="8" fill="#76899d" fontSize="9">alert rate</text><circle cx="82" cy="4" r="4" fill="#65a9e6" /><text x="92" y="8" fill="#76899d" fontSize="9">FSRA rate</text></g>
  </svg>
}

function RunOutcomeChart({ total, benign, neuralOnly, fsra }) {
  const segments = [
    { label: 'Benign / not flagged', value: benign, color: '#31465a' },
    { label: 'Neural-only', value: neuralOnly, color: '#65a9e6' },
    { label: 'FSRA-confirmed', value: fsra, color: '#62d8c5' },
  ]
  const safeTotal = Math.max(total, 1)
  let acc = 0
  const cx = 250, cy = 125, r = 74, inner = 48
  const [hover, setHover] = React.useState(null)
  const polar = (angle, radius) => [cx + Math.cos(angle - Math.PI/2) * radius, cy + Math.sin(angle - Math.PI/2) * radius]
  const arcPath = (start, end) => {
    const large = end - start > Math.PI ? 1 : 0
    const [x1,y1] = polar(start, r), [x2,y2] = polar(end, r)
    const [ix2,iy2] = polar(end, inner), [ix1,iy1] = polar(start, inner)
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z`
  }
  return <div className="outcome-chart">
    <svg className="chart-svg" viewBox="0 0 520 250" role="img">
      {segments.map((seg) => {
        const start = acc * Math.PI * 2
        acc += seg.value / safeTotal
        const end = acc * Math.PI * 2
        return <path key={seg.label} d={seg.value ? arcPath(start,end) : ''} fill={seg.color} stroke="#08131f" strokeWidth="3" onMouseEnter={() => setHover(seg)} onMouseLeave={() => setHover(null)} />
      })}
      <circle cx={cx} cy={cy} r={inner-1} fill="#08131f" />
      <text x={cx} y={cy-4} textAnchor="middle" fill="#d6e6ef" fontSize="22" fontWeight="700">{formatNumber(total)}</text>
      <text x={cx} y={cy+13} textAnchor="middle" fill="#6f8195" fontSize="9">total flows</text>
      {hover && <text x={cx} y={214} textAnchor="middle" fill="#8ca0b2" fontSize="10">{hover.label}: {formatNumber(hover.value)} ({pct(hover.value/safeTotal,1)})</text>}
    </svg>
    <div className="outcome-legend">{segments.map((seg) => <div key={seg.label}><i style={{background:seg.color}} /><span>{seg.label}</span><strong>{formatNumber(seg.value)}</strong></div>)}</div>
  </div>
}

function RunRuleChart({ data }) {
  const width = 760, rowH = 42, height = Math.max(180, data.length * rowH + 54), left = 150, right = 68, top = 18
  const max = Math.max(1, ...data.map(([,count]) => count))
  return <svg className="chart-svg horizontal-bars" viewBox={`0 0 ${width} ${height}`} role="img">
    {data.length ? data.map(([ruleId,count], i) => {
      const y = top + i*rowH
      const w = ((count/max) * (width-left-right))
      return <g key={ruleId}>
        <text x={left-12} y={y+20} textAnchor="end" fill="#8da6b7" fontSize="9" fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">{ruleId}</text>
        <rect x={left} y={y+6} width={width-left-right} height="15" rx="7.5" fill="rgba(91,122,150,.12)" />
        <rect x={left} y={y+6} width={Math.max(4,w)} height="15" rx="7.5" fill="url(#ruleBar)" />
        <text x={Math.min(width-10,left+w+10)} y={y+19} fill="#c7d9e4" fontSize="10" fontWeight="650">{count}</text>
      </g>
    }) : <text x={width/2} y={80} textAnchor="middle" fill="#6d8094" fontSize="10">No FSRA rules fired in this run.</text>}
    <defs><linearGradient id="ruleBar" x1="0" x2="1"><stop offset="0%" stopColor="#65a9e6" /><stop offset="100%" stopColor="#62d8c5" /></linearGradient></defs>
  </svg>
}

function RunSeverityChart({ data }) {
  const total = Math.max(1, data.reduce((sum,row)=>sum+row.value,0))
  const width=760, height=250, left=48, top=28, plotH=height-top-42, max=Math.max(1,...data.map(row=>row.value))
  const [hover,setHover]=React.useState(null)
  return <div className="severity-chart-wrap"><svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img">
    {data.length ? data.map((row,i)=>{
      const groupW=(width-left-20)/data.length, barW=Math.min(70,groupW*.56), x=left+i*groupW+(groupW-barW)/2, h=(row.value/max)*(plotH-18), y=top+plotH-h
      const tone = row.name === 'CRITICAL' ? '#ef7e78' : row.name === 'HIGH' ? '#e0b35b' : row.name === 'MEDIUM' ? '#65a9e6' : '#62d8c5'
      return <g key={row.name}><rect x={x} y={y} width={barW} height={Math.max(4,h)} rx="8" fill={tone} fillOpacity=".88" onMouseEnter={()=>setHover(row)} onMouseLeave={()=>setHover(null)} /><text x={x+barW/2} y={height-19} textAnchor="middle" fill="#74879b" fontSize="9">{row.name}</text><text x={x+barW/2} y={y-7} textAnchor="middle" fill="#c4d4df" fontSize="10" fontWeight="650">{row.value}</text></g>
    }) : <text x={width/2} y={100} textAnchor="middle" fill="#6d8094" fontSize="10">No alerts to classify.</text>}
    {hover && <text x={width/2} y={18} textAnchor="middle" fill="#8ea2b3" fontSize="9">{hover.name}: {hover.value} alerts ({pct(hover.value/total,1)})</text>}
  </svg><div className="severity-total"><strong>{formatNumber(total)}</strong><span>total alerts</span></div></div>
}

function InsightTile({ label, value, detail, accent, danger }) { return <div className={`insight-tile ${accent ? 'accent' : ''} ${danger ? 'danger' : ''}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }

function MetricCard({ title, value, icon, accent }) { return <div className={`metric-card ${accent ? 'accent' : ''}`}><div className="metric-icon">{icon}</div><div><span>{title}</span><strong>{value}</strong></div></div> }
function DetailBlock({ title, children }) { return <div className="detail-block"><div className="detail-title">{title}</div>{children}</div> }
function formatBound(value) { return value === null || value === undefined ? '∞' : Number(value).toFixed(4) }

function AlertCard({ alert, expanded, onToggle }) {
  return <article className={`alert-card ${expanded ? 'expanded' : ''}`}><div className="alert-main" onClick={onToggle}><div className="severity-block"><div className={severityClass(alert.severity)}>{alert.severity}</div><div className="alert-verdict">{verdictLabel(alert)}</div></div><div className="alert-center"><div className="alert-title-line"><strong>{alert.fsra_rule_id || 'NEURAL-SIGNAL'}</strong><span>{alert.mitre_id || 'No ATT&CK mapping'}</span></div><div className="alert-technique">{alert.mitre_technique || 'Neural channel anomaly'}</div><div className="alert-meta">Observed: {alert.organization_name} · Source file: {alert.source_filename} · Flow #{alert.flow_index + 1}</div></div><div className="alert-score"><span>Confidence</span><strong>{pct(alert.confidence_score)}</strong></div><ChevronDown className={expanded ? 'chevron open' : 'chevron'} size={19} /></div>{expanded && <div className="alert-detail"><div className="detail-grid"><DetailBlock title="Neural channel"><div className="detail-row"><span>Positive score</span><strong>{pct(alert.neural_score)}</strong></div><div className="detail-row"><span>Decision</span><strong>{alert.neural_flag ? 'Flagged' : 'Below threshold'}</strong></div></DetailBlock><DetailBlock title="FSRA reasoning"><div className="detail-row"><span>Rule</span><strong>{alert.fsra_rule_id || '—'}</strong></div><div className="detail-row"><span>Consensus</span><strong>{alert.consensus_tier || '—'}</strong></div><div className="detail-row"><span>Contributors</span><strong>{alert.contributing_organizations?.join(', ') || '—'}</strong></div></DetailBlock><DetailBlock title="MITRE ATT&CK"><div className="detail-row"><span>Technique</span><strong>{alert.mitre_id || '—'}</strong></div><div className="detail-row"><span>Name</span><strong>{alert.mitre_technique || '—'}</strong></div><div className="detail-row"><span>Family</span><strong>{alert.attack_family || '—'}</strong></div></DetailBlock><DetailBlock title="Response playbook"><div className="playbook-title">{alert.playbook?.title || 'Investigate neural signal'}</div><div className="playbook-action">{alert.playbook?.action || 'Inspect the affected flow and surrounding telemetry.'}</div></DetailBlock></div>{alert.conditions_satisfied?.length > 0 && <div className="conditions"><div className="conditions-title">Standardized FSRA conditions satisfied</div><div className="condition-table">{alert.conditions_satisfied.map((condition, index) => <div className="condition-row" key={`${condition.feature}-${index}`}><span>{condition.feature}</span><code>{Number(condition.value).toFixed(4)}</code><span>&gt; {formatBound(condition.min)}</span><span>≤ {formatBound(condition.max)}</span></div>)}</div></div>}{alert.notes?.length > 0 && <div className="alert-note"><AlertTriangle size={15} /><span>{alert.notes.join(' ')}</span></div>}<div className="feature-snapshot"><div className="conditions-title">Raw flow snapshot</div><div className="snapshot-grid">{Object.entries(alert.feature_snapshot || {}).map(([k, v]) => <div key={k}><span>{k}</span><strong>{Number(v).toFixed(4)}</strong></div>)}</div></div></div>}</article>
}

function ChartFrame({ title, subtitle, children, right }) { return <section className="chart-card"><div className="chart-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{right}</div><div className="chart-body">{children}</div></section> }
function ChartTooltip({ active, payload, label, percentKeys = [] }) { if (!active || !payload?.length) return null; return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((item) => <div key={item.dataKey}><span>{item.name}</span><b>{percentKeys.includes(item.dataKey) ? pct(item.value, 2) : Number(item.value).toFixed(3)}</b></div>)}</div> }


function ChartTooltipText({ x, y, lines }) {
  return <g transform={`translate(${x},${y})`}>
    <rect x="0" y="0" width="190" height={22 + lines.length * 18} rx="8" fill="#07101a" stroke="rgba(124,158,187,.24)" />
    {lines.map((line, i) => <text key={i} x="10" y={18 + i * 18} fill={i === 0 ? '#c9d9e5' : '#8ba0b2'} fontSize={i === 0 ? 10 : 9}>{line}</text>)}
  </g>
}

function BarChartSvg({ data, series, yMax = 1, height = 300, xKey, bottomSpace = 55 }) {
  const width = 760; const left = 42; const right = 14; const top = 18; const bottom = bottomSpace;
  const plotW = width - left - right; const plotH = height - top - bottom;
  const groupW = plotW / Math.max(data.length, 1); const barW = Math.min(34, groupW / (series.length + 1));
  const ticks = 5; const [hover, setHover] = React.useState(null);
  return <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img">
    {Array.from({ length: ticks + 1 }, (_, i) => { const v = (yMax / ticks) * i; const y = top + plotH - (v / yMax) * plotH; return <g key={i}><line x1={left} y1={y} x2={width-right} y2={y} stroke="rgba(119,149,181,.10)" /><text x={left-7} y={y+3} textAnchor="end" fill="#718398" fontSize="9">{Math.round(v*100)}%</text></g> })}
    {data.map((row, i) => { const gx = left + i * groupW + groupW/2; return <g key={i}>{series.map((ser, j) => { const value = Number(row[ser.key] || 0); const h = Math.max(0, (value / yMax) * plotH); const x = gx - (series.length * barW)/2 + j*barW + 1; const y = top + plotH - h; return <g key={ser.key}><rect x={x} y={y} width={barW-2} height={h} rx="4" fill={ser.color} onMouseEnter={() => setHover({x: Math.min(x, width-205), y: Math.max(6, y-8), label: row[xKey], lines: [row[xKey], `${ser.name}: ${(value*100).toFixed(2)}%`]})} onMouseLeave={() => setHover(null)}><title>{`${row[xKey]} — ${ser.name}: ${(value*100).toFixed(2)}%`}</title></rect></g> })}<text x={gx} y={height-22} textAnchor="middle" fill="#74879b" fontSize="9" transform={`rotate(-14 ${gx} ${height-22})`}>{row[xKey]}</text></g> })}
    {hover && <ChartTooltipText {...hover} />}
  </svg>
}

function LineChartSvg({ data, series, yMin = 0, yMax = 1, height = 300, xKey }) {
  const width = 760; const left = 42; const right = 18; const top = 18; const bottom = 38; const plotW = width-left-right; const plotH = height-top-bottom;
  const [hover, setHover] = React.useState(null);
  const xAt = (i) => left + (data.length <= 1 ? plotW/2 : (i/(data.length-1))*plotW);
  const yAt = (v) => top + plotH - ((v-yMin)/(yMax-yMin))*plotH;
  const ticks = 5;
  return <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img">
    {Array.from({length:ticks+1},(_,i)=>{ const v=yMin + (yMax-yMin)*i/ticks; const y=yAt(v); return <g key={i}><line x1={left} y1={y} x2={width-right} y2={y} stroke="rgba(119,149,181,.10)"/><text x={left-7} y={y+3} textAnchor="end" fill="#718398" fontSize="9">{Math.round(v*100)}%</text></g> })}
    <line x1={left} y1={top+plotH} x2={width-right} y2={top+plotH} stroke="rgba(119,149,181,.18)" />
    {data.map((row,i)=><text key={i} x={xAt(i)} y={height-16} textAnchor="middle" fill="#74879b" fontSize="9">{row[xKey]}</text>)}
    {series.map((ser)=>{ const points=data.map((row,i)=>`${xAt(i)},${yAt(Number(row[ser.key]||0))}`).join(' '); return <g key={ser.key}><polyline points={points} fill="none" stroke={ser.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />{data.map((row,i)=>{const x=xAt(i),y=yAt(Number(row[ser.key]||0)); return <circle key={i} cx={x} cy={y} r="4" fill={ser.color} onMouseEnter={()=>setHover({x:Math.min(x+8,width-205), y:Math.max(6,y-8), lines:[`${xKey}: ${row[xKey]}`, `${ser.name}: ${(Number(row[ser.key])*100).toFixed(2)}%`]})} onMouseLeave={()=>setHover(null)}><title>{`${row[xKey]} — ${ser.name}: ${(Number(row[ser.key])*100).toFixed(2)}%`}</title></circle>})}</g> })}
    {hover && <ChartTooltipText {...hover} />}
  </svg>
}

function LegendSwatches({ series }) { return <div className="svg-legend">{series.map((s)=><span key={s.key}><i style={{background:s.color}} />{s.name}</span>)}</div> }

function AnalysisTab({ research, loading }) {
  if (loading || !research) return <main className="content-area"><div className="analysis-loading"><RefreshCw className="spin" size={22} /><div><strong>Loading frozen research metrics…</strong><span>Reading local Phase 1–6 analysis artifacts.</span></div></div></main>
  const sys = research.final_system_comparison
  const natural = research.natural_silo
  const dir = research.dirichlet
  const perSilo = research.per_silo_fedprox
  const rules = research.fsra_rules
  const corr = research.corroboration
  const privacy = research.privacy
  const data = research.data

  const domainGain = (sys[5].attack_f1 - sys[2].attack_f1) * 100
  const aucGain = (sys[5].roc_auc - sys[2].roc_auc)
  const fedProxGain = (natural[1].attack_f1_mean - natural[0].attack_f1_mean) * 100

  return <main className="content-area analysis-page">
    <section className="section-head analysis-head"><div><div className="section-kicker">RESEARCH ANALYSIS</div><h2>Frozen experiment dashboard</h2><p>These charts summarize the accepted Phase 1–6 research results. They are separate from any live demo run on uploaded CSVs.</p></div><div className="research-badge"><FlaskConical size={15} /> Research artifact view</div></section>

    <section className="analysis-summary-grid">
      <AnalysisStat icon={<Target size={18} />} label="Frozen test population" value={formatNumber(data.frozen_test_flows)} detail="flows" />
      <AnalysisStat icon={<GitCompareArrows size={18} />} label="FedProx vs FedAvg" value={`+${fedProxGain.toFixed(1)} pp`} detail="natural-silo attack F1" accent />
      <AnalysisStat icon={<BarChart3 size={18} />} label="FedReason vs FedProx" value={`+${domainGain.toFixed(2)} pp`} detail="attack F1, domain-calibrated" accent />
      <AnalysisStat icon={<Network size={18} />} label="FSRA ranking gain" value={`+${aucGain.toFixed(3)}`} detail="pooled ROC-AUC" />
      <AnalysisStat icon={<Layers3 size={18} />} label="Active FSRA rules" value={`${research.explainability.active_rules}/20`} detail="catalogue → active" />
      <AnalysisStat icon={<LockKeyhole size={18} />} label="MIA AUC" value={privacy.membership_inference.auc.toFixed(4)} detail="near-chance tested attack" />
    </section>

    <div className="chart-grid two-col">
      <ChartFrame title="Final system comparison" subtitle="Attack F1 and ROC-AUC across the main pooled configurations.">
        <BarChartSvg data={sys} xKey="name" series={[{key:"attack_f1",name:"Attack F1",color:RESEARCH_PALETTE.primary},{key:"roc_auc",name:"ROC-AUC",color:RESEARCH_PALETTE.secondary}]} height={320} />
        <LegendSwatches series={[{key:"attack_f1",name:"Attack F1",color:RESEARCH_PALETTE.primary},{key:"roc_auc",name:"ROC-AUC",color:RESEARCH_PALETTE.secondary}]} />
      </ChartFrame>

      <ChartFrame title="Natural-silo federation" subtitle="Three-seed mean attack F1 with standard deviation shown in the tooltip.">
        <BarChartSvg data={natural} xKey="method" yMax={0.6} series={[{key:"attack_f1_mean",name:"Attack F1 mean",color:RESEARCH_PALETTE.primary}]} height={320} />
        <div className="chart-footnote">FedAvg 40.7 ± 5.6% · FedProx 49.2 ± 4.4% attack F1</div>
      </ChartFrame>

      <ChartFrame title="Dirichlet non-IID robustness" subtitle="Lower α represents stronger label skew; Attack F1 is the three-seed mean.">
        <LineChartSvg data={dir} xKey="alpha" yMin={0.65} yMax={0.95} series={[{key:"fedavg",name:"FedAvg",color:RESEARCH_PALETTE.secondary},{key:"fedprox",name:"FedProx",color:RESEARCH_PALETTE.primary},{key:"fedreason",name:"FedReason",color:RESEARCH_PALETTE.tertiary}]} height={320} />
        <LegendSwatches series={[{key:"fedavg",name:"FedAvg",color:RESEARCH_PALETTE.secondary},{key:"fedprox",name:"FedProx",color:RESEARCH_PALETTE.primary},{key:"fedreason",name:"FedReason",color:RESEARCH_PALETTE.tertiary}]} />
        <div className="chart-footnote">At α = 0.1: FedAvg 75.12 ± 18.88% · FedProx 82.77 ± 5.67% · FedReason 81.73 ± 5.50%</div>
      </ChartFrame>

      <ChartFrame title="FedProx per-silo diagnostics" subtitle="Seed-42 results show the cross-silo calibration problem clearly.">
        <BarChartSvg data={perSilo} xKey="silo" series={[{key:"precision",name:"Precision",color:RESEARCH_PALETTE.tertiary},{key:"recall",name:"Recall",color:RESEARCH_PALETTE.secondary},{key:"attack_f1",name:"Attack F1",color:RESEARCH_PALETTE.primary}]} height={320} />
        <LegendSwatches series={[{key:"precision",name:"Precision",color:RESEARCH_PALETTE.tertiary},{key:"recall",name:"Recall",color:RESEARCH_PALETTE.secondary},{key:"attack_f1",name:"Attack F1",color:RESEARCH_PALETTE.primary}]} />
        <div className="chart-footnote">UNSW: 97.0% recall at 14.5% precision · IoT: 98.1% precision at 40.3% recall</div>
      </ChartFrame>

      <ChartFrame title="Active FSRA rule profile" subtitle="Validation precision versus validation coverage for the three locked active rules.">
        <BarChartSvg data={rules} xKey="rule" yMax={1} series={[{key:"precision",name:"Fused precision",color:RESEARCH_PALETTE.primary},{key:"validation_coverage",name:"Validation coverage",color:RESEARCH_PALETTE.secondary}]} height={320} />
        <LegendSwatches series={[{key:"precision",name:"Fused precision",color:RESEARCH_PALETTE.primary},{key:"validation_coverage",name:"Validation coverage",color:RESEARCH_PALETTE.secondary}]} />
        <div className="chart-footnote">Coverage bars are shown on the same 0–100% visual scale; hover each bar for the exact value.</div>
      </ChartFrame>

      <ChartFrame title="Corroboration sensitivity" subtitle="Increasing the minimum number of contributing silos leaves only one active rule.">
        <LineChartSvg data={corr} xKey="k_min" yMin={0} yMax={0.85} series={[{key:"symbolic_f1",name:"Symbolic F1",color:RESEARCH_PALETTE.tertiary},{key:"dual_f1",name:"Dual-channel F1",color:RESEARCH_PALETTE.primary},{key:"dual_auc",name:"Dual ROC-AUC",color:RESEARCH_PALETTE.secondary}]} height={320} />
        <LegendSwatches series={[{key:"symbolic_f1",name:"Symbolic F1",color:RESEARCH_PALETTE.tertiary},{key:"dual_f1",name:"Dual-channel F1",color:RESEARCH_PALETTE.primary},{key:"dual_auc",name:"Dual ROC-AUC",color:RESEARCH_PALETTE.secondary}]} />
        <div className="chart-footnote">k=1: 3 active rules · k=2/3: 1 active rule · symbolic F1 31.16% → 3.85%</div>
      </ChartFrame>
    </div>

    <section className="analysis-lower-grid">
      <ChartFrame title="Attack-rate profile across datasets" subtitle="Why accuracy alone is insufficient in this evaluation.">
        <BarChartSvg data={data.datasets} xKey="dataset" series={[{key:"attack_rate",name:"Attack rate",color:RESEARCH_PALETTE.primary}]} height={270} />
      </ChartFrame>

      <section className="chart-card privacy-card"><div className="chart-head"><div><h3>Privacy audit</h3><p>Empirical attack results against the frozen FedProx neural model.</p></div><LockKeyhole size={18} className="panel-icon" /></div><div className="privacy-grid"><div className="privacy-stat"><span>Membership inference AUC</span><strong>{privacy.membership_inference.auc.toFixed(4)}</strong><small>advantage {privacy.membership_inference.advantage.toFixed(4)}</small></div>{privacy.gradient_inversion.map((item) => <div className="privacy-stat" key={item.batch}><span>Gradient inversion · B={item.batch}</span><strong>cos {item.cosine.toFixed(4)}</strong><small>MSE {item.mse.toFixed(3)}</small></div>)}</div><div className="analysis-warning"><AlertTriangle size={15} /><span>These are empirical observations, not a formal differential-privacy guarantee.</span></div></section>
    </section>

    <section className="analysis-notes"><div className="panel-head"><div><h3>How to interpret this dashboard</h3><p>Use the numbers as research evidence, not as claims beyond the measured experiments.</p></div></div>{research.notes.map((note) => <div className="analysis-note" key={note}><CheckCircle2 size={14} />{note}</div>)}</section>
  </main>
}

function AnalysisStat({ icon, label, value, detail, accent }) { return <div className={`analysis-stat ${accent ? 'accent' : ''}`}><div className="analysis-stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }

createRoot(document.getElementById('root')).render(<App />)
