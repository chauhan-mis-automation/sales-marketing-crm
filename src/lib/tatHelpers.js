// Shared TAT (Turnaround Time) calculation helpers for the TAT Report page.

export const DEFAULT_TAT_TARGETS = {
  flowchart: 5,       // hrs — Assigned → Client Decision
  quotation: 2,       // hrs — Flowchart Approved → Quotation Sent
  gaDrawing: 6,       // hrs — Assigned → Client Approved
  adminApproval: 2,   // hrs — Designer Submission → Admin Review
  purchaseOrder: 72,  // hrs — Upload → Admin Approved
  workOrder: 48,      // hrs — Assigned → Designer Submission
  questionnaire: 24,  // hrs — Sent → Received
}

// Hours between two timestamps. Returns null if either is missing/invalid,
// or if the result would be negative (bad data).
export function hrsDiff(start, end) {
  if (!start || !end) return null
  const a = new Date(start)
  const b = new Date(end)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null
  const diff = (b - a) / 3600000
  return diff >= 0 ? diff : null
}

export function fmtHrs(h) {
  if (h === null || h === undefined) return '—'
  if (h < 1) return Math.round(h * 60) + ' min'
  if (h < 24) return h.toFixed(1) + ' hrs'
  return (h / 24).toFixed(1) + ' days'
}

// dropdown_list stores TAT targets as text like "8 hrs" / "2" — extract the number.
export function parseHrs(val, fallback) {
  if (!val) return fallback
  const match = String(val).match(/[\d.]+/)
  const num = match ? parseFloat(match[0]) : NaN
  return !isNaN(num) && num > 0 ? num : fallback
}

// records: [{ person, hrs }]  hrs === null means still pending (not completed yet)
export function buildModuleStats(records, target) {
  const stats = { target, onTime: 0, late: 0, pending: 0, persons: {} }

  records.forEach(r => {
    const p = r.person && r.person.trim() ? r.person.trim() : 'Unassigned'
    if (!stats.persons[p]) {
      stats.persons[p] = { onTime: 0, late: 0, pending: 0, totalHrs: 0, completed: 0 }
    }

    if (r.hrs === null || r.hrs === undefined) {
      stats.pending++
      stats.persons[p].pending++
    } else {
      stats.persons[p].completed++
      stats.persons[p].totalHrs += r.hrs
      if (r.hrs <= target) {
        stats.onTime++
        stats.persons[p].onTime++
      } else {
        stats.late++
        stats.persons[p].late++
      }
    }
  })

  return stats
}

export function onTimePct(stats) {
  const total = stats.onTime + stats.late
  return total > 0 ? Math.round((stats.onTime / total) * 100) : 0
}

// Groups tracking-table rows (which may have multiple revision rows per
// enquiry) and builds ONE "submitter TAT" record per enquiry that spans
// from the FIRST version's start time to the version that finally reached
// a success status (e.g. 'Approved by Admin' / 'Client Approved').
// Rejections/revisions in between do NOT reset the clock — the submitter
// is still "on the hook" until it's actually approved.
export function buildEnquiryLevelRecords(rows, { startField, endField, successStatuses, personField }) {
  const groups = {}
  ;(rows || []).forEach(r => {
    const key = r.enquiry_id
    if (!key) return
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  })

  return Object.entries(groups).map(([enquiryId, group]) => {
    const starts = group.map(r => r[startField]).filter(Boolean).map(d => new Date(d).getTime())
    const start = starts.length ? new Date(Math.min(...starts)).toISOString() : null

    const successRow = group.find(r => successStatuses.includes(r.status) && r[endField])
    const latestRow = group.reduce((a, b) => (b.id > a.id ? b : a))

    return {
      enquiryId,
      person: latestRow[personField],
      version: latestRow.version,
      start,
      end: successRow ? successRow[endField] : null,
      hrs: successRow ? hrsDiff(start, successRow[endField]) : null,
      status: successRow ? successRow.status : latestRow.status,
    }
  })
}
