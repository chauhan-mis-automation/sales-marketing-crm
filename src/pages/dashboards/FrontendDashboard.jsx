// import { useState, useEffect, useMemo } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { supabase } from '../../lib/supabaseClient'
// import { useDropdownData } from '../../lib/useDropdownData'
// import { useDateRangeFilter } from '../../lib/useDateRangeFilter'
// import { latestPerEnquiry } from '../../lib/queueHelpers'
// import { formatDateDisplay } from '../../lib/dateHelpers'
// import DateFilterBar from '../../components/DateFilterBar'
// import WorkQueueCard from '../../components/WorkQueueCard'
// import PipelineStagesCard from '../../components/PipelineStagesCard'
// import '../dashboards/StandardDashboard.css'
// import './FrontendDashboard.css'

// function toISO(d) { return d.toISOString().slice(0, 10) }

// export default function FrontendDashboard({ user }) {
//   const navigate = useNavigate()
//   const { stages } = useDropdownData()
//   const filter = useDateRangeFilter()

//   const [loading, setLoading] = useState(true)
//   const [enquiries, setEnquiries] = useState([])
//   const [qtTasks, setQtTasks] = useState([])

//   useEffect(() => {
//     loadData()
//   }, [user?.name])

//   async function loadData() {
//     setLoading(true)
//     const [{ data: enqRows }, { data: qtRows }] = await Promise.all([
//       supabase.from('enquiries').select('*').eq('assign_to_frontend', user.name),
//       supabase.from('quotation_versions').select('*'),
//     ])
//     setEnquiries(enqRows || [])
//     setQtTasks(qtRows || [])
//     setLoading(false)
//   }

//   const filteredEnquiries = filter.filterByDateField(enquiries, 'date')
//   const today = toISO(new Date())

//   const todaysFollowup = filteredEnquiries.filter(e => e.next_followup_date === today).length
//   const assignedToMe = filteredEnquiries.length
//   const createdByMe = filteredEnquiries.filter(e => e.created_by === user.name).length
//   const active = filteredEnquiries.filter(e => e.status === 'Active').length
//   const overdueList = useMemo(
//     () => filteredEnquiries
//       .filter(e => e.status === 'Active' && e.next_followup_date && e.next_followup_date < today)
//       .sort((a, b) => new Date(a.next_followup_date) - new Date(b.next_followup_date)),
//     [filteredEnquiries, today]
//   )

//   const dueTodayList = useMemo(
//     () => filteredEnquiries
//       .filter(e => e.status === 'Active' && e.next_followup_date === today),
//     [filteredEnquiries, today]
//   )

//   const workQueueItems = [...overdueList, ...dueTodayList]

//   const latestQuotationAmountMap = useMemo(() => {
//     const map = {}
//     const myIds = new Set(enquiries.map(e => e.enquiry_id))
//     latestPerEnquiry(qtTasks.filter(q => myIds.has(q.enquiry_id))).forEach(q => {
//       if (q.amount !== null && q.amount !== undefined) map[q.enquiry_id] = q.amount
//     })
//     return map
//   }, [qtTasks, enquiries])

//   function getDisplayAmount(e) {
//     if (e.status === 'Won' && e.final_order_value) return e.final_order_value
//     if (latestQuotationAmountMap[e.enquiry_id] !== undefined) return latestQuotationAmountMap[e.enquiry_id]
//     return null
//   }

//   if (loading) {
//     return <div className="sd-loading"><i className="fas fa-spinner fa-spin"></i> Loading dashboard…</div>
//   }

//   return (
//     <div>
//       <h2 className="dash-greeting">Hello, {user?.name}! 👋</h2>
//       <p className="dash-greeting-sub">Your enquiry summary and today's tasks.</p>

//       <DateFilterBar filter={filter} />

//       <div className="fd-stats-grid">
//         <div className="stat-card c-violet" onClick={() => dueTodayList.length && navigate('/followups')}>
//           <div className="stat-icon"><i className="fas fa-calendar-day"></i></div>
//           <div className="stat-value">{todaysFollowup}</div>
//           <div className="stat-label">Today's Follow-up</div>
//         </div>
//         <div className="stat-card c-green">
//           <div className="stat-icon"><i className="fas fa-inbox"></i></div>
//           <div className="stat-value">{assignedToMe}</div>
//           <div className="stat-label">Assigned to Me</div>
//         </div>
//         <div className="stat-card c-amber">
//           <div className="stat-icon"><i className="fas fa-user-plus"></i></div>
//           <div className="stat-value">{createdByMe}</div>
//           <div className="stat-label">Created by Me</div>
//         </div>
//         <div className="stat-card c-teal">
//           <div className="stat-icon"><i className="fas fa-spinner"></i></div>
//           <div className="stat-value">{active}</div>
//           <div className="stat-label">Active</div>
//         </div>
//         <div className="stat-card c-rose">
//           <div className="stat-icon"><i className="fas fa-bell"></i></div>
//           <div className="stat-value">{overdueList.length}</div>
//           <div className="stat-label">Overdue Follow-ups</div>
//         </div>
//       </div>

