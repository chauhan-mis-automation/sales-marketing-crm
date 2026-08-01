import { supabase } from './supabaseClient'

function inMonth(dateStr, month, year) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  return d.getMonth() === month && d.getFullYear() === year
}

const CONSULTANT_CATS = ['consultant', 'consultants', 'architects', 'architect']
const END_CLIENT_CATS = ['end client', 'end clients', 'end-client', 'end-clients']
const CONTRACTOR_CATS = ['contractor', 'contractors', 'pmcs', 'pmc']

/**
 * Ported from the Apps Script getMarketingKPIData(userInfo, month, year).
 * userInfo: { userID, name, role }. userID === 'ALL' => team-wide (sum across all Marketing users).
 */
export async function getMarketingKPIData(userInfo, month, year) {
  const kpi = {
    visitsConsultants: 0, visitsEndClients: 0, visitsContractors: 0,
    dhuProjects: 0, otherProjects: 0,
    dhuEnquiryConsultant: 0, otherEnquiryConsultant: 0,
    dhuEnquiryContractor: 0, otherEnquiryContractor: 0,
    casilicaApproved: 0, conversionPct: 0, dailyReporting: 0,
    overheadCost: 0, newConsultants: 0, newEndClients: 0,
  }

  const isAll = userInfo.userID === 'ALL'
  const nameLower = (userInfo.name || '').toLowerCase().trim()

  // ── STEP 1: Contacts (sm_leads) added by this user this month — classify by Category ──
  let leadsQuery = supabase.from('sm_leads').select('category, created_by_id, created_date')
  if (!isAll) leadsQuery = leadsQuery.eq('created_by_id', userInfo.userID)
  const { data: leads } = await leadsQuery

  ;(leads || []).forEach(l => {
    if (!inMonth(l.created_date, month, year)) return
    const cat = (l.category || '').toLowerCase().trim()
    if (CONSULTANT_CATS.includes(cat)) {
      kpi.visitsConsultants++
      kpi.newConsultants++
    } else if (END_CLIENT_CATS.includes(cat)) {
      kpi.visitsEndClients++
      kpi.newEndClients++
    } else if (CONTRACTOR_CATS.includes(cat)) {
      kpi.visitsContractors++
    }
  })

  // ── STEP 2: Projects (sm_projects) added by this user this month ──
  const { data: allProjects } = await supabase.from('sm_projects').select('*')
  let totalProjects = 0
  let wonProjects = 0

  ;(allProjects || []).forEach(p => {
    if (!isAll && (p.created_by || '').toLowerCase().trim() !== nameLower) return
    if (!inMonth(p.created_date, month, year)) return

    const product = (p.required_product || '').toLowerCase().trim()
    const stage = (p.project_stage || '').toLowerCase().trim()
    const casilica = (p.casilica_approved || '').toLowerCase().trim()
    const enqConsultant = (p.enquiry_from_consultant || '').toLowerCase().trim()
    const enqContractor = (p.enquiry_from_contractor || '').toLowerCase().trim()

    const isDHU = product === 'dehumidifier'
    const isOthers = product === 'others'

    totalProjects++

    if (isDHU) kpi.dhuProjects++
    if (isOthers) kpi.otherProjects++

    if (isDHU && stage === 'won by consultant' && enqConsultant === 'yes') kpi.dhuEnquiryConsultant++
    if (isOthers && stage === 'won by consultant' && enqConsultant === 'yes') kpi.otherEnquiryConsultant++

    if (isDHU && stage === 'won by contractor' && enqContractor === 'yes') kpi.dhuEnquiryContractor++
    if (isOthers && stage === 'won by contractor' && enqContractor === 'yes') kpi.otherEnquiryContractor++

    if (stage === 'tender stage' && casilica === 'yes') kpi.casilicaApproved++

    if (stage === 'won by us') wonProjects++

    // "Daily Reporting" — project logged before 10 PM
    const pDate = new Date(p.created_date)
    if (!isNaN(pDate.getTime()) && pDate.getHours() < 22) kpi.dailyReporting++
  })

  kpi.conversionPct = totalProjects > 0 ? Math.round((wonProjects / totalProjects) * 100) : 0
  kpi.overheadCost = 0 // manual entry, always 0 from system (same as Apps Script)

  return kpi
}

