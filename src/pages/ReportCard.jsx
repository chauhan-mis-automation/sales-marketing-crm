// import { useState, useEffect, useMemo } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { supabase } from '../lib/supabaseClient'
// import { useAuth } from '../context/AuthContext'
// import { useDateRangeFilter } from '../lib/useDateRangeFilter'
// import { downloadCSV } from '../lib/csvHelpers'
// import { formatDateDisplay } from '../lib/dateHelpers'
// import { DEFAULT_TAT_TARGETS, parseHrs, hrsDiff, fmtHrs, buildEnquiryLevelRecords } from '../lib/tatHelpers'
// import DateFilterBar from '../components/DateFilterBar'
// import './queues/QueuePages.css'
// import './ReportCard.css'

// const MODULE_INFO = {
//   Flowchart: { icon: '🗂', color: '#6d28d9' },
//   Quotation: { icon: '💰', color: '#0369a1' },
//   'GA Drawing': { icon: '📐', color: '#0d9488' },
//   'Work Order': { icon: '📋', color: '#059669' },
//   Questionnaire: { icon: '📄', color: '#b45309' },
// }

// // which modules are relevant for a report card, based on the selected person's role
// const ROLE_MODULES = {
//   design: ['GA Drawing', 'Work Order'],
//   backend: ['Flowchart', 'Quotation', 'Questionnaire'],
//   admin: ['GA Drawing', 'Work Order'],
//   superadmin: ['GA Drawing', 'Work Order'],
// }

// // stats for someone who is the ASSIGNEE of the work (Designer on GA Drawing / Work Order,
// // or Backend on Flowchart) — includes their own turnaround time.
// function computeAssigneeStats(rows, approvedStatus, rejectedStatuses, target, tatConfig) {
//   const total = rows.length
//   const approvedRows = rows.filter(r => r.status === approvedStatus)
//   const rejectedRows = rejectedStatuses ? rows.filter(r => rejectedStatuses.includes(r.status)) : []
//   const approvedIds = new Set(approvedRows.map(r => r.id))
//   const rejectedIds = new Set(rejectedRows.map(r => r.id))
//   const pendingRows = rows.filter(r => !approvedIds.has(r.id) && !rejectedIds.has(r.id))
//   const pct = total > 0 ? Math.round((approvedRows.length / total) * 100) : 0

//   let avgTat = null, onTimePct = null
//   if (tatConfig) {
//     const records = buildEnquiryLevelRecords(rows, tatConfig)
//     const completed = records.filter(r => r.hrs !== null)
//     const onTime = completed.filter(r => r.hrs <= target).length
//     avgTat = completed.length ? completed.reduce((s, r) => s + r.hrs, 0) / completed.length : null
//     onTimePct = completed.length ? Math.round((onTime / completed.length) * 100) : 0
//   }
//   return {
//     total, approved: approvedRows.length, rejected: rejectedRows.length, pending: pendingRows.length, pct, avgTat, onTimePct,
//     rows: { all: rows, approved: approvedRows, rejected: rejectedRows, pending: pendingRows },
//   }
// }

// // stats for an ADMIN reviewing GA Drawing / Work Order submissions — they aren't the
// // "assignee", they're the reviewer, so the numbers mean something different:
// //  - total  = everything that has ever come in for approval (system-wide)
// //  - approved/rejected = decisions made specifically BY this admin
// //  - pending = submissions still waiting on someone to review them (system-wide)
// //  - TAT = how fast THIS admin reviews once something lands in their queue
// function computeAdminReviewStats(rows, approvedStatus, rejectedStatus, adminName, target) {
//   const submitted = rows.filter(r => r.designer_submission_date)
//   const reviewedByMe = rows.filter(r => r.admin_review_by === adminName && r.admin_review_date)
//   const approvedRows = reviewedByMe.filter(r => r.status === approvedStatus)
//   const rejectedRows = reviewedByMe.filter(r => r.status === rejectedStatus)
//   const pendingRows = submitted.filter(r => !r.admin_review_date)
//   const total = submitted.length
//   const pct = reviewedByMe.length > 0 ? Math.round((approvedRows.length / reviewedByMe.length) * 100) : 0

//   const tatRows = reviewedByMe
//     .map(r => hrsDiff(r.designer_submission_date, r.admin_review_date))
//     .filter(h => h !== null)
//   const onTime = tatRows.filter(h => h <= target).length
//   const avgTat = tatRows.length ? tatRows.reduce((s, h) => s + h, 0) / tatRows.length : null
//   const onTimePct = tatRows.length ? Math.round((onTime / tatRows.length) * 100) : 0

//   return {
//     total, approved: approvedRows.length, rejected: rejectedRows.length, pending: pendingRows.length, pct, avgTat, onTimePct,
//     rows: { all: submitted, approved: approvedRows, rejected: rejectedRows, pending: pendingRows },
//   }
// }

// export default function ReportCard() {
//   const navigate = useNavigate()
//   const filter = useDateRangeFilter()
//   const { user: loggedInUser } = useAuth()
//   const isAdminViewer = loggedInUser?.role === 'admin' || loggedInUser?.role === 'superadmin'

//   const [loading, setLoading] = useState(true)
//   const [users, setUsers] = useState([])
//   const [enquiries, setEnquiries] = useState([])
//   const [fcTasks, setFcTasks] = useState([])
//   const [qtTasks, setQtTasks] = useState([])
//   const [gaTasks, setGaTasks] = useState([])
//   const [woTasks, setWoTasks] = useState([])
//   const [qrTasks, setQrTasks] = useState([])
//   const [stageLogs, setStageLogs] = useState([])
//   const [callHistory, setCallHistory] = useState([])
//   const [targets, setTargets] = useState(DEFAULT_TAT_TARGETS)

//   const [selectedUser, setSelectedUser] = useState('')
//   const [activeModal, setActiveModal] = useState(null) // { title, rows }
//   const [selectedEnquiry, setSelectedEnquiry] = useState('')

//   useEffect(() => {
//     loadData()
//   }, [])

//   async function loadData() {
//     setLoading(true)
//     const [
//       { data: userRows },
//       { data: enqRows },
//       { data: fcRows },
//       { data: qtRows },
//       { data: gaRows },
//       { data: woRows },
//       { data: qrRows },
//       { data: slRows },
//       { data: chRows },
//       { data: ddRows },
//     ] = await Promise.all([
//       supabase.from('users').select('*').eq('active', true).order('name', { ascending: true }),
//       supabase.from('enquiries').select('*'),
//       supabase.from('flowchart_tasks').select('*'),
//       supabase.from('quotation_versions').select('*'),
//       supabase.from('ga_drawing_tasks').select('*'),
//       supabase.from('work_orders').select('*'),
//       supabase.from('questionnaire_rounds').select('*'),
//       supabase.from('stage_logs').select('*').eq('stage_name', 'Assigned'),
//       supabase.from('call_history').select('*'),
//       supabase.from('dropdown_list').select('flowchart, quotation, ga_drawing, work_order, tat_admin_approval, questionnaire').order('id', { ascending: true }).limit(1),
//     ])

//     const nonSuperadmin = (userRows || []).filter(u => u.role !== 'superadmin')
//     setUsers(nonSuperadmin)
//     setEnquiries(enqRows || [])
//     setFcTasks(fcRows || [])
//     setQtTasks(qtRows || [])
//     setGaTasks(gaRows || [])
//     setWoTasks(woRows || [])
//     setQrTasks(qrRows || [])
//     setStageLogs(slRows || [])
//     setCallHistory(chRows || [])

//     const s = ddRows?.[0] || {}
//     setTargets({
//       flowchart: parseHrs(s.flowchart, DEFAULT_TAT_TARGETS.flowchart),
//       quotation: parseHrs(s.quotation, DEFAULT_TAT_TARGETS.quotation),
//       gaDrawing: parseHrs(s.ga_drawing, DEFAULT_TAT_TARGETS.gaDrawing),
//       workOrder: parseHrs(s.work_order, DEFAULT_TAT_TARGETS.workOrder),
//       adminApproval: parseHrs(s.tat_admin_approval, DEFAULT_TAT_TARGETS.adminApproval),
//       questionnaire: parseHrs(s.questionnaire, DEFAULT_TAT_TARGETS.questionnaire),
//     })

//     if (isAdminViewer) {
//       if (nonSuperadmin.length > 0) setSelectedUser(nonSuperadmin[0].name)
//     } else if (loggedInUser?.name) {
//       setSelectedUser(loggedInUser.name)
//     }

//     setLoading(false)
//   }

//   const enqMap = useMemo(() => {
//     const m = {}
//     enquiries.forEach(e => { m[e.enquiry_id] = e })
//     return m
//   }, [enquiries])

//   const currentUser = users.find(u => u.name === selectedUser)
//   const currentRole = currentUser?.role
//   const relevantModules = ROLE_MODULES[currentRole] || []
//   const isReviewerRole = currentRole === 'admin' || currentRole === 'superadmin'

//   const isFollowupRole = currentRole === 'followup'

//   // Chain call_history chronologically per enquiry — each call (after the first) has an
//   // implicit "due date" = the followup_date set on the previous call. Comparing the two
//   // tells us whether this follow-up call happened on time or late.
//   const taggedCalls = useMemo(() => {
//     const byEnquiry = {}
//     callHistory.forEach(c => {
//       if (!byEnquiry[c.enquiry_id]) byEnquiry[c.enquiry_id] = []
//       byEnquiry[c.enquiry_id].push(c)
//     })

