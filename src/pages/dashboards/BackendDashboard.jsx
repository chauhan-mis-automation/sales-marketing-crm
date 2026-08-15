import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useDateRangeFilter } from '../../lib/useDateRangeFilter'
import { DEFAULT_TAT_TARGETS, hrsDiff, fmtHrs, parseHrs } from '../../lib/tatHelpers'
import { formatDateDisplay } from '../../lib/dateHelpers'
import DateFilterBar from '../../components/DateFilterBar'
import WorkQueueCard from '../../components/WorkQueueCard'
import '../dashboards/StandardDashboard.css'
import './BackendDashboard.css'

// current_stage values that mean "backend needs to do something right now"
const ACTION_STAGES = {
  'Assigned': { label: 'Create Flowchart', icon: '🗂', color: '#6d28d9' },
  'Client Want Flowchart Revision': { label: 'Revise Flowchart', icon: '🔄', color: '#be123c' },
  'Received Confirmation on Flow Chart': { label: 'Send Quotation', icon: '💰', color: '#0369a1' },
  'Client Want Quotation Revision': { label: 'Revise Quotation', icon: '🔄', color: '#be123c' },
}

function computeModuleStats(rows, approvedStatus, awaitingStatus, revisedStatus) {
  const total = rows.length
  const approved = rows.filter(r => r.status === approvedStatus).length
  const awaiting = awaitingStatus ? rows.filter(r => r.status === awaitingStatus).length : 0
  const revised = revisedStatus ? rows.filter(r => r.status === revisedStatus).length : 0
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0
  return { total, approved, awaiting, revised, pct }
}

function ModuleCard({ icon, name, color, stats }) {
  return (
    <div className="bd-module-card" style={{ borderTopColor: color }}>
      <div className="bd-module-header">
        <span className="bd-module-name">{icon} {name}</span>
        <span className="bd-module-total" style={{ background: `${color}18`, color }}>{stats.total} total</span>
      </div>
      <div className="bd-module-stats">
        <div>
          <div className="bd-module-num" style={{ color: '#059669' }}>{stats.approved}</div>
          <div className="bd-module-lbl">Client Approved</div>
        </div>
        <div>
          <div className="bd-module-num" style={{ color: '#be123c' }}>{stats.awaiting}</div>
          <div className="bd-module-lbl">Pending Decision</div>
        </div>
        <div>
          <div className="bd-module-num" style={{ color: '#be123c' }}>{stats.revised}</div>
          <div className="bd-module-lbl">Had Revisions</div>
        </div>
      </div>
      <div className="bd-module-bar-row">
        <div className="bd-module-bar"><div className="bd-module-bar-fill" style={{ width: `${stats.pct}%`, background: color }}></div></div>
        <span className="bd-module-pct" style={{ color }}>{stats.pct}% approved</span>
      </div>
      <div className="bd-module-summary">
        {stats.total} sent · {stats.approved} approved · {stats.awaiting} awaiting · {stats.revised} revised
      </div>
    </div>
  )
}

