import { supabase } from './supabaseClient'

const DHU_KEYWORDS = ['dessicant dehumidifier', 'desiccant dehumidifier', 'refrigerant type dehumidifier', 'refrigerant dehumidifier']
const AHU_KEYWORDS = ['air handling unit', 'fan coil unit', 'heat recovery ventilator']

function isDHU(products) {
  const p = (products || '').toLowerCase()
  return DHU_KEYWORDS.some(k => p.includes(k))
}
function isAHU(products) {
  const p = (products || '').toLowerCase()
  return AHU_KEYWORDS.some(k => p.includes(k))
}

function inMonth(dateStr, month, year) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  return d.getMonth() === month && d.getFullYear() === year
}

// userInfo: { userID, name, role }. userID === 'ALL' => team-wide (Admin "All Sales Persons" view)
export async function getKPIData(userInfo, month, year) {
  const kpi = {
    salesDHU: 0, salesAHU: 0, yoyGrowth: 0, teamSales: 0, newCustSalesPct: 0,
    overheadPct: 0, enquiryDHU: 0, enquiryAHU: 0, enquiryNewIndustry: 0,
    followUpPhysical: 0, followUpTelephonic: 0, firstTimePhysical: 0, firstTimeTelephonic: 0,
    reporting: 0,
  }

  const nameLower = (userInfo.name || '').toLowerCase().trim()
  const isAll = userInfo.userID === 'ALL'

  function nameMatch(enq) {
    if (isAll) return true
    const fn = (enq.assign_to_frontend || '').toLowerCase().trim()
    const bn = (enq.assign_to_backend || '').toLowerCase().trim()
    return fn === nameLower || bn === nameLower
  }

  // ── Enquiries (Sales DHU/AHU, enquiry counts, new industry/geo) ──
  const { data: enquiries } = await supabase.from('enquiries').select('*')
  const seenGeo = new Set()
  let lastYearTotal = 0

  ;(enquiries || []).forEach(e => {
    const dateMatch = inMonth(e.date, month, year)
    const lastYearMatch = inMonth(e.date, month, year - 1)
    if ((dateMatch || lastYearMatch) && nameMatch(e)) {
      const fov = parseFloat(e.final_order_value) || 0
      if (dateMatch) {
        if (fov > 0) {
          if (isDHU(e.products)) { kpi.salesDHU += fov; kpi.teamSales += fov }
          if (isAHU(e.products)) { kpi.salesAHU += fov; kpi.teamSales += fov }
        }
        if (isDHU(e.products)) kpi.enquiryDHU++
        if (isAHU(e.products)) kpi.enquiryAHU++
        const geoKey = `${e.source || ''}|${e.city || ''}`
        if (geoKey !== '|' && !seenGeo.has(geoKey)) { seenGeo.add(geoKey); kpi.enquiryNewIndustry++ }
      }
      if (lastYearMatch && fov > 0 && (isDHU(e.products) || isAHU(e.products))) {
        lastYearTotal += fov
      }
    }
  })

  kpi.yoyGrowth = lastYearTotal > 0 ? Math.round(((kpi.teamSales - lastYearTotal) / lastYearTotal) * 100) : 0

  // ── Follow-ups (physical/telephonic, first-time) ──
  let fupQuery = supabase.from('sm_followups').select('*').eq('status', 'Done')
  if (!isAll) fupQuery = fupQuery.eq('sales_person_id', userInfo.userID)
  const { data: followUps } = await fupQuery

  const seenTeleLead = new Set()
  ;(followUps || []).forEach(f => {
    if (!inMonth(f.follow_up_date, month, year)) return
    if (f.type === 'Visit') {
      kpi.followUpPhysical++
      if ((f.visit_number || '').includes('1st')) kpi.firstTimePhysical++
    } else {
      kpi.followUpTelephonic++
      if (!seenTeleLead.has(f.lead_id)) { seenTeleLead.add(f.lead_id); kpi.firstTimeTelephonic++ }
    }
  })

  // ── Reporting (interactions logged this month = activity proxy) ──
  let intQuery = supabase.from('sm_interactions').select('*')
  if (!isAll) intQuery = intQuery.eq('sales_person_id', userInfo.userID)
  const { data: interactions } = await intQuery
  kpi.reporting = (interactions || []).filter(i => inMonth(i.created_date, month, year)).length

  return kpi
}

export const KPI_METRICS = [
  { key: 'salesDHU', targetKey: 'sales_dhu', label: 'Sales – Dehumidifier', unit: 'currency' },
  { key: 'salesAHU', targetKey: 'sales_ahu', label: 'Sales – AHU', unit: 'currency' },
  { key: 'yoyGrowth', targetKey: 'yoy_growth', label: 'YoY Sales Growth', unit: 'pct' },
  { key: 'teamSales', targetKey: 'team_sales', label: "Team's Sales", unit: 'currency' },
  { key: 'newCustSalesPct', targetKey: 'new_cust_sales_pct', label: '% Sales New Customers', unit: 'pct' },
  { key: 'overheadPct', targetKey: 'overhead_pct', label: 'Sales Overhead %age', unit: 'pct' },
  { key: 'enquiryNewIndustry', targetKey: 'enq_new_ind', label: 'Enquiry: New Industry/Geo', unit: 'count' },
  { key: 'enquiryDHU', targetKey: 'enq_dhu', label: 'No. of Enquiry DHU', unit: 'count' },
  { key: 'enquiryAHU', targetKey: 'enq_ahu', label: 'No. of Enquiry AHU', unit: 'count' },
  { key: 'followUpPhysical', targetKey: 'fup_phys', label: 'Follow Up Physical', unit: 'count' },
  { key: 'followUpTelephonic', targetKey: 'fup_tele', label: 'Follow Up Telephonic', unit: 'count' },
  { key: 'firstTimePhysical', targetKey: 'first_phys', label: 'First Time Physical', unit: 'count' },
  { key: 'firstTimeTelephonic', targetKey: 'first_tele', label: 'First Time Telephonic', unit: 'count' },
  { key: 'reporting', targetKey: 'reporting', label: 'Reporting', unit: 'count' },
]

export function formatKPIValue(value, unit) {
  if (unit === 'currency') {
    if (value >= 10000000) return `Rs ${(value / 10000000).toFixed(1)}Cr`
    if (value >= 100000) return `Rs ${(value / 100000).toFixed(1)}L`
    if (value >= 1000) return `Rs ${(value / 1000).toFixed(1)}K`
    return `Rs ${Math.round(value)}`
  }
  if (unit === 'pct') return `${value}%`
  return `${value}`
}

export function calcFinalScore(kpi, targets) {
  let totalPct = 0
  KPI_METRICS.forEach(m => {
    const target = parseFloat(targets?.[m.targetKey]) || 0
    const achieved = parseFloat(kpi[m.key]) || 0
    const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0
    totalPct += pct
  })
  return Math.round(totalPct / KPI_METRICS.length)
}

export function calcMetricPct(achieved, target) {
  const t = parseFloat(target) || 0
  const a = parseFloat(achieved) || 0
  return t > 0 ? Math.min(100, Math.round((a / t) * 100)) : 0
}