//       {/* ── My Pipeline Stages ──────────────────────────────── */}
//       <PipelineStagesCard
//         enquiries={filteredEnquiries}
//         stages={stages}
//         getDisplayAmount={getDisplayAmount}
//         title="⚡ My Pipeline Stages"
//       />

//       {/* ── Today's Work Queue ──────────────────────────────── */}
//       <WorkQueueCard count={workQueueItems.length}>
//         <div className="table-wrap">
//           <table className="dt">
//             <thead>
//               <tr><th>Enquiry ID</th><th>Company</th><th>Stage</th><th>Follow-up Date</th><th></th></tr>
//             </thead>
//             <tbody>
//               {workQueueItems.map(e => {
//                 const isOverdue = e.next_followup_date < today
//                 return (
//                   <tr key={e.id} className={isOverdue ? 'wq-row-overdue' : 'wq-row-due-today'} onClick={() => navigate(`/enquiries/${e.enquiry_id}`)}>
//                     <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontSize: 12, fontWeight: 700 }}>{e.enquiry_id}</span></td>
//                     <td><strong>{e.company_name || '—'}</strong></td>
//                     <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{e.current_stage || '—'}</td>
//                     <td>
//                       <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700, color: isOverdue ? 'var(--rose)' : 'var(--amber)' }}>
//                         {formatDateDisplay(e.next_followup_date)}
//                       </span>
//                     </td>
//                     <td>
//                       <button className="quick-btn" onClick={(ev) => { ev.stopPropagation(); navigate(`/enquiries/${e.enquiry_id}`) }}>
//                         Open →
//                       </button>
//                     </td>
//                   </tr>
//                 )
//               })}
//             </tbody>
//           </table>
//         </div>
//       </WorkQueueCard>
//     </div>
//   )
// }


import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useDropdownData } from '../../lib/useDropdownData'
import { useDateRangeFilter } from '../../lib/useDateRangeFilter'
import { latestPerEnquiry } from '../../lib/queueHelpers'
import { formatDateDisplay } from '../../lib/dateHelpers'
import DateFilterBar from '../../components/DateFilterBar'
import WorkQueueCard from '../../components/WorkQueueCard'
import PipelineStagesCard from '../../components/PipelineStagesCard'
import '../dashboards/StandardDashboard.css'
import './FrontendDashboard.css'

function toISO(d) { return d.toISOString().slice(0, 10) }