//     const tagged = []
//     Object.values(byEnquiry).forEach(calls => {
//       const sorted = [...calls].sort((a, b) => new Date(a.date) - new Date(b.date))
//       for (let i = 1; i < sorted.length; i++) {
//         const dueDate = sorted[i - 1].followup_date
//         if (!dueDate) continue // previous call didn't schedule a next follow-up — nothing to measure
//         const delayHrs = (new Date(sorted[i].date) - new Date(dueDate)) / 3600000
//         tagged.push({ ...sorted[i], dueDate, delayHrs, isLate: delayHrs > 0 })
//       }
//     })
//     return tagged
//   }, [callHistory])

//   const myTaggedCalls = useMemo(() => {
//     if (!isFollowupRole) return []
//     return taggedCalls.filter(c =>
//       c.logged_by === selectedUser && inDateRange(c.date) && matchesEnquiry(c.enquiry_id)
//     )
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [taggedCalls, isFollowupRole, selectedUser, filter.fromDate, filter.toDate, selectedEnquiry])

//   const myAllCalls = useMemo(() => {
//     if (!isFollowupRole) return []
//     return callHistory.filter(c =>
//       c.logged_by === selectedUser && inDateRange(c.date) && matchesEnquiry(c.enquiry_id)
//     )
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [callHistory, isFollowupRole, selectedUser, filter.fromDate, filter.toDate, selectedEnquiry])

//   const followupStats = useMemo(() => {
//     const onTime = myTaggedCalls.filter(c => !c.isLate)
//     const late = myTaggedCalls.filter(c => c.isLate)
//     const onTimePct = myTaggedCalls.length > 0 ? Math.round((onTime.length / myTaggedCalls.length) * 100) : 0
//     const avgDelayLate = late.length > 0 ? late.reduce((s, c) => s + c.delayHrs, 0) / late.length : null
//     return {
//       totalCalls: myAllCalls.length,
//       measurable: myTaggedCalls.length,
//       onTime: onTime.length,
//       late: late.length,
//       onTimePct,
//       avgDelayLate,
//     }
//   }, [myTaggedCalls, myAllCalls])

//   const today = new Date().toISOString().slice(0, 10)
//   const currentBacklog = useMemo(
//     () => enquiries.filter(e => e.status === 'Active' && e.next_followup_date && e.next_followup_date < today).length,
//     [enquiries, today]
//   )

//   const myBackendEnquiryIds = useMemo(() => {
//     if (!currentUser) return new Set()
//     return new Set(enquiries.filter(e => e.assign_to_backend === currentUser.name).map(e => e.enquiry_id))
//   }, [enquiries, currentUser])

//   function inDateRange(dateStr) {
//     if (!dateStr) return !filter.fromDate && !filter.toDate
//     const d = dateStr.slice(0, 10)
//     if (filter.fromDate && d < filter.fromDate) return false
//     if (filter.toDate && d > filter.toDate) return false
//     return true
//   }

//   function matchesEnquiry(enquiryId) {
//     return !selectedEnquiry || selectedEnquiry === enquiryId
//   }

//   // Flowchart / Quotation — only meaningful for backend team (enquiry-level assignment)
//   const myFc = useMemo(() => {
//     if (!currentUser || !relevantModules.includes('Flowchart')) return []
//     return fcTasks.filter(t => myBackendEnquiryIds.has(t.enquiry_id) && inDateRange(t.assigned_date) && matchesEnquiry(t.enquiry_id))
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [fcTasks, myBackendEnquiryIds, currentUser, filter.fromDate, filter.toDate, selectedEnquiry, relevantModules])

//   const myQt = useMemo(() => {
//     if (!currentUser || !relevantModules.includes('Quotation')) return []
//     return qtTasks.filter(t => myBackendEnquiryIds.has(t.enquiry_id) && inDateRange(t.shared_date) && matchesEnquiry(t.enquiry_id))
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [qtTasks, myBackendEnquiryIds, currentUser, filter.fromDate, filter.toDate, selectedEnquiry, relevantModules])

//   const myQr = useMemo(() => {
//     if (!currentUser || !relevantModules.includes('Questionnaire')) return []
//     return qrTasks.filter(t => myBackendEnquiryIds.has(t.enquiry_id) && inDateRange(t.sent_date) && matchesEnquiry(t.enquiry_id))
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [qrTasks, myBackendEnquiryIds, currentUser, filter.fromDate, filter.toDate, selectedEnquiry, relevantModules])

//   // questionnaire_rounds has no version column — number each enquiry's rounds
//   // chronologically (1st round sent = V1, 2nd = V2, ...) so it still shows a version.
//   const qrVersionMap = useMemo(() => {
//     const counters = {}
//     const map = {}
//     ;[...myQr]
//       .sort((a, b) => new Date(a.sent_date) - new Date(b.sent_date))
//       .forEach(r => {
//         counters[r.enquiry_id] = (counters[r.enquiry_id] || 0) + 1
//         map[r.id] = `V${counters[r.enquiry_id]}`
//       })
//     return map
//   }, [myQr])

//   // GA Drawing / Work Order — designer = assignee, admin/superadmin = reviewer (system-wide pool)
//   const myGa = useMemo(() => {
//     if (!currentUser || !relevantModules.includes('GA Drawing')) return []
//     if (isReviewerRole) {
//       return gaTasks.filter(t => inDateRange(t.assigned_date) && matchesEnquiry(t.enquiry_id))
//     }
//     return gaTasks.filter(t => t.assigned_to === currentUser.name && inDateRange(t.assigned_date) && matchesEnquiry(t.enquiry_id))
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [gaTasks, currentUser, filter.fromDate, filter.toDate, selectedEnquiry, relevantModules, isReviewerRole])

//   const myWo = useMemo(() => {
//     if (!currentUser || !relevantModules.includes('Work Order')) return []
//     if (isReviewerRole) {
//       return woTasks.filter(t => inDateRange(t.assigned_date) && matchesEnquiry(t.enquiry_id))
//     }
//     return woTasks.filter(t => t.assigned_to === currentUser.name && inDateRange(t.assigned_date) && matchesEnquiry(t.enquiry_id))
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [woTasks, currentUser, filter.fromDate, filter.toDate, selectedEnquiry, relevantModules, isReviewerRole])

//   // latest "Assigned" stage_log timestamp per enquiry — used as the TAT
//   // start-point for Backend's own Flowchart / Quotation / Questionnaire
//   // turnaround (GA Drawing / Work Order stay on their existing Designer/Admin
//   // based tracking, untouched below).
//   const backendAssignedMap = useMemo(() => {
//     const map = {}
//     stageLogs.forEach(l => {
//       if (!myBackendEnquiryIds.has(l.enquiry_id)) return
//       const existing = map[l.enquiry_id]
//       if (!existing || new Date(l.date_entered) < new Date(existing)) map[l.enquiry_id] = l.date_entered
//     })
//     return map
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [stageLogs, myBackendEnquiryIds])

//   // Latest Questionnaire round per enquiry — cascades the Flowchart/Quotation
//   // TAT start-point: Received date if received, else Sent date, else fall
//   // back to plain Assigned date (backendAssignedMap).
//   const qrByEnquiryMap = useMemo(() => {
//     const map = {}
//     myQr.forEach(t => {
//       const existing = map[t.enquiry_id]
//       if (!existing || new Date(t.sent_date) > new Date(existing.sent_date)) map[t.enquiry_id] = t
//     })
//     return map
//   }, [myQr])

//   function getCascadingStart(enquiryId) {
//     const qr = qrByEnquiryMap[enquiryId]
//     if (qr) return qr.received_date || qr.sent_date
//     return backendAssignedMap[enquiryId] || null
//   }

//   function computeBackendTatInfo(rows, endField, target, useCascadingStart = false) {
//     const groups = {}
//     rows.forEach(r => {
//       const key = r.enquiry_id
//       if (!key) return
//       if (!groups[key]) groups[key] = []
//       groups[key].push(r)
//     })
//     const hrsList = Object.keys(groups).map(enquiryId => {
//       const start = useCascadingStart ? getCascadingStart(enquiryId) : backendAssignedMap[enquiryId]
//       if (!start) return null
//       const ends = groups[enquiryId].map(r => r[endField]).filter(Boolean).map(d => new Date(d).getTime())
//       if (!ends.length) return null
//       const end = new Date(Math.min(...ends)).toISOString()
//       return hrsDiff(start, end)
//     }).filter(h => h !== null)

//     if (hrsList.length === 0) return { avgTat: null, onTimePct: null }
//     const onTime = hrsList.filter(h => h <= target).length
//     const avgTat = hrsList.reduce((s, h) => s + h, 0) / hrsList.length
//     const onTimePct = Math.round((onTime / hrsList.length) * 100)
//     return { avgTat, onTimePct }
//   }

//   const fcTatInfo = useMemo(() => computeBackendTatInfo(myFc, 'client_shared_date', targets.flowchart, true),
//     [myFc, backendAssignedMap, qrByEnquiryMap, targets.flowchart]) // eslint-disable-line react-hooks/exhaustive-deps
//   const fcStats = {
//     ...computeAssigneeStats(myFc, 'Client Approved', ['Client Revision Requested'], targets.flowchart, null),
//     ...fcTatInfo,
//   }
//   const qtTatInfo = useMemo(() => {
//     if (!currentUser || !relevantModules.includes('Quotation')) return { avgTat: null, onTimePct: null }
//     return computeBackendTatInfo(myQt, 'shared_date', targets.quotation, true)
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [myQt, backendAssignedMap, qrByEnquiryMap, currentUser, relevantModules, targets.quotation])

