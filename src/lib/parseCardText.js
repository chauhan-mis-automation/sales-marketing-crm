// Business card OCR se aaye messy text ko parse karke fields nikalta hai.
// Yeh heuristic hai — 100% accurate nahi hoga, user manually correct kar sakta hai.

const DESIGNATION_KEYWORDS = [
  'manager', 'director', 'engineer', 'executive', 'head', 'officer', 'president',
  'ceo', 'cfo', 'coo', 'founder', 'co-founder', 'proprietor', 'owner', 'partner',
  'consultant', 'lead', 'supervisor', 'coordinator', 'analyst', 'specialist',
  'architect', 'sales', 'marketing', 'business development', 'representative',
  'associate', 'assistant', 'vp', 'vice president', 'chairman', 'md', 'chief',
]

const COMPANY_KEYWORDS = [
  'pvt', 'ltd', 'llc', 'inc', 'corp', 'industries', 'enterprises', 'group',
  'company', 'co.', 'solutions', 'systems', 'technologies', 'international',
  'associates', 'services', 'traders', 'exports', 'imports',
]

function cleanLine(line) {
  return line.replace(/[|_~•●▪]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function parseCardText(rawText) {
  const lines = rawText
    .split('\n')
    .map(cleanLine)
    .filter(l => l.length > 1)

  const result = { name: '', phone: '', email: '', company: '', designation: '' }
  const usedLines = new Set()

  // ── Email ──
  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase()
    lines.forEach((l, i) => { if (l.includes(emailMatch[0])) usedLines.add(i) })
  }

  // ── Phone (10 digits, optionally prefixed with +91/0, allow spaces/dashes) ──
  const phoneMatches = [...rawText.matchAll(/(?:\+?91[-\s]?)?(\d{5}[-\s]?\d{5}|\d{10})/g)]
  if (phoneMatches.length > 0) {
    result.phone = phoneMatches[0][1].replace(/[-\s]/g, '')
    lines.forEach((l, i) => { if (/\d{4,}/.test(l)) usedLines.add(i) })
  }

  // ── Designation (line containing a known title keyword) ──
  let designationIdx = -1
  lines.forEach((l, i) => {
    if (usedLines.has(i) || designationIdx !== -1) return
    const lower = l.toLowerCase()
    if (DESIGNATION_KEYWORDS.some(k => lower.includes(k))) {
      result.designation = l
      designationIdx = i
      usedLines.add(i)
    }
  })

  // ── Company (line containing a company-type keyword) ──
  let companyIdx = -1
  lines.forEach((l, i) => {
    if (usedLines.has(i) || companyIdx !== -1) return
    const lower = l.toLowerCase()
    if (COMPANY_KEYWORDS.some(k => lower.includes(k))) {
      result.company = l
      companyIdx = i
      usedLines.add(i)
    }
  })

  // ── Name — first remaining short-ish line that looks like a person's name
  // (mostly letters/spaces, 2-4 words, not all-caps company-style single word) ──
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue
    const l = lines[i]
    const wordCount = l.split(' ').filter(Boolean).length
    const lettersOnly = /^[A-Za-z.\s]+$/.test(l)
    if (lettersOnly && wordCount >= 1 && wordCount <= 4 && l.length <= 40) {
      result.name = l
      usedLines.add(i)
      break
    }
  }

  // ── Whatever meaningful line is left over (not used) → treat as company if empty ──
  if (!result.company) {
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue
      result.company = lines[i]
      usedLines.add(i)
      break
    }
  }

  return result
}