// ── The 15 KRAs, in the exact order/labels used by the Apps Script scorecard ──
export const MARKETING_KRAS = [
  { key: 'visitsConsultants', targetKey: 'visits_consultants', weightKey: 'w_visits_consultants', label: 'Visits to Consultants/Architects', icon: 'fa-landmark', timeline: 'Monthly', defaultTarget: 20, defaultWeight: 12 },
  { key: 'visitsEndClients', targetKey: 'visits_end_clients', weightKey: 'w_visits_end_clients', label: 'Visits to End Clients', icon: 'fa-building', timeline: 'Monthly', defaultTarget: 10, defaultWeight: 12 },
  { key: 'visitsContractors', targetKey: 'visits_contractors', weightKey: 'w_visits_contractors', label: 'Visits to Contractors/PMCs', icon: 'fa-hard-hat', timeline: 'Monthly', defaultTarget: 5, defaultWeight: 3 },
  { key: 'dhuProjects', targetKey: 'dhu_projects', weightKey: 'w_dhu_projects', label: 'DHU Projects Identified', icon: 'fa-tint', timeline: 'Quarterly', defaultTarget: 25, defaultWeight: 9 },
  { key: 'otherProjects', targetKey: 'other_projects', weightKey: 'w_other_projects', label: 'Other Projects Identified', icon: 'fa-folder', timeline: 'Quarterly', defaultTarget: 50, defaultWeight: 5 },
  { key: 'dhuEnquiryConsultant', targetKey: 'dhu_enq_consultant', weightKey: 'w_dhu_enq_consultant', label: 'DHU Enquiry – Consultants/End Clients', icon: 'fa-inbox', timeline: 'Quarterly', defaultTarget: 15, defaultWeight: 14 },
  { key: 'otherEnquiryConsultant', targetKey: 'other_enq_consultant', weightKey: 'w_other_enq_consultant', label: 'Other Enquiry – Consultants/End Clients', icon: 'fa-envelope-open-text', timeline: 'Quarterly', defaultTarget: 30, defaultWeight: 3 },
  { key: 'dhuEnquiryContractor', targetKey: 'dhu_enq_contractor', weightKey: 'w_dhu_enq_contractor', label: 'DHU Enquiry – Contractors/PMCs', icon: 'fa-clipboard-list', timeline: 'Quarterly', defaultTarget: 30, defaultWeight: 4 },
  { key: 'otherEnquiryContractor', targetKey: 'other_enq_contractor', weightKey: 'w_other_enq_contractor', label: 'Other Enquiry – Contractors/PMCs', icon: 'fa-file-alt', timeline: 'Quarterly', defaultTarget: 50, defaultWeight: 3 },
  { key: 'casilicaApproved', targetKey: 'casilica_approved', weightKey: 'w_casilica_approved', label: 'Casilica Projects Approved', icon: 'fa-check-circle', timeline: 'Quarterly', defaultTarget: 45, defaultWeight: 12 },
  { key: 'conversionPct', targetKey: 'conversion_pct', weightKey: 'w_conversion_pct', label: '% Conversion to Orders', icon: 'fa-chart-line', timeline: 'Quarterly', defaultTarget: 125, defaultWeight: 8, unit: 'pct' },
  { key: 'dailyReporting', targetKey: 'daily_reporting', weightKey: 'w_daily_reporting', label: 'Daily Reporting (by 10 PM)', icon: 'fa-clipboard-check', timeline: 'Daily', defaultTarget: 25, defaultWeight: 6 },
  { key: 'overheadCost', targetKey: 'overhead_cost', weightKey: 'w_overhead_cost', label: 'Overhead Cost', icon: 'fa-coins', timeline: 'Monthly', defaultTarget: 3, defaultWeight: 3, unit: 'pct' },
  { key: 'newConsultants', targetKey: 'new_consultants', weightKey: 'w_new_consultants', label: 'New Consultants Added', icon: 'fa-user-plus', timeline: 'Monthly', defaultTarget: 5, defaultWeight: 3 },
  { key: 'newEndClients', targetKey: 'new_end_clients', weightKey: 'w_new_end_clients', label: 'New End Clients Added', icon: 'fa-user-friends', timeline: 'Monthly', defaultTarget: 5, defaultWeight: 3 },
]

// Returns the effective {target, weight} for a KRA — falls back to defaults
// when no custom target row exists yet (mirrors getDefaultMarketingTargets()).
export function effectiveTargetWeight(targets, kra) {
  const hasCustom = targets && Object.keys(targets).length > 0
  const target = hasCustom ? (parseFloat(targets[kra.targetKey]) || 0) : kra.defaultTarget
  const weight = hasCustom ? (targets[kra.weightKey] ?? kra.defaultWeight) : kra.defaultWeight
  return { target: parseFloat(target) || 0, weight: parseFloat(weight) || 0 }
}

export function calcMetricPct(achieved, target) {
  const t = parseFloat(target) || 0
  const a = parseFloat(achieved) || 0
  return t > 0 ? Math.min(100, Math.round((a / t) * 100)) : 0
}

// Weighted score across all 15 KRAs — score per KRA = min(weight, (achieved/target)*weight),
// summed (weights sum to 100, so total is already "out of 100").
export function calcMarketingFinalScore(kpi, targets) {
  let total = 0
  MARKETING_KRAS.forEach(kra => {
    const { target, weight } = effectiveTargetWeight(targets, kra)
    const achieved = parseFloat(kpi[kra.key]) || 0
    const score = target > 0 ? Math.min(weight, parseFloat(((achieved / target) * weight).toFixed(1))) : 0
    total += score
  })
  return Math.round(total * 10) / 10
}