//   const qtStats = { ...computeAssigneeStats(myQt, 'Sent', ['Revision'], null, null), ...qtTatInfo }
//   const qrTatInfo = useMemo(() => computeBackendTatInfo(myQr, 'sent_date', targets.questionnaire),
//     [myQr, backendAssignedMap, targets.questionnaire]) // eslint-disable-line react-hooks/exhaustive-deps
//   const qrStats = {
//     ...computeAssigneeStats(myQr, 'Received', null, targets.questionnaire, null),
//     ...qrTatInfo,
//   }

//   const gaStats = isReviewerRole
//     ? computeAdminReviewStats(myGa, 'Approved by Admin', 'Rejected by Admin', selectedUser, targets.adminApproval)
//     : computeAssigneeStats(
//       myGa, 'Client Approved', ['Rejected by Admin', 'Client Revision Requested'], targets.gaDrawing,
//       { startField: 'assigned_date', endField: 'client_approved_date', successStatuses: ['Client Approved'], personField: 'assigned_to' }
//     )

//   const woStats = isReviewerRole
//     ? computeAdminReviewStats(myWo, 'Approved', 'Rejected', selectedUser, targets.adminApproval)
//     : computeAssigneeStats(
//       myWo, 'Approved', ['Rejected'], targets.workOrder,
//       { startField: 'assigned_date', endField: 'admin_review_date', successStatuses: ['Approved'], personField: 'assigned_to' }
//     )

//   const moduleRows = [
//     { name: 'Flowchart', stats: fcStats },
//     { name: 'Quotation', stats: qtStats },
//     { name: 'Questionnaire', stats: qrStats },
//     { name: 'GA Drawing', stats: gaStats },
//     { name: 'Work Order', stats: woStats },
//   ].filter(m => relevantModules.includes(m.name))

//   // ── Detailed activity table (flattened, role-relevant modules only) ──
//   const activityRows = useMemo(() => {
//     const rows = []
//     if (relevantModules.includes('Flowchart')) myFc.forEach(t => rows.push({ module: 'Flowchart', enquiryId: t.enquiry_id, version: t.version, status: t.status, date: t.assigned_date }))
//     if (relevantModules.includes('Quotation')) myQt.forEach(t => rows.push({ module: 'Quotation', enquiryId: t.enquiry_id, version: t.version, status: t.status, date: t.shared_date }))
//     if (relevantModules.includes('Questionnaire')) myQr.forEach(t => rows.push({ module: 'Questionnaire', enquiryId: t.enquiry_id, version: qrVersionMap[t.id], status: t.status, date: t.received_date || t.sent_date }))
//     if (relevantModules.includes('GA Drawing')) myGa.forEach(t => rows.push({ module: 'GA Drawing', enquiryId: t.enquiry_id, version: t.version, status: t.status, date: isReviewerRole ? (t.admin_review_date || t.assigned_date) : t.assigned_date }))
//     if (relevantModules.includes('Work Order')) myWo.forEach(t => rows.push({ module: 'Work Order', enquiryId: t.enquiry_id, version: t.version, status: t.status, date: isReviewerRole ? (t.admin_review_date || t.assigned_date) : t.assigned_date }))
//     return rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
//   }, [myFc, myQt, myQr, myGa, myWo, relevantModules, isReviewerRole, qrVersionMap])

//   const totalAssigned = moduleRows.reduce((s, m) => s + m.stats.total, 0)
//   const totalApproved = moduleRows.reduce((s, m) => s + m.stats.approved, 0)
//   const totalRejected = moduleRows.reduce((s, m) => s + m.stats.rejected, 0)
//   const totalPending = moduleRows.reduce((s, m) => s + m.stats.pending, 0)

//   const enquiryOptions = useMemo(() => {
//     const ids = new Set([
//       ...myBackendEnquiryIds,
//       ...gaTasks.filter(t => t.assigned_to === selectedUser).map(t => t.enquiry_id),
//       ...woTasks.filter(t => t.assigned_to === selectedUser).map(t => t.enquiry_id),
//     ])
//     return [...ids].map(id => ({ id, label: `${id} — ${enqMap[id]?.company_name || '—'}` })).sort((a, b) => a.id.localeCompare(b.id))
//   }, [myBackendEnquiryIds, gaTasks, woTasks, selectedUser, enqMap])

//   function moduleRowDate(moduleName, row) {
//     if (moduleName === 'Flowchart') return row.assigned_date
//     if (moduleName === 'Quotation') return row.shared_date
//     if (moduleName === 'Questionnaire') return row.received_date || row.sent_date
//     if (moduleName === 'GA Drawing') return isReviewerRole ? (row.admin_review_date || row.assigned_date) : row.assigned_date
//     if (moduleName === 'Work Order') return isReviewerRole ? (row.admin_review_date || row.assigned_date) : row.assigned_date
//     return row.assigned_date || row.created_at
//   }

//   function openBucketDetail(moduleName, bucketLabel, rows) {
//     if (!rows || rows.length === 0) return
//     const formatted = [...rows]
//       .map(r => ({
//         enquiryId: r.enquiry_id,
//         version: moduleName === 'Questionnaire' ? (qrVersionMap[r.id] || 'V1') : r.version,
//         status: r.status,
//         date: moduleRowDate(moduleName, r),
//       }))
//       .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
//     setActiveModal({ title: `${moduleName} — ${bucketLabel} (${formatted.length})`, rows: formatted })
//   }

//   function handleExportCSV() {
//     const headers = ['Module', assignedColLabel, 'Approved', 'Rejected', 'Pending', 'Approval %', 'Avg TAT', 'On-Time %']
//     const rows = moduleRows.map(({ name, stats }) => [
//       name,
//       stats.total,
//       stats.approved,
//       stats.rejected,
//       stats.pending,
//       `${stats.pct}%`,
//       stats.avgTat !== null && stats.avgTat !== undefined ? fmtHrs(stats.avgTat) : '—',
//       stats.onTimePct !== null && stats.onTimePct !== undefined ? `${stats.onTimePct}%` : '—',
//     ])
//     const dateSuffix = new Date().toISOString().slice(0, 10)
//     downloadCSV(`ReportCard_${selectedUser.replace(/\s+/g, '_')}_${dateSuffix}.csv`, headers, rows)
//   }

//   if (loading) {
//     return <div className="rc-loading"><i className="fas fa-spinner fa-spin"></i> Loading report card…</div>
//   }

//   const assignedColLabel = isReviewerRole ? 'Came for Approval' : 'Assigned'

//   return (
//     <div className="rc-wrap">
//       <p className="rc-subtitle">Complete per-person work breakdown across Flowchart, Quotation, GA Drawing &amp; Work Order</p>

//       <div className="rc-filters-card">
//         <div className="rc-filter-row">
//           <div className="rc-filter-group">
//             <label>User</label>
//             <select
//               value={selectedUser}
//               onChange={e => { setSelectedUser(e.target.value); setSelectedEnquiry('') }}
//               disabled={!isAdminViewer}
//             >
//               {users.map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}
//             </select>
//           </div>
//           <div className="rc-filter-group">
//             <label>Enquiry</label>
//             <select value={selectedEnquiry} onChange={e => setSelectedEnquiry(e.target.value)}>
//               <option value="">All Enquiries</option>
//               {enquiryOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
//             </select>
//           </div>
//           <button className="rc-export-btn" onClick={handleExportCSV} disabled={moduleRows.length === 0}>
//             <i className="fas fa-file-csv"></i> Download CSV
//           </button>
//         </div>
//         <DateFilterBar filter={filter} />
//       </div>

//       {currentUser && (
//         <div className="rc-user-header">
//           <div className="rc-user-avatar">{currentUser.name.charAt(0).toUpperCase()}</div>
//           <div>
//             <div className="rc-user-name">{currentUser.name}</div>
//             <div className="rc-user-role">{currentUser.role} · {currentUser.email || 'no email on file'}</div>
//           </div>
//           {isReviewerRole && (
//             <div className="rc-reviewer-tag">
//               <i className="fas fa-user-shield"></i> Reviewer view — shows what they approved/rejected, not what's "assigned" to them
//             </div>
//           )}
//         </div>
//       )}

