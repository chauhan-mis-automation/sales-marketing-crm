import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { DEFAULT_TAT_TARGETS, hrsDiff, fmtHrs, parseHrs, buildModuleStats, onTimePct, buildEnquiryLevelRecords } from '../lib/tatHelpers'
import { formatDateDisplay } from '../lib/dateHelpers'
import './queues/QueuePages.css'
import './TATReport.css'

export default function TATReport() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [modules, setModules] = useState(null)
  const [activeModal, setActiveModal] = useState(null) // { title, records }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [
        { data: fcRows },
        { data: qtRows },
        { data: gaRows },
        { data: poRows },
        { data: woRows },
        { data: qrRows },
        { data: stageLogs },
        { data: enqRows },
        { data: dropdownRows },
      ] = await Promise.all([
        supabase.from('flowchart_tasks').select('*'),
        supabase.from('quotation_versions').select('*'),
        supabase.from('ga_drawing_tasks').select('*'),
        supabase.from('purchase_orders').select('*'),
        supabase.from('work_orders').select('*'),
        supabase.from('questionnaire_rounds').select('*'),
        supabase.from('stage_logs').select('*').eq('stage_name', 'Assigned'),
        supabase.from('enquiries').select('enquiry_id, company_name, project_name, assign_to_backend'),
        supabase.from('dropdown_list').select('flowchart, quotation, ga_drawing, questionnaire, tat_admin_approval, purchase_orders, work_order').order('id', { ascending: true }).limit(1),
      ])

      const enqMap = {}
      ;(enqRows || []).forEach(e => { enqMap[e.enquiry_id] = e })

      const settingsRow = dropdownRows?.[0] || {}
      const targets = {
        flowchart: parseHrs(settingsRow.flowchart, DEFAULT_TAT_TARGETS.flowchart),
        quotation: parseHrs(settingsRow.quotation, DEFAULT_TAT_TARGETS.quotation),
        gaDrawing: parseHrs(settingsRow.ga_drawing, DEFAULT_TAT_TARGETS.gaDrawing),
        questionnaire: parseHrs(settingsRow.questionnaire, DEFAULT_TAT_TARGETS.questionnaire),
        adminApproval: parseHrs(settingsRow.tat_admin_approval, DEFAULT_TAT_TARGETS.adminApproval),
        purchaseOrder: parseHrs(settingsRow.purchase_orders, DEFAULT_TAT_TARGETS.purchaseOrder),
        workOrder: parseHrs(settingsRow.work_order, DEFAULT_TAT_TARGETS.workOrder),
      }

      // latest "Assigned" stage_log timestamp per enquiry — this is when Backend
      // received the enquiry, used as the TAT start-point for Backend's own
      // Flowchart / Quotation / Questionnaire turnaround (GA Drawing, PO, Work
      // Order are tracked separately below, attributed to Designer/Admin).
      const backendAssignedMap = {}
      ;(stageLogs || []).forEach(l => {
        const existing = backendAssignedMap[l.enquiry_id]
        if (!existing || new Date(l.date_entered) < new Date(existing)) {
          backendAssignedMap[l.enquiry_id] = l.date_entered
        }
      })

      function buildBackendRecords(rows, endField) {
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
            company: enqMap[enquiryId]?.company_name,
            person: enqMap[enquiryId]?.assign_to_backend,
            start,
            end,
            hrs: (start && end) ? hrsDiff(start, end) : null,
            status: group[group.length - 1].status,
          }
        })
      }

      // ── Flowchart: Assigned to Backend → Shared with Client ──
      const fcRecords = buildBackendRecords(fcRows, 'client_shared_date')
      const qtRecords = buildBackendRecords(qtRows, 'shared_date')

      // ── GA Drawing: Designer TAT runs from first assignment until Admin
      // finally APPROVES it — rejections/revisions do not reset the clock.
      const gaDesignerRecords = buildEnquiryLevelRecords(gaRows, {
        startField: 'assigned_date',
        endField: 'admin_review_date',
        successStatuses: ['Approved by Admin'],
        personField: 'assigned_to',
      }).map(r => ({ ...r, company: enqMap[r.enquiryId]?.company_name }))

      // Admin's own review speed — measured per individual submission,
      // since each review they do (approve or reject) is its own event.
      const gaAdminRecords = (gaRows || [])
        .filter(t => t.designer_submission_date)
        .map(t => ({
          person: t.admin_review_by,
          enquiryId: t.enquiry_id,
          company: enqMap[t.enquiry_id]?.company_name,
          version: t.version,
          start: t.designer_submission_date,
          end: t.admin_review_date || null,
          hrs: t.admin_review_date ? hrsDiff(t.designer_submission_date, t.admin_review_date) : null,
          status: t.status,
        }))

      // Full client-facing TAT: first assignment until the CLIENT finally approves.
      const gaTotalRecords = buildEnquiryLevelRecords(gaRows, {
        startField: 'assigned_date',
        endField: 'client_approved_date',
        successStatuses: ['Client Approved'],
        personField: 'assigned_to',
      }).map(r => ({ ...r, company: enqMap[r.enquiryId]?.company_name }))

      // ── Purchase Order: Upload (first version) → finally Approved by admin ──
      const poRecords = buildEnquiryLevelRecords(poRows, {
        startField: 'upload_date',
        endField: 'reviewed_date',
        successStatuses: ['Approved'],
        personField: 'submitted_by',
      }).map(r => ({ ...r, company: enqMap[r.enquiryId]?.company_name }))

      // ── Work Order: Designer TAT runs from first assignment until Admin
      // finally APPROVES it — rejections/revisions do not reset the clock.
      const woDesignerRecords = buildEnquiryLevelRecords(woRows, {
        startField: 'assigned_date',
        endField: 'admin_review_date',
        successStatuses: ['Approved'],
        personField: 'assigned_to',
      }).map(r => ({ ...r, company: enqMap[r.enquiryId]?.company_name }))

      // Admin's own review speed — measured per individual submission.
      const woAdminRecords = (woRows || [])
        .filter(t => t.designer_submission_date)
        .map(t => ({
          person: t.admin_review_by,
          enquiryId: t.enquiry_id,
          company: enqMap[t.enquiry_id]?.company_name,
          version: t.version,
          start: t.designer_submission_date,
          end: t.admin_review_date || null,
          hrs: t.admin_review_date ? hrsDiff(t.designer_submission_date, t.admin_review_date) : null,
          status: t.status,
        }))

      // ── Questionnaire: Assigned to Backend → Sent to Client ──
      const qrRecords = buildBackendRecords(qrRows, 'sent_date')

      setModules({
        flowchart: { records: fcRecords, stats: buildModuleStats(fcRecords, targets.flowchart), target: targets.flowchart, label: '🗂️ Flowchart', sub: 'Assigned to Backend → Shared with Client' },
        quotation: { records: qtRecords, stats: buildModuleStats(qtRecords, targets.quotation), target: targets.quotation, label: '💰 Quotation', sub: 'Assigned to Backend → Quotation Sent' },
        questionnaire: { records: qrRecords, stats: buildModuleStats(qrRecords, targets.questionnaire), target: targets.questionnaire, label: '📄 Questionnaire', sub: 'Assigned to Backend → Sent to Client' },
        gaDesigner: { records: gaDesignerRecords, stats: buildModuleStats(gaDesignerRecords, targets.gaDrawing), target: targets.gaDrawing, label: '📐 GA Drawing (Designer)', sub: 'Assigned → Admin Approved (revisions don\'t reset clock)' },
        gaAdmin: { records: gaAdminRecords, stats: buildModuleStats(gaAdminRecords, targets.adminApproval), target: targets.adminApproval, label: '👑 GA Drawing (Admin Review)', sub: 'Submission → Admin Review (per attempt)' },
        gaTotal: { records: gaTotalRecords, stats: buildModuleStats(gaTotalRecords, targets.gaDrawing), target: targets.gaDrawing, label: '📐 GA Drawing (Total)', sub: 'Assigned → Client Approved (revisions don\'t reset clock)' },
        po: { records: poRecords, stats: buildModuleStats(poRecords, targets.purchaseOrder), target: targets.purchaseOrder, label: '📄 Purchase Order', sub: 'Upload → Admin Approved (revisions don\'t reset clock)' },
        woDesigner: { records: woDesignerRecords, stats: buildModuleStats(woDesignerRecords, targets.workOrder), target: targets.workOrder, label: '📋 Work Order (Designer)', sub: 'Assigned → Admin Approved (revisions don\'t reset clock)' },
        woAdmin: { records: woAdminRecords, stats: buildModuleStats(woAdminRecords, targets.adminApproval), target: targets.adminApproval, label: '👑 Work Order (Admin Review)', sub: 'Submission → Admin Review (per attempt)' },
      })
    } catch (err) {
      console.error('Error loading TAT data:', err)
    } finally {
      setLoading(false)
    }
  }

  function openDetail(moduleLabel, target, records, type) {
    const filtered = type === 'ontime' ? records.filter(r => r.hrs !== null && r.hrs <= target)
      : type === 'late' ? records.filter(r => r.hrs !== null && r.hrs > target)
      : records.filter(r => r.hrs === null)
    setActiveModal({ title: `${moduleLabel} — ${type === 'ontime' ? 'On Time' : type === 'late' ? 'Late' : 'Pending'}`, records: filtered })
  }

  function openPersonDetail(moduleLabel, target, records, type, person) {
    const byType = type === 'ontime' ? records.filter(r => r.hrs !== null && r.hrs <= target)
      : type === 'late' ? records.filter(r => r.hrs !== null && r.hrs > target)
      : records.filter(r => r.hrs === null)
    const filtered = byType.filter(r => (r.person && r.person.trim() ? r.person.trim() : 'Unassigned') === person)
    setActiveModal({
      title: `${moduleLabel} — ${person} — ${type === 'ontime' ? 'On Time' : type === 'late' ? 'Late' : 'Pending'}`,
      records: filtered
    })
  }

  if (loading) {
    return <div className="tat-loading"><i className="fas fa-spinner fa-spin"></i> Loading TAT report…</div>
  }

  const summaryModules = [
    { key: 'flowchart', color: '#6d28d9' },
    { key: 'quotation', color: '#0369a1' },
    { key: 'questionnaire', color: '#b45309' },
    { key: 'gaTotal', color: '#0d9488' },
    { key: 'po', color: '#0369a1' },
    { key: 'woDesigner', color: '#059669' },
  ]

  const detailModules = [
    { key: 'flowchart', color: '#6d28d9' },
    { key: 'quotation', color: '#0369a1' },
    { key: 'questionnaire', color: '#b45309' },
    { key: 'gaDesigner', color: '#0d9488' },
    { key: 'gaAdmin', color: '#eab308' },
    { key: 'gaTotal', color: '#059669' },
    { key: 'po', color: '#0369a1' },
    { key: 'woDesigner', color: '#059669' },
    { key: 'woAdmin', color: '#eab308' },
  ]

  return (
    <div className="tat-wrap">
      <p className="tat-subtitle">Turnaround time performance across every module — target vs actual</p>

      <div className="tat-summary-grid">
        {summaryModules.map(({ key, color }) => {
          const m = modules[key]
          const pct = onTimePct(m.stats)
          const barColor = pct >= 80 ? '#059669' : pct >= 50 ? '#b45309' : '#be123c'
          return (
            <div key={key} className="tat-summary-card" style={{ borderTopColor: color }}>
              <div className="tat-summary-label">{m.label}</div>
              <div className="tat-summary-pct" style={{ color: barColor }}>{pct}%</div>
              <div className="tat-summary-sub">{m.stats.onTime + m.stats.late} closed · {m.stats.pending} pending</div>
              <div className="tat-summary-bar">
                <div className="tat-summary-bar-fill" style={{ width: `${pct}%`, background: barColor }}></div>
              </div>
            </div>
          )
        })}
      </div>

      {detailModules.map(({ key, color }) => {
        const m = modules[key]
        const persons = Object.entries(m.stats.persons).sort((a, b) => (b[1].onTime + b[1].late + b[1].pending) - (a[1].onTime + a[1].late + a[1].pending))

        return (
          <div key={key} className="tat-module-card">
            <div className="tat-module-header" style={{ background: `${color}10`, borderLeftColor: color }}>
              <div>
                <div className="tat-module-title">{m.label}</div>
                <div className="tat-module-sub">{m.sub} · Target: {m.target} hrs</div>
              </div>
              <div className="tat-module-badges">
                <span className="tat-badge tat-badge-clickable qb-green" onClick={() => openDetail(m.label, m.target, m.records, 'ontime')}>✓ {m.stats.onTime} on time</span>
                <span className="tat-badge tat-badge-clickable qb-rose" onClick={() => openDetail(m.label, m.target, m.records, 'late')}>✗ {m.stats.late} late</span>
                <span className="tat-badge tat-badge-clickable qb-gray" onClick={() => openDetail(m.label, m.target, m.records, 'pending')}>⏳ {m.stats.pending} pending</span>
              </div>
            </div>

            {persons.length === 0 ? (
              <div className="tat-empty">No records yet.</div>
            ) : (
              <div className="tat-person-table-wrap">
                <table className="tat-person-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>On Time</th>
                      <th>Late</th>
                      <th>Pending</th>
                      <th>Completed</th>
                      <th>Avg TAT</th>
                      <th>On-Time %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {persons.map(([person, s]) => {
                      const total = s.onTime + s.late
                      const avg = total > 0 ? s.totalHrs / total : null
                      const personPct = total > 0 ? Math.round((s.onTime / total) * 100) : 0
                      const pColor = personPct >= 80 ? '#059669' : personPct >= 50 ? '#b45309' : '#be123c'
                      return (
                        <tr key={person}>
                          <td className="tat-person-name">{person}</td>
                          <td>
                            <span
                              className={`tat-cell-green ${s.onTime > 0 ? 'tat-cell-clickable' : ''}`}
                              onClick={() => s.onTime > 0 && openPersonDetail(m.label, m.target, m.records, 'ontime', person)}
                            >{s.onTime}</span>
                          </td>
                          <td>
                            <span
                              className={`tat-cell-rose ${s.late > 0 ? 'tat-cell-clickable' : ''}`}
                              onClick={() => s.late > 0 && openPersonDetail(m.label, m.target, m.records, 'late', person)}
                            >{s.late}</span>
                          </td>
                          <td>
                            <span
                              className={`tat-cell-gray ${s.pending > 0 ? 'tat-cell-clickable' : ''}`}
                              onClick={() => s.pending > 0 && openPersonDetail(m.label, m.target, m.records, 'pending', person)}
                            >{s.pending}</span>
                          </td>
                          <td>{total}</td>
                          <td className="qp-mono">{avg !== null ? fmtHrs(avg) : '—'}</td>
                          <td>
                            <div className="tat-mini-bar-row">
                              <div className="tat-mini-bar"><div className="tat-mini-bar-fill" style={{ width: `${personPct}%`, background: pColor }}></div></div>
                              <span style={{ color: pColor, fontWeight: 700 }}>{personPct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {activeModal && (
        <div className="tat-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="tat-modal" onClick={e => e.stopPropagation()}>
            <div className="tat-modal-header">
              <span>{activeModal.title} ({activeModal.records.length})</span>
              <button onClick={() => setActiveModal(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="tat-modal-body">
              <table className="tat-person-table">
                <thead>
                  <tr>
                    <th>Enquiry ID</th>
                    <th>Company</th>
                    <th>Person</th>
                    <th>Version</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>TAT</th>
                  </tr>
                </thead>
                <tbody>
                  {activeModal.records.length === 0 ? (
                    <tr><td colSpan={7} className="tat-empty">No records in this category</td></tr>
                  ) : (
                    activeModal.records.map((r, i) => (
                      <tr key={i} onClick={() => navigate(`/enquiries/${r.enquiryId}`)} style={{ cursor: 'pointer' }}>
                        <td><span className="qp-id">{r.enquiryId}</span></td>
                        <td>{r.company || '—'}</td>
                        <td>{r.person || '—'}</td>
                        <td className="qp-mono">{r.version || '—'}</td>
                        <td className="qp-mono">{formatDateDisplay(r.start)}</td>
                        <td className="qp-mono">{r.end ? formatDateDisplay(r.end) : '—'}</td>
                        <td className="qp-mono">{r.hrs !== null ? fmtHrs(r.hrs) : 'In Progress'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}