export default function FrontendDashboard({ user }) {
  const navigate = useNavigate()
  const { stages } = useDropdownData()
  const filter = useDateRangeFilter()

  const [loading, setLoading] = useState(true)
  const [enquiries, setEnquiries] = useState([])
  const [qtTasks, setQtTasks] = useState([])
  const [smSchedule, setSmSchedule] = useState([])

  useEffect(() => {
    loadData()
  }, [user?.name])

  async function loadData() {
    setLoading(true)
    const [{ data: enqRows }, { data: qtRows }] = await Promise.all([
      supabase.from('enquiries').select('*').eq('assign_to_frontend', user.name),
      supabase.from('quotation_versions').select('*'),
    ])
    setEnquiries(enqRows || [])
    setQtTasks(qtRows || [])

    // ── Sales & Marketing CRM cross-lookup ──────────────────────────
    // Casilica aur Sales & Marketing CRM ek hi Supabase project use karte hain,
    // aur same login-email (users.username) dono jagah use hoti hai. Isliye
    // pehle sm_users mein match karo (email = apna Casilica username), phir
    // uske aaj ke Pending followups (Call/Visit/Meeting) le aao.
    try {
      const { data: smUserRow } = await supabase
        .from('sm_users')
        .select('user_id')
        .eq('email', user.username)
        .maybeSingle()

      if (smUserRow?.user_id) {
        const todayISO = new Date().toISOString().slice(0, 10)
        const { data: smRows } = await supabase
          .from('sm_followups')
          .select('*')
          .eq('sales_person_id', smUserRow.user_id)
          .eq('follow_up_date', todayISO)
          .eq('status', 'Pending')
        setSmSchedule(smRows || [])
      } else {
        setSmSchedule([])
      }
    } catch {
      setSmSchedule([])
    }

    setLoading(false)
  }

  const filteredEnquiries = filter.filterByDateField(enquiries, 'date')
  const today = toISO(new Date())

  const todaysFollowup = filteredEnquiries.filter(e => e.next_followup_date === today).length
  const assignedToMe = filteredEnquiries.length
  const createdByMe = filteredEnquiries.filter(e => e.created_by === user.name).length
  const active = filteredEnquiries.filter(e => e.status === 'Active').length
  const overdueList = useMemo(
    () => filteredEnquiries
      .filter(e => e.status === 'Active' && e.next_followup_date && e.next_followup_date < today)
      .sort((a, b) => new Date(a.next_followup_date) - new Date(b.next_followup_date)),
    [filteredEnquiries, today]
  )

  const dueTodayList = useMemo(
    () => filteredEnquiries
      .filter(e => e.status === 'Active' && e.next_followup_date === today),
    [filteredEnquiries, today]
  )

  const workQueueItems = [...overdueList, ...dueTodayList]

  const latestQuotationAmountMap = useMemo(() => {
    const map = {}
    const myIds = new Set(enquiries.map(e => e.enquiry_id))
    latestPerEnquiry(qtTasks.filter(q => myIds.has(q.enquiry_id))).forEach(q => {
      if (q.amount !== null && q.amount !== undefined) map[q.enquiry_id] = q.amount
    })
    return map
  }, [qtTasks, enquiries])

  function getDisplayAmount(e) {
    if (e.status === 'Won' && e.final_order_value) return e.final_order_value
    if (latestQuotationAmountMap[e.enquiry_id] !== undefined) return latestQuotationAmountMap[e.enquiry_id]
    return null
  }

  if (loading) {
    return <div className="sd-loading"><i className="fas fa-spinner fa-spin"></i> Loading dashboard…</div>
  }

  return (
    <div>
      <h2 className="dash-greeting">Hello, {user?.name}! 👋</h2>
      <p className="dash-greeting-sub">Your enquiry summary and today's tasks.</p>

      <DateFilterBar filter={filter} />

      <div className="fd-stats-grid">
        <div className="stat-card c-violet" onClick={() => dueTodayList.length && navigate('/followups')}>
          <div className="stat-icon"><i className="fas fa-calendar-day"></i></div>
          <div className="stat-value">{todaysFollowup}</div>
          <div className="stat-label">Today's Follow-up</div>
        </div>
        <div className="stat-card c-green">
          <div className="stat-icon"><i className="fas fa-inbox"></i></div>
          <div className="stat-value">{assignedToMe}</div>
          <div className="stat-label">Assigned to Me</div>
        </div>
        <div className="stat-card c-amber">
          <div className="stat-icon"><i className="fas fa-user-plus"></i></div>
          <div className="stat-value">{createdByMe}</div>
          <div className="stat-label">Created by Me</div>
        </div>
        <div className="stat-card c-teal">
          <div className="stat-icon"><i className="fas fa-spinner"></i></div>
          <div className="stat-value">{active}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card c-rose">
          <div className="stat-icon"><i className="fas fa-bell"></i></div>
          <div className="stat-value">{overdueList.length}</div>
          <div className="stat-label">Overdue Follow-ups</div>
        </div>
      </div>

      {/* ── My Pipeline Stages ──────────────────────────────── */}
      <PipelineStagesCard
        enquiries={filteredEnquiries}
        stages={stages}
        getDisplayAmount={getDisplayAmount}
        title="⚡ My Pipeline Stages"
      />

      {/* ── Today's Schedule (Sales & Marketing CRM ke Call/Visit/Meeting) ── */}
      {smSchedule.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">📅 Today's Schedule</div>
          </div>
          <div style={{ padding: '4px 16px 16px' }}>
            {smSchedule.map(f => {
              const icon = f.type === 'Visit' ? 'fa-map-marker-alt' : f.type === 'Meeting' ? 'fa-handshake' : 'fa-phone'
              return (
                <div
                  key={`sm-${f.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 4px', borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--teal-bg)', color: 'var(--teal)', flexShrink: 0,
                  }}>
                    <i className={`fas ${icon}`}></i>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 13.5 }}>{f.lead_name || '—'}</strong>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{f.type || 'Follow-up'} · Sales &amp; Marketing CRM</div>
                    {f.notes && (
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{f.notes}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
                    padding: '3px 9px', borderRadius: 20,
                    background: 'var(--amber-bg)', color: 'var(--amber)', flexShrink: 0,
                  }}>PENDING</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Today's Work Queue ──────────────────────────────── */}
      <WorkQueueCard count={workQueueItems.length}>
        <div className="table-wrap">
          <table className="dt">
            <thead>
              <tr><th>Enquiry ID</th><th>Company</th><th>Stage</th><th>Follow-up Date</th><th></th></tr>
            </thead>
            <tbody>
              {workQueueItems.map(e => {
                const isOverdue = e.next_followup_date < today
                return (
                  <tr key={e.id} className={isOverdue ? 'wq-row-overdue' : 'wq-row-due-today'} onClick={() => navigate(`/enquiries/${e.enquiry_id}`)}>
                    <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontSize: 12, fontWeight: 700 }}>{e.enquiry_id}</span></td>
                    <td><strong>{e.company_name || '—'}</strong></td>
                    <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{e.current_stage || '—'}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700, color: isOverdue ? 'var(--rose)' : 'var(--amber)' }}>
                        {formatDateDisplay(e.next_followup_date)}
                      </span>
                    </td>
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
    </div>
  )
}