function TatCard({ icon, name, color, target, records, enqMap, navigate }) {
  const [page, setPage] = useState(0)
  const PER_PAGE = 3

  const completed = records.filter(r => r.hrs !== null)
  const pending = records.filter(r => r.hrs === null)
  const onTime = completed.filter(r => r.hrs <= target)
  const late = completed.filter(r => r.hrs > target)
  const pct = completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 0

  const sorted = [...records].sort((a, b) => new Date(b.end || b.start || 0) - new Date(a.end || a.start || 0))
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const safePage = Math.min(page, totalPages - 1)
  const recent = sorted.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE)

  return (
    <div className="bd-tat-card">
      <div className="bd-tat-header">
        <span className="bd-tat-name">{icon} {name}</span>
        <div className="bd-tat-badges">
          <span className="bd-tat-badge green">✓{onTime.length}</span>
          <span className="bd-tat-badge rose">✗{late.length}</span>
          <span className="bd-tat-badge gray">⏳{pending.length}</span>
        </div>
      </div>
      <div className="bd-tat-target">Target: {target} hrs</div>
      <div className="bd-tat-bar-row">
        <div className="bd-tat-bar"><div className="bd-tat-bar-fill" style={{ width: `${pct}%`, background: color }}></div></div>
        <span className="bd-tat-pct" style={{ color }}>{pct}%</span>
      </div>
      <div className="bd-tat-sub">{completed.length} completed · {pending.length} in progress</div>

      <div className="bd-tat-recent-label">Recent Activity</div>
      <div className="bd-tat-recent-list">
        {recent.length === 0 ? (
          <div className="bd-tat-empty">No activity yet</div>
        ) : (
          recent.map((r, i) => {
            const isPending = r.hrs === null
            const isOnTime = !isPending && r.hrs <= target
            const dotColor = isPending ? '#888780' : isOnTime ? '#059669' : '#be123c'
            const name = enqMap[r.enquiryId]?.contact_name || enqMap[r.enquiryId]?.company_name || r.enquiryId
            return (
              <div
                className="bd-tat-recent-row"
                key={i}
                onClick={() => navigate?.(`/enquiries/${r.enquiryId}`)}
                style={{ cursor: navigate ? 'pointer' : 'default' }}
              >
                <span className="bd-tat-recent-dot" style={{ background: dotColor }}></span>
                <div className="bd-tat-recent-info">
                  <div className="bd-tat-recent-id">{r.enquiryId}</div>
                  <div className="bd-tat-recent-name">{name}</div>
                  <div className="bd-tat-recent-date">
                    <i className="far fa-calendar"></i> {formatDateDisplay(r.end || r.start)}
                    <span style={{ marginLeft: 8 }}><i className="far fa-clock"></i> {isPending ? '—' : fmtHrs(r.hrs)}</span>
                  </div>
                </div>
                <span className={`bd-tat-recent-badge ${isPending ? 'gray' : isOnTime ? 'green' : 'rose'}`}>
                  {isPending ? '⏳ Pending' : isOnTime ? '✓ On Time' : '✗ Late'}
                </span>
              </div>
            )
          })
        )}
      </div>
      {sorted.length > PER_PAGE && (
        <div className="bd-tat-pagination">
          <button
            className="bd-tat-page-btn"
            disabled={safePage === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            ‹
          </button>
          <span className="bd-tat-page-info">{safePage + 1} / {totalPages}</span>
          <button
            className="bd-tat-page-btn"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}

export default function BackendDashboard({ user }) {
  const navigate = useNavigate()
  const filter = useDateRangeFilter()

  const [loading, setLoading] = useState(true)
  const [enquiries, setEnquiries] = useState([])
  const [fcTasks, setFcTasks] = useState([])
  const [qtTasks, setQtTasks] = useState([])
  const [gaTasks, setGaTasks] = useState([])
  const [qrTasks, setQrTasks] = useState([])
  const [stageLogs, setStageLogs] = useState([])
  const [targets, setTargets] = useState(DEFAULT_TAT_TARGETS)

  useEffect(() => {
    loadData()
  }, [user?.name])

  async function loadData() {
    setLoading(true)
    const [
      { data: enqRows },
      { data: fcRows },
      { data: qtRows },
      { data: gaRows },
      { data: qrRows },
      { data: slRows },
      { data: ddRows },
    ] = await Promise.all([
      supabase.from('enquiries').select('*').eq('assign_to_backend', user.name),
      supabase.from('flowchart_tasks').select('*'),
      supabase.from('quotation_versions').select('*'),
      supabase.from('ga_drawing_tasks').select('*'),
      supabase.from('questionnaire_rounds').select('*'),
      supabase.from('stage_logs').select('*').eq('stage_name', 'Assigned'),
      supabase.from('dropdown_list').select('flowchart, quotation, ga_drawing, questionnaire').order('id', { ascending: true }).limit(1),
    ])

    setEnquiries(enqRows || [])
    setFcTasks(fcRows || [])
    setQtTasks(qtRows || [])
    setGaTasks(gaRows || [])
    setQrTasks(qrRows || [])
    setStageLogs(slRows || [])

    const settingsRow = ddRows?.[0] || {}
    setTargets({
      flowchart: parseHrs(settingsRow.flowchart, DEFAULT_TAT_TARGETS.flowchart),
      quotation: parseHrs(settingsRow.quotation, DEFAULT_TAT_TARGETS.quotation),
      gaDrawing: parseHrs(settingsRow.ga_drawing, DEFAULT_TAT_TARGETS.gaDrawing),
      questionnaire: parseHrs(settingsRow.questionnaire, DEFAULT_TAT_TARGETS.questionnaire),
    })

    setLoading(false)
  }

  const filteredEnquiries = filter.filterByDateField(enquiries, 'date')
  const myEnquiryIds = useMemo(() => new Set(filteredEnquiries.map(e => e.enquiry_id)), [filteredEnquiries])
  const enqMap = useMemo(() => {
    const m = {}
    enquiries.forEach(e => { m[e.enquiry_id] = e })
    return m
  }, [enquiries])

  const myFc = useMemo(() => fcTasks.filter(t => myEnquiryIds.has(t.enquiry_id)), [fcTasks, myEnquiryIds])
  const myQt = useMemo(() => qtTasks.filter(t => myEnquiryIds.has(t.enquiry_id)), [qtTasks, myEnquiryIds])
  const myGa = useMemo(() => gaTasks.filter(t => myEnquiryIds.has(t.enquiry_id)), [gaTasks, myEnquiryIds])
  const myQr = useMemo(() => qrTasks.filter(t => myEnquiryIds.has(t.enquiry_id)), [qrTasks, myEnquiryIds])

  const fcStats = useMemo(() => computeModuleStats(myFc, 'Client Approved', 'Shared with Client', 'Client Revision Requested'), [myFc])
  const qtStats = useMemo(() => computeModuleStats(myQt, 'Sent', null, 'Revision'), [myQt])
  const gaStats = useMemo(() => computeModuleStats(myGa, 'Client Approved', 'Shared with Client', 'Client Revision Requested'), [myGa])
  const qrStats = useMemo(() => computeModuleStats(myQr, 'Received', 'Sent', null), [myQr])

  const totalEnquiries = filteredEnquiries.length
  const addedByMe = filteredEnquiries.filter(e => e.created_by === user.name).length

  const actionNeeded = useMemo(() => {
    return filteredEnquiries
      .filter(e => e.status === 'Active' && ACTION_STAGES[e.current_stage])
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [filteredEnquiries])

  // ── My TAT Performance ──────────────────────────────────
  // This measures BACKEND's own turnaround: from the moment the enquiry
  // was assigned to Backend, until Backend hands off their piece of work —
  // NOT until the client/designer/admin finishes acting on it downstream.
  //   Flowchart    → submitted/shared with client (client_shared_date)
  //   Quotation    → sent to client (shared_date)
  //   GA Drawing   → assigned to a Designer (assigned_date)
  //   Questionnaire→ sent to client (sent_date)
  const backendAssignedMap = useMemo(() => {
    const map = {}
    stageLogs.forEach(l => {
      if (!myEnquiryIds.has(l.enquiry_id)) return
      if (l.stage_name !== 'Assigned') return
      const existing = map[l.enquiry_id]
      if (!existing || new Date(l.date_entered) < new Date(existing)) {
        map[l.enquiry_id] = l.date_entered
      }
    })
    return map
  }, [stageLogs, myEnquiryIds])

  function buildBackendTatRecords(rows, endField) {
    const groups = {}
    ;(rows || []).forEach(r => {
      const key = r.enquiry_id
      if (!key) return
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })

    return Object.keys(groups).map(enquiryId => {
      const group = groups[enquiryId]
      const start = backendAssignedMap[enquiryId] || null
      const ends = group.map(r => r[endField]).filter(Boolean).map(d => new Date(d).getTime())
      const end = ends.length ? new Date(Math.min(...ends)).toISOString() : null
      return {
        enquiryId,
        person: enqMap[enquiryId]?.assign_to_backend,
        start,
        end,
        hrs: (start && end) ? hrsDiff(start, end) : null,
      }
    })
  }

  const fcTatRecords = useMemo(() => buildBackendTatRecords(myFc, 'client_shared_date'), [myFc, backendAssignedMap, enqMap])
  const gaTatRecords = useMemo(() => buildBackendTatRecords(myGa, 'assigned_date'), [myGa, backendAssignedMap, enqMap])
  const qrTatRecords = useMemo(() => buildBackendTatRecords(myQr, 'sent_date'), [myQr, backendAssignedMap, enqMap])
  const qtTatRecords = useMemo(() => buildBackendTatRecords(myQt, 'shared_date'), [myQt, backendAssignedMap, enqMap])

  if (loading) {
    return <div className="sd-loading"><i className="fas fa-spinner fa-spin"></i> Loading dashboard…</div>
  }

  return (
    <div>
      <h2 className="dash-greeting">Hello, {user?.name}! 👋</h2>
      <p className="dash-greeting-sub">Your complete work summary.</p>

      <DateFilterBar filter={filter} />

      {/* ── My Overall Summary ─────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📊 My Overall Summary</div>
        </div>
        <div className="bd-summary-grid">
          <div className="bd-summary-item">
            <div className="bd-summary-val" style={{ color: '#2d7a47' }}>{totalEnquiries}</div>
            <div className="bd-summary-lbl">Total Enquiries</div>
          </div>
          <div className="bd-summary-item">
            <div className="bd-summary-val" style={{ color: '#0369a1' }}>{fcStats.approved}</div>
            <div className="bd-summary-lbl">Flowchart Approved</div>
          </div>
          <div className="bd-summary-item">
            <div className="bd-summary-val" style={{ color: '#0d9488' }}>{gaStats.approved}</div>
            <div className="bd-summary-lbl">GA Drawing Approved</div>
          </div>
          <div className="bd-summary-item">
            <div className="bd-summary-val" style={{ color: '#b45309' }}>{addedByMe}</div>
            <div className="bd-summary-lbl">Added by Me</div>
          </div>
        </div>
      </div>

      {/* ── Module Cards ───────────────────────────────────── */}
      <div className="bd-module-grid">
        <ModuleCard icon="📁" name="Flowchart" color="#6d28d9" stats={fcStats} />
        <ModuleCard icon="💰" name="Quotation" color="#0369a1" stats={qtStats} />
        <ModuleCard icon="📐" name="GA Drawing" color="#0d9488" stats={gaStats} />
        <ModuleCard icon="📄" name="Questionnaire" color="#b45309" stats={qrStats} />
      </div>

      {/* ── Today's Work Queue ─────────────────────────────── */}
      <WorkQueueCard count={actionNeeded.length}>
        <div className="table-wrap">
          <table className="dt">
            <thead>
              <tr><th>Action</th><th>Enquiry ID</th><th>Company</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {actionNeeded.map(e => {
                const a = ACTION_STAGES[e.current_stage]
                return (
                  <tr key={e.id} onClick={() => navigate(`/enquiries/${e.enquiry_id}`)}>
                    <td>
                      <span className="badge" style={{ background: `${a.color}18`, color: a.color }}>
                        {a.icon} {a.label}
                      </span>
                    </td>
                    <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontSize: 12, fontWeight: 700 }}>{e.enquiry_id}</span></td>
                    <td><strong>{e.company_name || '—'}</strong></td>
                    <td><span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--muted)' }}>{formatDateDisplay(e.date)}</span></td>
                    <td>
                      <button className="quick-btn" onClick={(ev) => { ev.stopPropagation(); navigate(`/enquiries/${e.enquiry_id}`) }}>
                        Open →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </WorkQueueCard>

      {/* ── My TAT Performance ─────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">⏱ My TAT Performance</div>
          <button className="quick-btn" onClick={loadData}><i className="fas fa-sync"></i> Refresh</button>
        </div>
        <div className="bd-tat-grid">
          <TatCard icon="📁" name="Flowchart" color="#6d28d9" target={targets.flowchart} records={fcTatRecords} enqMap={enqMap} navigate={navigate} />
          <TatCard icon="📐" name="GA Drawing" color="#0d9488" target={targets.gaDrawing} records={gaTatRecords} enqMap={enqMap} navigate={navigate} />
          <TatCard icon="💰" name="Quotation" color="#0369a1" target={targets.quotation} records={qtTatRecords} enqMap={enqMap} navigate={navigate} />
          <TatCard icon="📄" name="Questionnaire" color="#b45309" target={targets.questionnaire} records={qrTatRecords} enqMap={enqMap} navigate={navigate} />
        </div>
      </div>
    </div>
  )
}