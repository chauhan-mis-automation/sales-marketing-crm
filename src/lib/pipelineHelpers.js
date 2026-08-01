// Shared logic for building "Pipeline Stages" kanban lanes from a list of
// enquiries + the dynamic stage list (dropdown_list.stages). Used by both
// the Admin dashboard (all enquiries) and the Frontend dashboard (scoped
// to just that salesperson's own enquiries).

export const STAGE_ACCENTS = ['#534AB7', '#0369a1', '#6d28d9', '#0d9488', '#b45309', '#be123c', '#059669', '#888780']

export function buildPipelineLanes(enquiries, stages, getDisplayAmount) {
  const stageList = stages && stages.length ? stages : []
  const lanes = {}
  stageList.forEach(s => { lanes[s] = [] })
  const unmatched = []

  ;(enquiries || []).forEach(e => {
    const stage = (e.current_stage || '').trim()
    const withAmount = { ...e, displayAmount: getDisplayAmount ? getDisplayAmount(e) : null }

    if (!stage) { unmatched.push(withAmount); return }
    if (lanes[stage]) { lanes[stage].push(withAmount); return }

    const stageLower = stage.toLowerCase()
    let match = stageList.find(s => s.toLowerCase() === stageLower)
    if (!match) {
      match = stageList.find(s => s.toLowerCase().includes(stageLower) || stageLower.includes(s.toLowerCase()))
    }
    if (match) lanes[match].push(withAmount)
    else unmatched.push(withAmount)
  })

  const buildLane = (name, color, items) => ({
    name,
    color,
    items,
    total: items.reduce((s, it) => s + (it.displayAmount || 0), 0),
  })

  const result = stageList.map((s, i) => buildLane(s, STAGE_ACCENTS[i % STAGE_ACCENTS.length], lanes[s] || []))

  if (unmatched.length > 0) {
    result.unshift(buildLane('Assigned / New', '#6a8c6f', unmatched))
  }

  return result
}
