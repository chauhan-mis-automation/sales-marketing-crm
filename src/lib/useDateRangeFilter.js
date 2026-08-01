import { useState } from 'react'

export const QUICK_RANGES = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '3m', label: 'Last 3 Months' },
  { key: '6m', label: 'Last 6 Months' },
  { key: 'thisM', label: 'This Month' },
  { key: 'thisY', label: 'This Year' },
]

function toISO(d) { return d.toISOString().slice(0, 10) }

function computeRange(key) {
  const today = new Date()
  const end = toISO(today)
  if (key === 'all') return { from: '', to: '' }
  if (key === 'today') return { from: end, to: end }
  if (key === '7d') { const d = new Date(today); d.setDate(d.getDate() - 6); return { from: toISO(d), to: end } }
  if (key === '30d') { const d = new Date(today); d.setDate(d.getDate() - 29); return { from: toISO(d), to: end } }
  if (key === '3m') { const d = new Date(today); d.setMonth(d.getMonth() - 3); return { from: toISO(d), to: end } }
  if (key === '6m') { const d = new Date(today); d.setMonth(d.getMonth() - 6); return { from: toISO(d), to: end } }
  if (key === 'thisM') return { from: toISO(new Date(today.getFullYear(), today.getMonth(), 1)), to: end }
  if (key === 'thisY') return { from: `${today.getFullYear()}-01-01`, to: end }
  return { from: '', to: '' }
}

export function useDateRangeFilter() {
  const [activePreset, setActivePreset] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  function applyPreset(key) {
    setActivePreset(key)
    const { from, to } = computeRange(key)
    setFromDate(from)
    setToDate(to)
  }

  function applyManualDates() {
    if (fromDate && toDate && toDate < fromDate) {
      alert('"To" date cannot be before "From" date')
      return
    }
    setActivePreset('')
  }

  function updateFrom(v) { setFromDate(v); setActivePreset('') }
  function updateTo(v) { setToDate(v); setActivePreset('') }

  function filterByDateField(rows, field) {
    if (!fromDate && !toDate) return rows
    return rows.filter(r => {
      const d = r[field] || ''
      if (fromDate && d < fromDate) return false
      if (toDate && d > toDate) return false
      return true
    })
  }

  return { activePreset, fromDate, toDate, applyPreset, applyManualDates, updateFrom, updateTo, filterByDateField }
}