//       {/* ── Overall totals ─────────────────────────────────── */}
//       <div className="rc-totals-grid">
//         {isFollowupRole ? (
//           <>
//             <div className="rc-total-card">
//               <div className="rc-total-val" style={{ color: 'var(--slate-900)' }}>{followupStats.totalCalls}</div>
//               <div className="rc-total-lbl">Total Calls Logged</div>
//             </div>
//             <div className="rc-total-card">
//               <div className="rc-total-val" style={{ color: '#059669' }}>{followupStats.onTime}</div>
//               <div className="rc-total-lbl">On Time</div>
//             </div>
//             <div className="rc-total-card">
//               <div className="rc-total-val" style={{ color: 'var(--rose)' }}>{followupStats.late}</div>
//               <div className="rc-total-lbl">Late</div>
//             </div>
//             <div className="rc-total-card">
//               <div className="rc-total-val" style={{ color: 'var(--amber)' }}>{followupStats.onTimePct}%</div>
//               <div className="rc-total-lbl">On-Time Rate</div>
//             </div>
//           </>
//         ) : (
//           <>
//             <div className="rc-total-card">
//               <div className="rc-total-val" style={{ color: 'var(--slate-900)' }}>{totalAssigned}</div>
//               <div className="rc-total-lbl">Total {assignedColLabel}</div>
//             </div>
//             <div className="rc-total-card">
//               <div className="rc-total-val" style={{ color: '#059669' }}>{totalApproved}</div>
//               <div className="rc-total-lbl">Approved</div>
//             </div>
//             <div className="rc-total-card">
//               <div className="rc-total-val" style={{ color: 'var(--rose)' }}>{totalRejected}</div>
//               <div className="rc-total-lbl">Rejected / Revised</div>
//             </div>
//             <div className="rc-total-card">
//               <div className="rc-total-val" style={{ color: 'var(--amber)' }}>{totalPending}</div>
//               <div className="rc-total-lbl">Pending</div>
//             </div>
//           </>
//         )}
//       </div>

//       {/* ── Follow-up Timeliness (followup role only) ───────── */}
//       {isFollowupRole && (
//         <div className="rc-card">
//           <div className="rc-card-header">
//             <div className="rc-card-title">🔔 Follow-up Timeliness</div>
//             <span className="rc-count-sm">Currently {currentBacklog} enquiries overdue system-wide</span>
//           </div>
//           <div className="rc-followup-body">
//             <div className="rc-followup-summary">
//               <div className="rc-followup-bar-row">
//                 <div className="rc-followup-bar">
//                   <div className="rc-followup-bar-fill" style={{ width: `${followupStats.onTimePct}%`, background: '#059669' }}></div>
//                 </div>
//                 <span className="rc-followup-pct">{followupStats.onTimePct}% on time</span>
//               </div>
//               <div className="rc-followup-sub">
//                 {followupStats.measurable} follow-ups measurable · {followupStats.onTime} on time · {followupStats.late} late
//                 {followupStats.avgDelayLate !== null && <> · avg delay when late: <strong>{fmtHrs(followupStats.avgDelayLate)}</strong></>}
//               </div>
//               <div className="rc-followup-note">
//                 <i className="fas fa-info-circle"></i> "On time" means the call was logged on or before the follow-up date scheduled during the previous call. The very first call on an enquiry has no prior due date, so it isn't counted here.
//               </div>
//             </div>

//             <div className="rc-followup-recent-label">Recent Activity</div>
//             <div className="rc-followup-recent-list">
//               {myTaggedCalls.length === 0 ? (
//                 <div className="rc-empty">No measurable follow-up activity for the selected filters</div>
//               ) : (
//                 [...myTaggedCalls].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8).map((c, i) => (
//                   <div className="rc-followup-row" key={i} onClick={() => navigate(`/enquiries/${c.enquiry_id}`)}>
//                     <span className="rc-followup-dot" style={{ background: c.isLate ? 'var(--rose)' : '#059669' }}></span>
//                     <div className="rc-followup-info">
//                       <div className="rc-followup-id">{c.enquiry_id} <span className="rc-followup-company">{enqMap[c.enquiry_id]?.company_name || ''}</span></div>
//                       <div className="rc-followup-dates">
//                         Due {formatDateDisplay(c.dueDate)} → Called {formatDateDisplay(c.date)}
//                       </div>
//                     </div>
//                     <span className={`rc-followup-badge ${c.isLate ? 'rose' : 'green'}`}>
//                       {c.isLate ? `✗ Late by ${fmtHrs(c.delayHrs)}` : '✓ On Time'}
//                     </span>
//                   </div>
//                 ))
//               )}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Module-wise breakdown table ────────────────────── */}
//       {!isFollowupRole && (
//       <div className="rc-card">
//         <div className="rc-card-header">
//           <div className="rc-card-title">📊 Module-wise Breakdown</div>
//         </div>
//         <div className="rc-table-wrap">
//           <table className="rc-table">
//             <thead>
//               <tr>
//                 <th>Module</th><th>{assignedColLabel}</th><th>Approved</th><th>Rejected</th><th>Pending</th>
//                 <th>Approval %</th><th>Avg TAT</th><th>On-Time %</th>
//               </tr>
//             </thead>
//             <tbody>
//               {moduleRows.length === 0 ? (
//                 <tr><td colSpan={8} className="rc-empty">No module-linked work applies to this role.</td></tr>
//               ) : (
//                 moduleRows.map(({ name, stats }) => {
//                   const info = MODULE_INFO[name]
//                   return (
//                     <tr key={name}>
//                       <td>
//                         <span className="rc-module-badge" style={{ background: `${info.color}18`, color: info.color }}>
//                           {info.icon} {name}
//                         </span>
//                       </td>
//                       <td className="rc-num rc-clickable" onClick={() => openBucketDetail(name, assignedColLabel, stats.rows.all)}>{stats.total}</td>
//                       <td className="rc-num rc-green rc-clickable" onClick={() => openBucketDetail(name, 'Approved', stats.rows.approved)}>{stats.approved}</td>
//                       <td className="rc-num rc-rose rc-clickable" onClick={() => openBucketDetail(name, 'Rejected', stats.rows.rejected)}>{stats.rejected}</td>
//                       <td className="rc-num rc-amber rc-clickable" onClick={() => openBucketDetail(name, 'Pending', stats.rows.pending)}>{stats.pending}</td>
//                       <td style={{ minWidth: 110 }}>
//                         <div className="rc-progress-row">
//                           <div className="rc-progress-bar"><div className="rc-progress-fill" style={{ width: `${stats.pct}%`, background: info.color }}></div></div>
//                           <span style={{ color: info.color, fontWeight: 800, fontSize: 12 }}>{stats.pct}%</span>
//                         </div>
//                       </td>
//                       <td className="qp-mono">{stats.avgTat !== null && stats.avgTat !== undefined ? fmtHrs(stats.avgTat) : '—'}</td>
//                       <td>
//                         {stats.onTimePct !== null && stats.onTimePct !== undefined ? (
//                           <div className="rc-progress-row">
//                             <div className="rc-progress-bar"><div className="rc-progress-fill" style={{ width: `${stats.onTimePct}%`, background: '#0369a1' }}></div></div>
//                             <span style={{ color: '#0369a1', fontWeight: 800, fontSize: 12 }}>{stats.onTimePct}%</span>
//                           </div>
//                         ) : '—'}
//                       </td>
//                     </tr>
//                   )
//                 })
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//       )}

//       {/* ── Detailed activity table (skipped for followup — Recent Activity above covers it) ── */}
//       {!isFollowupRole && (
//       <div className="rc-card">
//         <div className="rc-card-header">
//           <div className="rc-card-title">📋 Detailed Activity <span className="rc-count-sm">({activityRows.length} records)</span></div>
//         </div>
//         <div className="rc-table-wrap">
//           <table className="rc-table">
//             <thead>
//               <tr>
//                 <th>Module</th><th>Enquiry ID</th><th>Company</th><th>Version</th><th>Status</th><th>Date</th>
//               </tr>
//             </thead>
//             <tbody>
//               {activityRows.length === 0 ? (
//                 <tr><td colSpan={6} className="rc-empty">No activity found for the selected filters</td></tr>
//               ) : (
//                 activityRows.map((r, i) => {
//                   const info = MODULE_INFO[r.module]
//                   return (
//                     <tr key={i} onClick={() => navigate(`/enquiries/${r.enquiryId}`)}>
//                       <td>
//                         <span className="rc-module-badge" style={{ background: `${info.color}18`, color: info.color }}>
//                           {info.icon} {r.module}
//                         </span>
//                       </td>
//                       <td><span className="qp-id">{r.enquiryId}</span></td>
//                       <td>{enqMap[r.enquiryId]?.company_name || '—'}</td>
//                       <td className="qp-mono">{r.version || '—'}</td>
//                       <td><span className="rc-status-badge">{r.status}</span></td>
//                       <td className="qp-mono">{formatDateDisplay(r.date)}</td>
//                     </tr>
//                   )
//                 })
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//       )}

//       {activeModal && (
//         <div className="rc-modal-overlay" onClick={() => setActiveModal(null)}>
//           <div className="rc-modal" onClick={e => e.stopPropagation()}>
//             <div className="rc-modal-header">
//               <span>{activeModal.title}</span>
//               <button onClick={() => setActiveModal(null)}><i className="fas fa-times"></i></button>
//             </div>
//             <div className="rc-modal-body">
//               <table className="rc-table">
//                 <thead>
//                   <tr><th>Enquiry ID</th><th>Company</th><th>Version</th><th>Status</th><th>Date</th></tr>
//                 </thead>
//                 <tbody>
//                   {activeModal.rows.map((r, i) => (
//                     <tr key={i} onClick={() => { setActiveModal(null); navigate(`/enquiries/${r.enquiryId}`) }}>
//                       <td><span className="qp-id">{r.enquiryId}</span></td>
//                       <td>{enqMap[r.enquiryId]?.company_name || '—'}</td>
//                       <td className="qp-mono">{r.version || '—'}</td>
//                       <td><span className="rc-status-badge">{r.status}</span></td>
//                       <td className="qp-mono">{formatDateDisplay(r.date)}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useDateRangeFilter } from '../lib/useDateRangeFilter'
import { downloadCSV } from '../lib/csvHelpers'
import { formatDateDisplay } from '../lib/dateHelpers'
import { DEFAULT_TAT_TARGETS, parseHrs, hrsDiff, fmtHrs, buildEnquiryLevelRecords } from '../lib/tatHelpers'
import DateFilterBar from '../components/DateFilterBar'
import './queues/QueuePages.css'
import './ReportCard.css'

