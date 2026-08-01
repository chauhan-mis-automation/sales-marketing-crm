import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DEFAULT_TAT_TARGETS, parseHrs, buildEnquiryLevelRecords, fmtHrs } from '../lib/tatHelpers'
import './queues/QueuePages.css'
import './TeamPerformance.css'

const TABS = [
  { key: 'backend', label: 'Backend Team', icon: '🗂', color: '#6d28d9' },
  { key: 'frontend', label: 'Frontend Team', icon: '💼', color: '#0369a1' },
  { key: 'design', label: 'Designer Team', icon: '📐', color: '#0d9488' },
  { key: 'followup', label: 'Follow-up Team', icon: '🔔', color: '#b45309' },
]

function computeTat(rows, config, target) {
  const records = buildEnquiryLevelRecords(rows, config)
  const completed = records.filter(r => r.hrs !== null)
  const onTime = completed.filter(r => r.hrs <= target).length
  const late = completed.length - onTime
  const pending = records.length - completed.length
  const avgHrs = completed.length ? completed.reduce((s, r) => s + r.hrs, 0) / completed.length : null
  const pct = completed.length ? Math.round((onTime / completed.length) * 100) : 0
  return { onTime, late, pending, avgHrs, pct, completed: completed.length }
}

function rankMedal(i) {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return null
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <div className="tp-summary-card" style={{ borderTopColor: color }}>
      <div className="tp-summary-icon" style={{ background: `${color}18`, color }}>{icon}</div>
      <div className="tp-summary-val" style={{ color }}>{value}</div>
      <div className="tp-summary-lbl">{label}</div>
    </div>
  )
}

function ProgressCell({ pct, color }) {
  return (
    <div className="tp-progress-row">
      <div className="tp-progress-bar"><div className="tp-progress-fill" style={{ width: `${pct}%`, background: color }}></div></div>
      <span style={{ color, fontWeight: 800, fontSize: 12 }}>{pct}%</span>
    </div>
  )
}

