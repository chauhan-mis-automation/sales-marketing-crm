// Shared helpers for the Work Queue pages (Follow-ups, Flowcharts, Quotations,
// GA Drawings, PO Approvals, Work Orders)

// Given rows from a tracking table (flowchart_tasks, quotation_versions,
// ga_drawing_tasks, purchase_orders, work_orders) — all of which have an
// `enquiry_id` and an auto-increment `id` — keep only the latest row per
// enquiry (highest id = most recently inserted = latest version).
export function latestPerEnquiry(rows) {
  const map = {}
  ;(rows || []).forEach(r => {
    if (!map[r.enquiry_id] || r.id > map[r.enquiry_id].id) {
      map[r.enquiry_id] = r
    }
  })
  return Object.values(map)
}

export function queueStatusBadgeClass(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('reject')) return 'qb-rose'
  if (s.includes('approved')) return 'qb-green'
  if (s.includes('submitted for review')) return 'qb-amber'
  if (s.includes('shared') || s.includes('uploaded')) return 'qb-sky'
  if (s.includes('revision')) return 'qb-amber'
  if (s === 'requested') return 'qb-gray'
  if (s === 'sent') return 'qb-sky'
  return 'qb-gray'
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