const MODULE_INFO = {
  Flowchart: { icon: '🗂', color: '#6d28d9' },
  Quotation: { icon: '💰', color: '#0369a1' },
  'GA Drawing': { icon: '📐', color: '#0d9488' },
  'Work Order': { icon: '📋', color: '#059669' },
  Questionnaire: { icon: '📄', color: '#b45309' },
}

// which modules are relevant for a report card, based on the selected person's role
const ROLE_MODULES = {
  design: ['GA Drawing', 'Work Order'],
  backend: ['Flowchart', 'Quotation', 'Questionnaire'],
  admin: ['GA Drawing', 'Work Order'],
  superadmin: ['GA Drawing', 'Work Order'],
}

// stats for someone who is the ASSIGNEE of the work (Designer on GA Drawing / Work Order,
// or Backend on Flowchart) — includes their own turnaround time.
function computeAssigneeStats(rows, approvedStatus, rejectedStatuses, target, tatConfig) {
  const total = rows.length
  const approvedRows = rows.filter(r => r.status === approvedStatus)
  const rejectedRows = rejectedStatuses ? rows.filter(r => rejectedStatuses.includes(r.status)) : []
  const approvedIds = new Set(approvedRows.map(r => r.id))
  const rejectedIds = new Set(rejectedRows.map(r => r.id))
  const pendingRows = rows.filter(r => !approvedIds.has(r.id) && !rejectedIds.has(r.id))
  const pct = total > 0 ? Math.round((approvedRows.length / total) * 100) : 0

  // Designer ka revision_count — ek hi task row pe cumulative counter hota hai
  // (reject/resubmit se increment hota hai), isliye "Rejected" se zyada accurate
  // ye batata hai ki us task pe total kitni revisions hui.
  const revisionRows = rows.filter(r => (r.revision_count || 0) > 0)
  const totalRevisions = rows.reduce((s, r) => s + (r.revision_count || 0), 0)

  let avgTat = null, onTimePct = null
  if (tatConfig) {
    const records = buildEnquiryLevelRecords(rows, tatConfig)
    const completed = records.filter(r => r.hrs !== null)
    const onTime = completed.filter(r => r.hrs <= target).length
    avgTat = completed.length ? completed.reduce((s, r) => s + r.hrs, 0) / completed.length : null
    onTimePct = completed.length ? Math.round((onTime / completed.length) * 100) : 0
  }
  return {
    total, approved: approvedRows.length, rejected: rejectedRows.length, pending: pendingRows.length, pct, avgTat, onTimePct,
    revisions: totalRevisions,
    rows: { all: rows, approved: approvedRows, rejected: rejectedRows, pending: pendingRows, revisions: revisionRows },
  }
}

// stats for an ADMIN reviewing GA Drawing / Work Order submissions — they aren't the
// "assignee", they're the reviewer, so the numbers mean something different:
//  - total  = everything that has ever come in for approval (system-wide)
//  - approved/rejected = decisions made specifically BY this admin
//  - pending = submissions still waiting on someone to review them (system-wide)
//  - TAT = how fast THIS admin reviews once something lands in their queue
function computeAdminReviewStats(rows, approvedStatus, rejectedStatus, adminName, target) {
  const submitted = rows.filter(r => r.designer_submission_date)
  const reviewedByMe = rows.filter(r => r.admin_review_by === adminName && r.admin_review_date)
  const approvedRows = reviewedByMe.filter(r => r.status === approvedStatus)
  const rejectedRows = reviewedByMe.filter(r => r.status === rejectedStatus)
  const pendingRows = submitted.filter(r => !r.admin_review_date)
  const total = submitted.length
  const pct = reviewedByMe.length > 0 ? Math.round((approvedRows.length / reviewedByMe.length) * 100) : 0

  const tatRows = reviewedByMe
    .map(r => hrsDiff(r.designer_submission_date, r.admin_review_date))
    .filter(h => h !== null)
  const onTime = tatRows.filter(h => h <= target).length
  const avgTat = tatRows.length ? tatRows.reduce((s, h) => s + h, 0) / tatRows.length : null
  const onTimePct = tatRows.length ? Math.round((onTime / tatRows.length) * 100) : 0

  return {
    total, approved: approvedRows.length, rejected: rejectedRows.length, pending: pendingRows.length, pct, avgTat, onTimePct,
    rows: { all: submitted, approved: approvedRows, rejected: rejectedRows, pending: pendingRows },
  }
}

