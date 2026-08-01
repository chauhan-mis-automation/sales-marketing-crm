export function addBusinessDaysExcludingSunday(startDate, days) {
  const result = new Date(startDate)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    if (result.getDay() !== 0) {
      added++
    }
  }
  return result
}

export function formatDateISO(date) {
  return date.toISOString().slice(0, 10)
}

export function formatDateDisplay(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}