export default function TeamPerformance() {
  const [tab, setTab] = useState('backend')
  const [loading, setLoading] = useState(true)

  const [users, setUsers] = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [fcTasks, setFcTasks] = useState([])
  const [qtTasks, setQtTasks] = useState([])
  const [gaTasks, setGaTasks] = useState([])
  const [woTasks, setWoTasks] = useState([])
  const [callHistory, setCallHistory] = useState([])
  const [targets, setTargets] = useState(DEFAULT_TAT_TARGETS)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [
      { data: userRows },
      { data: enqRows },
      { data: fcRows },
      { data: qtRows },
      { data: gaRows },
      { data: woRows },
      { data: chRows },
      { data: ddRows },
    ] = await Promise.all([
      supabase.from('users').select('*').eq('active', true),
      supabase.from('enquiries').select('*'),
      supabase.from('flowchart_tasks').select('*'),
      supabase.from('quotation_versions').select('*'),
      supabase.from('ga_drawing_tasks').select('*'),
      supabase.from('work_orders').select('*'),
      supabase.from('call_history').select('*'),
      supabase.from('dropdown_list').select('flowchart, quotation, ga_drawing, tat_admin_approval, work_order').order('id', { ascending: true }).limit(1),
    ])

    setUsers(userRows || [])
    setEnquiries(enqRows || [])
    setFcTasks(fcRows || [])
    setQtTasks(qtRows || [])
    setGaTasks(gaRows || [])
    setWoTasks(woRows || [])
    setCallHistory(chRows || [])

    const s = ddRows?.[0] || {}
    setTargets({
      flowchart: parseHrs(s.flowchart, DEFAULT_TAT_TARGETS.flowchart),
      quotation: parseHrs(s.quotation, DEFAULT_TAT_TARGETS.quotation),
      gaDrawing: parseHrs(s.ga_drawing, DEFAULT_TAT_TARGETS.gaDrawing),
      workOrder: parseHrs(s.work_order, DEFAULT_TAT_TARGETS.workOrder),
    })

    setLoading(false)
  }

  // ── Backend Team ─────────────────────────────────────────
  const backendRows = useMemo(() => {
    return users.filter(u => u.role === 'backend').map(u => {
      const myEnq = enquiries.filter(e => e.assign_to_backend === u.name)
      const myEnqIds = new Set(myEnq.map(e => e.enquiry_id))
      const myFc = fcTasks.filter(t => myEnqIds.has(t.enquiry_id))
      const myQt = qtTasks.filter(t => myEnqIds.has(t.enquiry_id))

      const fcApproved = myFc.filter(t => t.status === 'Client Approved').length
      const fcRevisions = myFc.filter(t => t.status === 'Client Revision Requested').length
      const won = myEnq.filter(e => e.status === 'Won').length
      const lost = myEnq.filter(e => e.status === 'Lost').length
      const closedCount = won + lost
      const winRate = closedCount > 0 ? Math.round((won / closedCount) * 100) : 0

      const tat = computeTat(myFc, { startField: 'assigned_date', endField: 'decision_date', successStatuses: ['Client Approved'], personField: 'assigned_to' }, targets.flowchart)

      return {
        name: u.name,
        totalEnq: myEnq.length,
        fcSent: myFc.length,
        fcApproved,
        fcRevisions,
        qtSent: myQt.length,
        won,
        lost,
        winRate,
        avgTat: tat.avgHrs,
        onTimePct: tat.pct,
      }
    }).sort((a, b) => b.totalEnq - a.totalEnq)
  }, [users, enquiries, fcTasks, qtTasks, targets])

  // ── Frontend Team ────────────────────────────────────────
  const frontendRows = useMemo(() => {
    return users.filter(u => u.role === 'frontend').map(u => {
      const myEnq = enquiries.filter(e => e.assign_to_frontend === u.name)
      const active = myEnq.filter(e => e.status === 'Active').length
      const won = myEnq.filter(e => e.status === 'Won')
      const lost = myEnq.filter(e => e.status === 'Lost').length
      const closedCount = won.length + lost
      const conversion = closedCount > 0 ? Math.round((won.length / closedCount) * 100) : 0
      const totalValue = won.reduce((s, e) => s + (e.final_order_value || 0), 0)
      const today = new Date().toISOString().slice(0, 10)
      const overdue = myEnq.filter(e => e.status === 'Active' && e.next_followup_date && e.next_followup_date < today).length
      const created = enquiries.filter(e => e.created_by === u.name).length

      return {
        name: u.name,
        totalEnq: myEnq.length,
        active,
        won: won.length,
        lost,
        conversion,
        totalValue,
        overdue,
        created,
      }
    }).sort((a, b) => b.totalValue - a.totalValue)
  }, [users, enquiries])

  // ── Designer Team ────────────────────────────────────────
  const designerRows = useMemo(() => {
    return users.filter(u => u.role === 'design').map(u => {
      const myGa = gaTasks.filter(t => t.assigned_to === u.name)
      const myWo = woTasks.filter(t => t.assigned_to === u.name)

      const gaApproved = myGa.filter(t => t.status === 'Client Approved').length
      const gaRejected = myGa.filter(t => t.status === 'Rejected by Admin' || t.status === 'Client Revision Requested').length
      const woApproved = myWo.filter(t => t.status === 'Approved').length
      const woRejected = myWo.filter(t => t.status === 'Rejected').length
      const revisionCount = myGa.reduce((s, t) => s + (t.revision_count || 0), 0) + myWo.reduce((s, t) => s + (t.revision_count || 0), 0)

      const gaTat = computeTat(myGa, { startField: 'assigned_date', endField: 'client_approved_date', successStatuses: ['Client Approved'], personField: 'assigned_to' }, targets.gaDrawing)
      const woTat = computeTat(myWo, { startField: 'assigned_date', endField: 'admin_review_date', successStatuses: ['Approved'], personField: 'assigned_to' }, targets.workOrder)

      const totalCompleted = gaTat.completed + woTat.completed
      const totalOnTime = gaTat.onTime + woTat.onTime
      const onTimePct = totalCompleted > 0 ? Math.round((totalOnTime / totalCompleted) * 100) : 0

      return {
        name: u.name,
        gaAssigned: myGa.length,
        gaApproved,
        gaRejected,
        woAssigned: myWo.length,
        woApproved,
        woRejected,
        revisionCount,
        onTimePct,
      }
    }).sort((a, b) => (b.gaAssigned + b.woAssigned) - (a.gaAssigned + a.woAssigned))
  }, [users, gaTasks, woTasks, targets])

  // ── Follow-up Team ───────────────────────────────────────
  const followupRows = useMemo(() => {
    return users.filter(u => u.role === 'followup').map(u => {
      const myCalls = callHistory.filter(c => c.logged_by === u.name)
      const distinctEnquiries = new Set(myCalls.map(c => c.enquiry_id)).size
      const lastCall = myCalls.length > 0
        ? myCalls.reduce((latest, c) => new Date(c.date) > new Date(latest.date) ? c : latest, myCalls[0])
        : null

      return {
        name: u.name,
        callsLogged: myCalls.length,
        enquiriesContacted: distinctEnquiries,
        lastCallDate: lastCall?.date || null,
      }
    }).sort((a, b) => b.callsLogged - a.callsLogged)
  }, [users, callHistory])

  if (loading) {
    return <div className="tp-loading"><i className="fas fa-spinner fa-spin"></i> Loading team performance…</div>
  }

  const activeTab = TABS.find(t => t.key === tab)

  return (
    <div className="tp-wrap">
      <p className="tp-subtitle">Team-wide work summary across Backend, Frontend, Designer &amp; Follow-up teams</p>

      <div className="tp-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tp-tab ${tab === t.key ? 'active' : ''}`}
            style={tab === t.key ? { background: t.color, borderColor: t.color } : {}}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'backend' && (
        <>
          <div className="tp-summary-grid">
            <SummaryCard icon="📥" label="Total Assigned Enquiries" value={backendRows.reduce((s, r) => s + r.totalEnq, 0)} color="#6d28d9" />
            <SummaryCard icon="🗂" label="Flowcharts Sent" value={backendRows.reduce((s, r) => s + r.fcSent, 0)} color="#0369a1" />
            <SummaryCard icon="💰" label="Quotations Sent" value={backendRows.reduce((s, r) => s + r.qtSent, 0)} color="#0d9488" />
            <SummaryCard icon="🏆" label="Overall Win Rate" value={`${(() => { const w = backendRows.reduce((s, r) => s + r.won, 0); const l = backendRows.reduce((s, r) => s + r.lost, 0); return w + l > 0 ? Math.round((w / (w + l)) * 100) : 0 })()}%`} color="#059669" />
          </div>

          <div className="tp-table-card">
            <div className="tp-table-wrap">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Rank</th><th>Name</th><th>Enquiries</th><th>Flowchart Sent</th><th>Approved</th><th>Revisions</th>
                    <th>Quotations</th><th>Won / Lost</th><th>Win Rate</th><th>Avg TAT</th><th>On-Time %</th>
                  </tr>
                </thead>
                <tbody>
                  {backendRows.length === 0 ? (
                    <tr><td colSpan={11} className="tp-empty">No backend team members found</td></tr>
                  ) : (
                    backendRows.map((r, i) => (
                      <tr key={r.name} style={{ animationDelay: `${i * 40}ms` }}>
                        <td className="tp-rank">{rankMedal(i) || `#${i + 1}`}</td>
                        <td>
                          <div className="tp-person-cell">
                            <div className="tp-avatar" style={{ background: activeTab.color }}>{r.name.charAt(0).toUpperCase()}</div>
                            <strong>{r.name}</strong>
                          </div>
                        </td>
                        <td className="tp-num">{r.totalEnq}</td>
                        <td className="tp-num">{r.fcSent}</td>
                        <td className="tp-num tp-green">{r.fcApproved}</td>
                        <td className="tp-num tp-rose">{r.fcRevisions}</td>
                        <td className="tp-num">{r.qtSent}</td>
                        <td className="tp-num"><span className="tp-green">{r.won}</span> / <span className="tp-rose">{r.lost}</span></td>
                        <td style={{ minWidth: 100 }}><ProgressCell pct={r.winRate} color="#059669" /></td>
                        <td className="tp-mono">{r.avgTat !== null ? fmtHrs(r.avgTat) : '—'}</td>
                        <td style={{ minWidth: 100 }}><ProgressCell pct={r.onTimePct} color="#0369a1" /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'frontend' && (
        <>
          <div className="tp-summary-grid">
            <SummaryCard icon="📥" label="Total Enquiries" value={frontendRows.reduce((s, r) => s + r.totalEnq, 0)} color="#0369a1" />
            <SummaryCard icon="🏆" label="Total Won" value={frontendRows.reduce((s, r) => s + r.won, 0)} color="#059669" />
            <SummaryCard icon="💰" label="Total Order Value" value={`₹${frontendRows.reduce((s, r) => s + r.totalValue, 0).toLocaleString('en-IN')}`} color="#b45309" />
            <SummaryCard icon="📈" label="Overall Conversion" value={`${(() => { const w = frontendRows.reduce((s, r) => s + r.won, 0); const l = frontendRows.reduce((s, r) => s + r.lost, 0); return w + l > 0 ? Math.round((w / (w + l)) * 100) : 0 })()}%`} color="#7c3aed" />
          </div>

          <div className="tp-table-card">
            <div className="tp-table-wrap">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Rank</th><th>Name</th><th>Enquiries</th><th>Active</th><th>Won / Lost</th>
                    <th>Conversion</th><th>Order Value</th><th>Overdue</th><th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {frontendRows.length === 0 ? (
                    <tr><td colSpan={9} className="tp-empty">No frontend team members found</td></tr>
                  ) : (
                    frontendRows.map((r, i) => (
                      <tr key={r.name} style={{ animationDelay: `${i * 40}ms` }}>
                        <td className="tp-rank">{rankMedal(i) || `#${i + 1}`}</td>
                        <td>
                          <div className="tp-person-cell">
                            <div className="tp-avatar" style={{ background: activeTab.color }}>{r.name.charAt(0).toUpperCase()}</div>
                            <strong>{r.name}</strong>
                          </div>
                        </td>
                        <td className="tp-num">{r.totalEnq}</td>
                        <td className="tp-num">{r.active}</td>
                        <td className="tp-num"><span className="tp-green">{r.won}</span> / <span className="tp-rose">{r.lost}</span></td>
                        <td style={{ minWidth: 100 }}><ProgressCell pct={r.conversion} color="#7c3aed" /></td>
                        <td className="tp-mono">₹{r.totalValue.toLocaleString('en-IN')}</td>
                        <td className="tp-num">{r.overdue > 0 ? <span className="tp-rose">{r.overdue}</span> : 0}</td>
                        <td className="tp-num">{r.created}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'design' && (
        <>
          <div className="tp-summary-grid">
            <SummaryCard icon="📐" label="GA Drawings Assigned" value={designerRows.reduce((s, r) => s + r.gaAssigned, 0)} color="#0d9488" />
            <SummaryCard icon="📋" label="Work Orders Assigned" value={designerRows.reduce((s, r) => s + r.woAssigned, 0)} color="#059669" />
            <SummaryCard icon="🔄" label="Total Revisions" value={designerRows.reduce((s, r) => s + r.revisionCount, 0)} color="#b45309" />
            <SummaryCard icon="✅" label="Overall Approval Rate" value={`${(() => { const a = designerRows.reduce((s, r) => s + r.gaApproved + r.woApproved, 0); const t = designerRows.reduce((s, r) => s + r.gaAssigned + r.woAssigned, 0); return t > 0 ? Math.round((a / t) * 100) : 0 })()}%`} color="#7c3aed" />
          </div>

          <div className="tp-table-card">
            <div className="tp-table-wrap">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Rank</th><th>Name</th><th>GA Assigned</th><th>GA Approved</th><th>GA Rejected</th>
                    <th>WO Assigned</th><th>WO Approved</th><th>WO Rejected</th><th>Revisions</th><th>On-Time %</th>
                  </tr>
                </thead>
                <tbody>
                  {designerRows.length === 0 ? (
                    <tr><td colSpan={10} className="tp-empty">No designer team members found</td></tr>
                  ) : (
                    designerRows.map((r, i) => (
                      <tr key={r.name} style={{ animationDelay: `${i * 40}ms` }}>
                        <td className="tp-rank">{rankMedal(i) || `#${i + 1}`}</td>
                        <td>
                          <div className="tp-person-cell">
                            <div className="tp-avatar" style={{ background: activeTab.color }}>{r.name.charAt(0).toUpperCase()}</div>
                            <strong>{r.name}</strong>
                          </div>
                        </td>
                        <td className="tp-num">{r.gaAssigned}</td>
                        <td className="tp-num tp-green">{r.gaApproved}</td>
                        <td className="tp-num tp-rose">{r.gaRejected}</td>
                        <td className="tp-num">{r.woAssigned}</td>
                        <td className="tp-num tp-green">{r.woApproved}</td>
                        <td className="tp-num tp-rose">{r.woRejected}</td>
                        <td className="tp-num tp-amber">{r.revisionCount}</td>
                        <td style={{ minWidth: 100 }}><ProgressCell pct={r.onTimePct} color="#0d9488" /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'followup' && (
        <>
          <div className="tp-summary-grid">
            <SummaryCard icon="📞" label="Total Calls Logged" value={followupRows.reduce((s, r) => s + r.callsLogged, 0)} color="#b45309" />
            <SummaryCard icon="📬" label="Total Enquiries Contacted" value={new Set(callHistory.map(c => c.enquiry_id)).size} color="#0369a1" />
            <SummaryCard icon="👥" label="Active Follow-up Team" value={followupRows.length} color="#059669" />
          </div>

          <div className="tp-table-card">
            <div className="tp-table-wrap">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Rank</th><th>Name</th><th>Calls Logged</th><th>Enquiries Contacted</th><th>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {followupRows.length === 0 ? (
                    <tr><td colSpan={5} className="tp-empty">No follow-up team members found</td></tr>
                  ) : (
                    followupRows.map((r, i) => (
                      <tr key={r.name} style={{ animationDelay: `${i * 40}ms` }}>
                        <td className="tp-rank">{rankMedal(i) || `#${i + 1}`}</td>
                        <td>
                          <div className="tp-person-cell">
                            <div className="tp-avatar" style={{ background: activeTab.color }}>{r.name.charAt(0).toUpperCase()}</div>
                            <strong>{r.name}</strong>
                          </div>
                        </td>
                        <td className="tp-num">{r.callsLogged}</td>
                        <td className="tp-num">{r.enquiriesContacted}</td>
                        <td className="tp-mono">{r.lastCallDate ? new Date(r.lastCallDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