export default function ReportCard() {
  const navigate = useNavigate()
  const filter = useDateRangeFilter()
  const { user: loggedInUser } = useAuth()
  const isAdminViewer = loggedInUser?.role === 'admin' || loggedInUser?.role === 'superadmin'

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [fcTasks, setFcTasks] = useState([])
  const [qtTasks, setQtTasks] = useState([])
  const [gaTasks, setGaTasks] = useState([])
  const [woTasks, setWoTasks] = useState([])
  const [qrTasks, setQrTasks] = useState([])
  const [stageLogs, setStageLogs] = useState([])
  const [callHistory, setCallHistory] = useState([])
  const [targets, setTargets] = useState(DEFAULT_TAT_TARGETS)

  const [selectedUser, setSelectedUser] = useState('')
  const [activeModal, setActiveModal] = useState(null) // { title, rows }
  const [selectedEnquiry, setSelectedEnquiry] = useState('')

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
      { data: qrRows },
      { data: slRows },
      { data: chRows },
      { data: ddRows },
    ] = await Promise.all([
      supabase.from('users').select('*').eq('active', true).order('name', { ascending: true }),
      supabase.from('enquiries').select('*'),
      supabase.from('flowchart_tasks').select('*'),
      supabase.from('quotation_versions').select('*'),
      supabase.from('ga_drawing_tasks').select('*'),
      supabase.from('work_orders').select('*'),
      supabase.from('questionnaire_rounds').select('*'),
      supabase.from('stage_logs').select('*').eq('stage_name', 'Assigned'),
      supabase.from('call_history').select('*'),
      supabase.from('dropdown_list').select('flowchart, quotation, ga_drawing, work_order, tat_admin_approval, questionnaire').order('id', { ascending: true }).limit(1),
    ])

    const nonSuperadmin = (userRows || []).filter(u => u.role !== 'superadmin')
    setUsers(nonSuperadmin)
    setEnquiries(enqRows || [])
    setFcTasks(fcRows || [])
    setQtTasks(qtRows || [])
    setGaTasks(gaRows || [])
    setWoTasks(woRows || [])
    setQrTasks(qrRows || [])
    setStageLogs(slRows || [])
    setCallHistory(chRows || [])

    const s = ddRows?.[0] || {}
    setTargets({
      flowchart: parseHrs(s.flowchart, DEFAULT_TAT_TARGETS.flowchart),
      quotation: parseHrs(s.quotation, DEFAULT_TAT_TARGETS.quotation),
      gaDrawing: parseHrs(s.ga_drawing, DEFAULT_TAT_TARGETS.gaDrawing),
      workOrder: parseHrs(s.work_order, DEFAULT_TAT_TARGETS.workOrder),
      adminApproval: parseHrs(s.tat_admin_approval, DEFAULT_TAT_TARGETS.adminApproval),
      questionnaire: parseHrs(s.questionnaire, DEFAULT_TAT_TARGETS.questionnaire),
    })

    if (isAdminViewer) {
      if (nonSuperadmin.length > 0) setSelectedUser(nonSuperadmin[0].name)
    } else if (loggedInUser?.name) {
      setSelectedUser(loggedInUser.name)
    }

    setLoading(false)
  }

  const enqMap = useMemo(() => {
    const m = {}
    enquiries.forEach(e => { m[e.enquiry_id] = e })
    return m
  }, [enquiries])

  const currentUser = users.find(u => u.name === selectedUser)
  const currentRole = currentUser?.role
  const relevantModules = ROLE_MODULES[currentRole] || []
  const isReviewerRole = currentRole === 'admin' || currentRole === 'superadmin'

  const isFollowupRole = currentRole === 'followup'

  // Chain call_history chronologically per enquiry — each call (after the first) has an
  // implicit "due date" = the followup_date set on the previous call. Comparing the two
  // tells us whether this follow-up call happened on time or late.
  const taggedCalls = useMemo(() => {
    const byEnquiry = {}
    callHistory.forEach(c => {
      if (!byEnquiry[c.enquiry_id]) byEnquiry[c.enquiry_id] = []
      byEnquiry[c.enquiry_id].push(c)
    })

    const tagged = []
    Object.values(byEnquiry).forEach(calls => {
      const sorted = [...calls].sort((a, b) => new Date(a.date) - new Date(b.date))
      for (let i = 1; i < sorted.length; i++) {
        const dueDate = sorted[i - 1].followup_date
        if (!dueDate) continue // previous call didn't schedule a next follow-up — nothing to measure
        const delayHrs = (new Date(sorted[i].date) - new Date(dueDate)) / 3600000
        tagged.push({ ...sorted[i], dueDate, delayHrs, isLate: delayHrs > 0 })
      }
    })
    return tagged
  }, [callHistory])

  const myTaggedCalls = useMemo(() => {
    if (!isFollowupRole) return []
    return taggedCalls.filter(c =>
      c.logged_by === selectedUser && inDateRange(c.date) && matchesEnquiry(c.enquiry_id)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taggedCalls, isFollowupRole, selectedUser, filter.fromDate, filter.toDate, selectedEnquiry])

  const myAllCalls = useMemo(() => {
    if (!isFollowupRole) return []
    return callHistory.filter(c =>
      c.logged_by === selectedUser && inDateRange(c.date) && matchesEnquiry(c.enquiry_id)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callHistory, isFollowupRole, selectedUser, filter.fromDate, filter.toDate, selectedEnquiry])

  const followupStats = useMemo(() => {
    const onTime = myTaggedCalls.filter(c => !c.isLate)
    const late = myTaggedCalls.filter(c => c.isLate)
    const onTimePct = myTaggedCalls.length > 0 ? Math.round((onTime.length / myTaggedCalls.length) * 100) : 0
    const avgDelayLate = late.length > 0 ? late.reduce((s, c) => s + c.delayHrs, 0) / late.length : null
    return {
      totalCalls: myAllCalls.length,
      measurable: myTaggedCalls.length,
      onTime: onTime.length,
      late: late.length,
      onTimePct,
      avgDelayLate,
    }
  }, [myTaggedCalls, myAllCalls])

  const today = new Date().toISOString().slice(0, 10)
  const currentBacklog = useMemo(
    () => enquiries.filter(e => e.status === 'Active' && e.next_followup_date && e.next_followup_date < today).length,
    [enquiries, today]
  )

  const myBackendEnquiryIds = useMemo(() => {
    if (!currentUser) return new Set()
    return new Set(enquiries.filter(e => e.assign_to_backend === currentUser.name).map(e => e.enquiry_id))
  }, [enquiries, currentUser])

  function inDateRange(dateStr) {
    if (!dateStr) return !filter.fromDate && !filter.toDate
    const d = dateStr.slice(0, 10)
    if (filter.fromDate && d < filter.fromDate) return false
    if (filter.toDate && d > filter.toDate) return false
    return true
  }

  function matchesEnquiry(enquiryId) {
    return !selectedEnquiry || selectedEnquiry === enquiryId
  }

  // Flowchart / Quotation — only meaningful for backend team (enquiry-level assignment)
  const myFc = useMemo(() => {
    if (!currentUser || !relevantModules.includes('Flowchart')) return []
    return fcTasks.filter(t => myBackendEnquiryIds.has(t.enquiry_id) && inDateRange(t.assigned_date) && matchesEnquiry(t.enquiry_id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fcTasks, myBackendEnquiryIds, currentUser, filter.fromDate, filter.toDate, selectedEnquiry, relevantModules])

  const myQt = useMemo(() => {
    if (!currentUser || !relevantModules.includes('Quotation')) return []
    return qtTasks.filter(t => myBackendEnquiryIds.has(t.enquiry_id) && inDateRange(t.shared_date) && matchesEnquiry(t.enquiry_id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qtTasks, myBackendEnquiryIds, currentUser, filter.fromDate, filter.toDate, selectedEnquiry, relevantModules])

  const myQr = useMemo(() => {
    if (!currentUser || !relevantModules.includes('Questionnaire')) return []
    return qrTasks.filter(t => myBackendEnquiryIds.has(t.enquiry_id) && inDateRange(t.sent_date) && matchesEnquiry(t.enquiry_id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrTasks, myBackendEnquiryIds, currentUser, filter.fromDate, filter.toDate, selectedEnquiry, relevantModules])

  // questionnaire_rounds has no version column — number each enquiry's rounds
  // chronologically (1st round sent = V1, 2nd = V2, ...) so it still shows a version.
  const qrVersionMap = useMemo(() => {
    const counters = {}
    const map = {}
    ;[...myQr]
      .sort((a, b) => new Date(a.sent_date) - new Date(b.sent_date))
      .forEach(r => {
        counters[r.enquiry_id] = (counters[r.enquiry_id] || 0) + 1
        map[r.id] = `V${counters[r.enquiry_id]}`
      })
    return map
  }, [myQr])

  // GA Drawing / Work Order — designer = assignee, admin/superadmin = reviewer (system-wide pool)
  const myGa = useMemo(() => {
    if (!currentUser || !relevantModules.includes('GA Drawing')) return []
    if (isReviewerRole) {
      return gaTasks.filter(t => inDateRange(t.assigned_date) && matchesEnquiry(t.enquiry_id))
    }
    return gaTasks.filter(t => t.assigned_to === currentUser.name && inDateRange(t.assigned_date) && matchesEnquiry(t.enquiry_id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaTasks, currentUser, filter.fromDate, filter.toDate, selectedEnquiry, relevantModules, isReviewerRole])

  const myWo = useMemo(() => {
    if (!currentUser || !relevantModules.includes('Work Order')) return []
    if (isReviewerRole) {
      return woTasks.filter(t => inDateRange(t.assigned_date) && matchesEnquiry(t.enquiry_id))
    }
    return woTasks.filter(t => t.assigned_to === currentUser.name && inDateRange(t.assigned_date) && matchesEnquiry(t.enquiry_id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [woTasks, currentUser, filter.fromDate, filter.toDate, selectedEnquiry, relevantModules, isReviewerRole])

  // latest "Assigned" stage_log timestamp per enquiry — used as the TAT
  // start-point for Backend's own Flowchart / Quotation / Questionnaire
  // turnaround (GA Drawing / Work Order stay on their existing Designer/Admin
  // based tracking, untouched below).
  const backendAssignedMap = useMemo(() => {
    const map = {}
    stageLogs.forEach(l => {
      if (!myBackendEnquiryIds.has(l.enquiry_id)) return
      const existing = map[l.enquiry_id]
      if (!existing || new Date(l.date_entered) < new Date(existing)) map[l.enquiry_id] = l.date_entered
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageLogs, myBackendEnquiryIds])

  // Latest Questionnaire round per enquiry — cascades the Flowchart/Quotation
  // TAT start-point: Received date if received, else Sent date, else fall
  // back to plain Assigned date (backendAssignedMap).
  const qrByEnquiryMap = useMemo(() => {
    const map = {}
    myQr.forEach(t => {
      const existing = map[t.enquiry_id]
      if (!existing || new Date(t.sent_date) > new Date(existing.sent_date)) map[t.enquiry_id] = t
    })
    return map
  }, [myQr])

  function getCascadingStart(enquiryId) {
    const qr = qrByEnquiryMap[enquiryId]
    if (qr) return qr.received_date || qr.sent_date
    return backendAssignedMap[enquiryId] || null
  }

  function computeBackendTatInfo(rows, endField, target, useCascadingStart = false) {
    const groups = {}
    rows.forEach(r => {
      const key = r.enquiry_id
      if (!key) return
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    const hrsList = Object.keys(groups).map(enquiryId => {
      const start = useCascadingStart ? getCascadingStart(enquiryId) : backendAssignedMap[enquiryId]
      if (!start) return null
      const ends = groups[enquiryId].map(r => r[endField]).filter(Boolean).map(d => new Date(d).getTime())
      if (!ends.length) return null
      const end = new Date(Math.min(...ends)).toISOString()
      return hrsDiff(start, end)
    }).filter(h => h !== null)

    if (hrsList.length === 0) return { avgTat: null, onTimePct: null }
    const onTime = hrsList.filter(h => h <= target).length
    const avgTat = hrsList.reduce((s, h) => s + h, 0) / hrsList.length
    const onTimePct = Math.round((onTime / hrsList.length) * 100)
    return { avgTat, onTimePct }
  }

  const fcTatInfo = useMemo(() => computeBackendTatInfo(myFc, 'client_shared_date', targets.flowchart, true),
    [myFc, backendAssignedMap, qrByEnquiryMap, targets.flowchart]) // eslint-disable-line react-hooks/exhaustive-deps
  const fcStats = {
    ...computeAssigneeStats(myFc, 'Client Approved', ['Client Revision Requested'], targets.flowchart, null),
    ...fcTatInfo,
  }
  const qtTatInfo = useMemo(() => {
    if (!currentUser || !relevantModules.includes('Quotation')) return { avgTat: null, onTimePct: null }
    return computeBackendTatInfo(myQt, 'shared_date', targets.quotation, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myQt, backendAssignedMap, qrByEnquiryMap, currentUser, relevantModules, targets.quotation])

  const qtStats = { ...computeAssigneeStats(myQt, 'Sent', ['Revision'], null, null), ...qtTatInfo }
  const qrTatInfo = useMemo(() => computeBackendTatInfo(myQr, 'sent_date', targets.questionnaire),
    [myQr, backendAssignedMap, targets.questionnaire]) // eslint-disable-line react-hooks/exhaustive-deps
  const qrStats = {
    ...computeAssigneeStats(myQr, 'Received', null, targets.questionnaire, null),
    ...qrTatInfo,
  }

  const gaStats = isReviewerRole
    ? computeAdminReviewStats(myGa, 'Approved by Admin', 'Rejected by Admin', selectedUser, targets.adminApproval)
    : computeAssigneeStats(
      myGa, 'Client Approved', ['Rejected by Admin', 'Client Revision Requested'], targets.gaDrawing,
      { startField: 'assigned_date', endField: 'client_approved_date', successStatuses: ['Client Approved'], personField: 'assigned_to' }
    )

  const woStats = isReviewerRole
    ? computeAdminReviewStats(myWo, 'Approved', 'Rejected', selectedUser, targets.adminApproval)
    : computeAssigneeStats(
      myWo, 'Approved', ['Rejected'], targets.workOrder,
      { startField: 'assigned_date', endField: 'admin_review_date', successStatuses: ['Approved'], personField: 'assigned_to' }
    )

  const moduleRows = [
    { name: 'Flowchart', stats: fcStats },
    { name: 'Quotation', stats: qtStats },
    { name: 'Questionnaire', stats: qrStats },
    { name: 'GA Drawing', stats: gaStats },
    { name: 'Work Order', stats: woStats },
  ].filter(m => relevantModules.includes(m.name))

  // ── Detailed activity table (flattened, role-relevant modules only) ──
  const activityRows = useMemo(() => {
    const rows = []
    if (relevantModules.includes('Flowchart')) myFc.forEach(t => rows.push({ module: 'Flowchart', enquiryId: t.enquiry_id, version: t.version, status: t.status, date: t.assigned_date }))
    if (relevantModules.includes('Quotation')) myQt.forEach(t => rows.push({ module: 'Quotation', enquiryId: t.enquiry_id, version: t.version, status: t.status, date: t.shared_date }))
    if (relevantModules.includes('Questionnaire')) myQr.forEach(t => rows.push({ module: 'Questionnaire', enquiryId: t.enquiry_id, version: qrVersionMap[t.id], status: t.status, date: t.received_date || t.sent_date }))
    if (relevantModules.includes('GA Drawing')) myGa.forEach(t => rows.push({ module: 'GA Drawing', enquiryId: t.enquiry_id, version: t.version, status: t.status, date: isReviewerRole ? (t.admin_review_date || t.assigned_date) : t.assigned_date }))
    if (relevantModules.includes('Work Order')) myWo.forEach(t => rows.push({ module: 'Work Order', enquiryId: t.enquiry_id, version: t.version, status: t.status, date: isReviewerRole ? (t.admin_review_date || t.assigned_date) : t.assigned_date }))
    return rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [myFc, myQt, myQr, myGa, myWo, relevantModules, isReviewerRole, qrVersionMap])

  const totalAssigned = moduleRows.reduce((s, m) => s + m.stats.total, 0)
  const totalApproved = moduleRows.reduce((s, m) => s + m.stats.approved, 0)
  const totalRejected = moduleRows.reduce((s, m) => s + m.stats.rejected, 0)
  const totalPending = moduleRows.reduce((s, m) => s + m.stats.pending, 0)

  const enquiryOptions = useMemo(() => {
    const ids = new Set([
      ...myBackendEnquiryIds,
      ...gaTasks.filter(t => t.assigned_to === selectedUser).map(t => t.enquiry_id),
      ...woTasks.filter(t => t.assigned_to === selectedUser).map(t => t.enquiry_id),
    ])
    return [...ids].map(id => ({ id, label: `${id} — ${enqMap[id]?.company_name || '—'}` })).sort((a, b) => a.id.localeCompare(b.id))
  }, [myBackendEnquiryIds, gaTasks, woTasks, selectedUser, enqMap])

  function moduleRowDate(moduleName, row) {
    if (moduleName === 'Flowchart') return row.assigned_date
    if (moduleName === 'Quotation') return row.shared_date
    if (moduleName === 'Questionnaire') return row.received_date || row.sent_date
    if (moduleName === 'GA Drawing') return isReviewerRole ? (row.admin_review_date || row.assigned_date) : row.assigned_date
    if (moduleName === 'Work Order') return isReviewerRole ? (row.admin_review_date || row.assigned_date) : row.assigned_date
    return row.assigned_date || row.created_at
  }

  // Har row ke liye TAT (start → end) aur On-Time/Late nikaalte hain — ye
  // wahi start/end logic use karta hai jo module-wise averages mein bhi use
  // hota hai, taaki number-pe-click-karke-dikhne-wala detail consistent rahe.
  function moduleRowTatInfo(moduleName, row) {
    let start = null, end = null, target = null

    if (moduleName === 'Flowchart') {
      start = getCascadingStart(row.enquiry_id)
      end = row.client_shared_date
      target = targets.flowchart
    } else if (moduleName === 'Quotation') {
      start = getCascadingStart(row.enquiry_id)
      end = row.shared_date
      target = targets.quotation
    } else if (moduleName === 'Questionnaire') {
      start = backendAssignedMap[row.enquiry_id]
      end = row.sent_date
      target = targets.questionnaire
    } else if (moduleName === 'GA Drawing') {
      if (isReviewerRole) {
        start = row.designer_submission_date
        end = row.admin_review_date
        target = targets.adminApproval
      } else {
        start = row.assigned_date
        end = row.client_approved_date
        target = targets.gaDrawing
      }
    } else if (moduleName === 'Work Order') {
      if (isReviewerRole) {
        start = row.designer_submission_date
        end = row.admin_review_date
        target = targets.adminApproval
      } else {
        start = row.assigned_date
        end = row.admin_review_date
        target = targets.workOrder
      }
    }

    if (!start || !end) return null
    const hrs = hrsDiff(start, end)
    if (hrs === null) return null
    return { hrs, target, isLate: hrs > target }
  }

  function openBucketDetail(moduleName, bucketLabel, rows) {
    if (!rows || rows.length === 0) return
    const formatted = [...rows]
      .map(r => ({
        enquiryId: r.enquiry_id,
        version: moduleName === 'Questionnaire' ? (qrVersionMap[r.id] || 'V1') : r.version,
        status: r.status,
        date: moduleRowDate(moduleName, r),
        tat: moduleRowTatInfo(moduleName, r),
      }))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    setActiveModal({ title: `${moduleName} — ${bucketLabel} (${formatted.length})`, rows: formatted })
  }

  function handleExportCSV() {
    const rejColLabel = currentRole === 'design' ? 'Revision' : 'Rejected'
    const headers = ['Module', assignedColLabel, 'Approved', rejColLabel, 'Pending', 'Approval %', 'Avg TAT', 'On-Time %']
    const rows = moduleRows.map(({ name, stats }) => [
      name,
      stats.total,
      stats.approved,
      currentRole === 'design' ? stats.revisions : stats.rejected,
      stats.pending,
      `${stats.pct}%`,
      stats.avgTat !== null && stats.avgTat !== undefined ? fmtHrs(stats.avgTat) : '—',
      stats.onTimePct !== null && stats.onTimePct !== undefined ? `${stats.onTimePct}%` : '—',
    ])
    const dateSuffix = new Date().toISOString().slice(0, 10)
    downloadCSV(`ReportCard_${selectedUser.replace(/\s+/g, '_')}_${dateSuffix}.csv`, headers, rows)
  }

  if (loading) {
    return <div className="rc-loading"><i className="fas fa-spinner fa-spin"></i> Loading report card…</div>
  }

  const assignedColLabel = isReviewerRole ? 'Came for Approval' : 'Assigned'
  // Designer ke liye "Rejected" ki jagah "Revision" — kyunki designer ke liye ye
  // ek cheez hi hai: jab bhi admin reject kare ya client changes maange, designer
  // usi task ko revise karke resubmit karta hai (naya task nahi banta).
  const rejectedColLabel = currentRole === 'design' ? 'Revision' : 'Rejected'

  return (
    <div className="rc-wrap">
      <p className="rc-subtitle">Complete per-person work breakdown across Flowchart, Quotation, GA Drawing &amp; Work Order</p>

      <div className="rc-filters-card">
        <div className="rc-filter-row">
          <div className="rc-filter-group">
            <label>User</label>
            <select
              value={selectedUser}
              onChange={e => { setSelectedUser(e.target.value); setSelectedEnquiry('') }}
              disabled={!isAdminViewer}
            >
              {users.map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}
            </select>
          </div>
          <div className="rc-filter-group">
            <label>Enquiry</label>
            <select value={selectedEnquiry} onChange={e => setSelectedEnquiry(e.target.value)}>
              <option value="">All Enquiries</option>
              {enquiryOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <button className="rc-export-btn" onClick={handleExportCSV} disabled={moduleRows.length === 0}>
            <i className="fas fa-file-csv"></i> Download CSV
          </button>
        </div>
        <DateFilterBar filter={filter} />
      </div>

      {currentUser && (
        <div className="rc-user-header">
          <div className="rc-user-avatar">{currentUser.name.charAt(0).toUpperCase()}</div>
          <div>
            <div className="rc-user-name">{currentUser.name}</div>
            <div className="rc-user-role">{currentUser.role} · {currentUser.email || 'no email on file'}</div>
          </div>
          {isReviewerRole && (
            <div className="rc-reviewer-tag">
              <i className="fas fa-user-shield"></i> Reviewer view — shows what they approved/rejected, not what's "assigned" to them
            </div>
          )}
        </div>
      )}

      {/* ── Overall totals ─────────────────────────────────── */}
      <div className="rc-totals-grid">
        {isFollowupRole ? (
          <>
            <div className="rc-total-card">
              <div className="rc-total-val" style={{ color: 'var(--slate-900)' }}>{followupStats.totalCalls}</div>
              <div className="rc-total-lbl">Total Calls Logged</div>
            </div>
            <div className="rc-total-card">
              <div className="rc-total-val" style={{ color: '#059669' }}>{followupStats.onTime}</div>
              <div className="rc-total-lbl">On Time</div>
            </div>
            <div className="rc-total-card">
              <div className="rc-total-val" style={{ color: 'var(--rose)' }}>{followupStats.late}</div>
              <div className="rc-total-lbl">Late</div>
            </div>
            <div className="rc-total-card">
              <div className="rc-total-val" style={{ color: 'var(--amber)' }}>{followupStats.onTimePct}%</div>
              <div className="rc-total-lbl">On-Time Rate</div>
            </div>
          </>
        ) : (
          <>
            <div className="rc-total-card">
              <div className="rc-total-val" style={{ color: 'var(--slate-900)' }}>{totalAssigned}</div>
              <div className="rc-total-lbl">Total {assignedColLabel}</div>
            </div>
            <div className="rc-total-card">
              <div className="rc-total-val" style={{ color: '#059669' }}>{totalApproved}</div>
              <div className="rc-total-lbl">Approved</div>
            </div>
            <div className="rc-total-card">
              <div className="rc-total-val" style={{ color: 'var(--rose)' }}>{totalRejected}</div>
              <div className="rc-total-lbl">Rejected / Revised</div>
            </div>
            <div className="rc-total-card">
              <div className="rc-total-val" style={{ color: 'var(--amber)' }}>{totalPending}</div>
              <div className="rc-total-lbl">Pending</div>
            </div>
          </>
        )}
      </div>

      {/* ── Follow-up Timeliness (followup role only) ───────── */}
      {isFollowupRole && (
        <div className="rc-card">
          <div className="rc-card-header">
            <div className="rc-card-title">🔔 Follow-up Timeliness</div>
            <span className="rc-count-sm">Currently {currentBacklog} enquiries overdue system-wide</span>
          </div>
          <div className="rc-followup-body">
            <div className="rc-followup-summary">
              <div className="rc-followup-bar-row">
                <div className="rc-followup-bar">
                  <div className="rc-followup-bar-fill" style={{ width: `${followupStats.onTimePct}%`, background: '#059669' }}></div>
                </div>
                <span className="rc-followup-pct">{followupStats.onTimePct}% on time</span>
              </div>
              <div className="rc-followup-sub">
                {followupStats.measurable} follow-ups measurable · {followupStats.onTime} on time · {followupStats.late} late
                {followupStats.avgDelayLate !== null && <> · avg delay when late: <strong>{fmtHrs(followupStats.avgDelayLate)}</strong></>}
              </div>
              <div className="rc-followup-note">
                <i className="fas fa-info-circle"></i> "On time" means the call was logged on or before the follow-up date scheduled during the previous call. The very first call on an enquiry has no prior due date, so it isn't counted here.
              </div>
            </div>

            <div className="rc-followup-recent-label">Recent Activity</div>
            <div className="rc-followup-recent-list">
              {myTaggedCalls.length === 0 ? (
                <div className="rc-empty">No measurable follow-up activity for the selected filters</div>
              ) : (
                [...myTaggedCalls].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8).map((c, i) => (
                  <div className="rc-followup-row" key={i} onClick={() => navigate(`/enquiries/${c.enquiry_id}`)}>
                    <span className="rc-followup-dot" style={{ background: c.isLate ? 'var(--rose)' : '#059669' }}></span>
                    <div className="rc-followup-info">
                      <div className="rc-followup-id">{c.enquiry_id} <span className="rc-followup-company">{enqMap[c.enquiry_id]?.company_name || ''}</span></div>
                      <div className="rc-followup-dates">
                        Due {formatDateDisplay(c.dueDate)} → Called {formatDateDisplay(c.date)}
                      </div>
                    </div>
                    <span className={`rc-followup-badge ${c.isLate ? 'rose' : 'green'}`}>
                      {c.isLate ? `✗ Late by ${fmtHrs(c.delayHrs)}` : '✓ On Time'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Module-wise breakdown table ────────────────────── */}
      {!isFollowupRole && (
      <div className="rc-card">
        <div className="rc-card-header">
          <div className="rc-card-title">📊 Module-wise Breakdown</div>
        </div>
        <div className="rc-table-wrap">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Module</th><th>{assignedColLabel}</th><th>Approved</th><th>{rejectedColLabel}</th><th>Pending</th>
                <th>Approval %</th><th>Avg TAT</th><th>On-Time %</th>
              </tr>
            </thead>
            <tbody>
              {moduleRows.length === 0 ? (
                <tr><td colSpan={8} className="rc-empty">No module-linked work applies to this role.</td></tr>
              ) : (
                moduleRows.map(({ name, stats }) => {
                  const info = MODULE_INFO[name]
                  return (
                    <tr key={name}>
                      <td>
                        <span className="rc-module-badge" style={{ background: `${info.color}18`, color: info.color }}>
                          {info.icon} {name}
                        </span>
                      </td>
                      <td className="rc-num rc-clickable" onClick={() => openBucketDetail(name, assignedColLabel, stats.rows.all)}>{stats.total}</td>
                      <td className="rc-num rc-green rc-clickable" onClick={() => openBucketDetail(name, 'Approved', stats.rows.approved)}>{stats.approved}</td>
                      <td className="rc-num rc-rose rc-clickable" onClick={() => currentRole === 'design'
                        ? openBucketDetail(name, 'Revision', stats.rows.revisions)
                        : openBucketDetail(name, 'Rejected', stats.rows.rejected)
                      }>{currentRole === 'design' ? stats.revisions : stats.rejected}</td>
                      <td className="rc-num rc-amber rc-clickable" onClick={() => openBucketDetail(name, 'Pending', stats.rows.pending)}>{stats.pending}</td>
                      <td style={{ minWidth: 110 }}>
                        <div className="rc-progress-row">
                          <div className="rc-progress-bar"><div className="rc-progress-fill" style={{ width: `${stats.pct}%`, background: info.color }}></div></div>
                          <span style={{ color: info.color, fontWeight: 800, fontSize: 12 }}>{stats.pct}%</span>
                        </div>
                      </td>
                      <td className="qp-mono">{stats.avgTat !== null && stats.avgTat !== undefined ? fmtHrs(stats.avgTat) : '—'}</td>
                      <td>
                        {stats.onTimePct !== null && stats.onTimePct !== undefined ? (
                          <div className="rc-progress-row">
                            <div className="rc-progress-bar"><div className="rc-progress-fill" style={{ width: `${stats.onTimePct}%`, background: '#0369a1' }}></div></div>
                            <span style={{ color: '#0369a1', fontWeight: 800, fontSize: 12 }}>{stats.onTimePct}%</span>
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ── Detailed activity table (skipped for followup — Recent Activity above covers it) ── */}
      {!isFollowupRole && (
      <div className="rc-card">
        <div className="rc-card-header">
          <div className="rc-card-title">📋 Detailed Activity <span className="rc-count-sm">({activityRows.length} records)</span></div>
        </div>
        <div className="rc-table-wrap">
          <table className="rc-table">
            <thead>
              <tr>
                <th>Module</th><th>Enquiry ID</th><th>Company</th><th>Version</th><th>Status</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {activityRows.length === 0 ? (
                <tr><td colSpan={6} className="rc-empty">No activity found for the selected filters</td></tr>
              ) : (
                activityRows.map((r, i) => {
                  const info = MODULE_INFO[r.module]
                  return (
                    <tr key={i} onClick={() => navigate(`/enquiries/${r.enquiryId}`)}>
                      <td>
                        <span className="rc-module-badge" style={{ background: `${info.color}18`, color: info.color }}>
                          {info.icon} {r.module}
                        </span>
                      </td>
                      <td><span className="qp-id">{r.enquiryId}</span></td>
                      <td>{enqMap[r.enquiryId]?.company_name || '—'}</td>
                      <td className="qp-mono">{r.version || '—'}</td>
                      <td><span className="rc-status-badge">{r.status}</span></td>
                      <td className="qp-mono">{formatDateDisplay(r.date)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {activeModal && (
        <div className="rc-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="rc-modal" onClick={e => e.stopPropagation()}>
            <div className="rc-modal-header">
              <span>{activeModal.title}</span>
              <button onClick={() => setActiveModal(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="rc-modal-body">
              <table className="rc-table">
                <thead>
                  <tr><th>Enquiry ID</th><th>Company</th><th>Version</th><th>Status</th><th>Date</th><th>TAT</th></tr>
                </thead>
                <tbody>
                  {activeModal.rows.map((r, i) => (
                    <tr key={i} onClick={() => { setActiveModal(null); navigate(`/enquiries/${r.enquiryId}`) }}>
                      <td><span className="qp-id">{r.enquiryId}</span></td>
                      <td>{enqMap[r.enquiryId]?.company_name || '—'}</td>
                      <td className="qp-mono">{r.version || '—'}</td>
                      <td><span className="rc-status-badge">{r.status}</span></td>
                      <td className="qp-mono">{formatDateDisplay(r.date)}</td>
                      <td>
                        {r.tat ? (
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: r.tat.isLate ? 'var(--rose)' : '#059669', whiteSpace: 'nowrap' }}>
                            {r.tat.isLate ? '✗ Late' : '✓ On Time'} · {fmtHrs(r.tat.hrs)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}