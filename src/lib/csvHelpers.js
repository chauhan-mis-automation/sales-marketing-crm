export function downloadCSV(filename, headers, rows) {
  const escape = (val) => {
    const s = val === null || val === undefined ? '' : String(val)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(','))
  ]

  const csvContent = lines.join('\r\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Parses raw CSV text into a 2D array of rows, handling quoted fields
 * (including embedded commas/newlines/escaped quotes).
 */
export function parseCSV(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"'
      i++
    } else if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some(c => c.trim() !== '')) rows.push(row)
      row = []
    } else {
      cell += ch
    }
  }
  if (cell || row.length) {
    row.push(cell)
    if (row.some(c => c.trim() !== '')) rows.push(row)
  }
  return rows
}
