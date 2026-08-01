// ============================================================
// followupsApi.js
// Supabase data layer for the "Follow-ups / Visits" module.
// Mirrors the Apps Script functions: addFollowUp, getFollowUps,
// getCalendarData, completeFollowUp — now backed by sm_followups.
// ============================================================
import { supabase } from './supabaseClient'; // <-- adjust to your existing client path

function genFollowUpId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FUP-${ts}${rand}`;
}

/**
 * Create a new follow-up / visit.
 * data: { leadId, leadName, followUpDate, followUpTime, type, visitNumber, location, notes }
 * currentUser: { name, userID }
 */
export async function addFollowUp(data, currentUser) {
  const row = {
    followup_id: genFollowUpId(),
    lead_id: data.leadId,
    lead_name: data.leadName || '',
    sales_person: currentUser?.name || '',
    sales_person_id: currentUser?.userID || '',
    follow_up_date: data.followUpDate,          // 'YYYY-MM-DD'
    follow_up_time: data.followUpTime || null,   // 'HH:MM'
    type: data.type || 'Call',
    status: 'Pending',
    notes: data.notes || '',
    location: data.type === 'Visit' ? (data.location || '') : '',
    visit_number: data.type === 'Visit' ? (data.visitNumber || '') : '',
  };

  const { data: inserted, error } = await supabase
    .from('sm_followups')
    .insert(row)
    .select()
    .single();

  if (error) return { success: false, message: error.message };
  return { success: true, followUpID: inserted.followup_id, data: inserted };
}

/**
 * Fetch follow-ups. filter: { salesPersonId?, status? }
 * Sales role should pass their own salesPersonId; Admin passes nothing.
 */
export async function getFollowUps(filter = {}) {
  let query = supabase.from('sm_followups').select('*').order('follow_up_date', { ascending: true });

  if (filter.salesPersonId) query = query.eq('sales_person_id', filter.salesPersonId);
  if (filter.status) query = query.eq('status', filter.status);

  const { data, error } = await query;
  if (error) return { success: false, message: error.message };

  const leadIds = [...new Set((data || []).map((r) => r.lead_id).filter(Boolean))];
  let leadMap = {};
  if (leadIds.length > 0) {
    const { data: leads } = await supabase.from('sm_leads').select('lead_id, rating, business_volume, company').in('lead_id', leadIds);
    (leads || []).forEach((l) => { leadMap[l.lead_id] = l; });
  }

  return { success: true, data: (data || []).map((r) => mapRow(r, leadMap[r.lead_id])) };
}

/** Follow-ups for a given month, for the Calendar grid (Pending only, like the GAS version). */
export async function getCalendarData(salesPersonId, month, year) {
  let query = supabase
    .from('sm_followups')
    .select('*')
    .eq('status', 'Pending')
    .order('follow_up_date', { ascending: true });

  if (salesPersonId) query = query.eq('sales_person_id', salesPersonId);

  const { data, error } = await query;
  if (error) return { success: false, message: error.message };

  const filtered = (data || []).filter((r) => {
    const d = new Date(r.follow_up_date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  return { success: true, data: filtered.map(mapRow) };
}

/** Mark a follow-up Done (the "Close" quick action). */
export async function completeFollowUp(followUpId, notes = '') {
  const patch = { status: 'Done', completed_date: new Date().toISOString() };
  if (notes) patch.notes = notes;

  const { error } = await supabase
    .from('sm_followups')
    .update(patch)
    .eq('followup_id', followUpId);

  if (error) return { success: false, message: error.message };
  return { success: true };
}

/**
 * "Update Follow-up" — logs what happened + optionally schedules the next one,
 * mirroring updateFollowUpWithVisitData from the GAS backend (simplified).
 */
export async function updateFollowUpOutcome(followUpId, outcome, currentUser) {
  const { error: updErr } = await supabase
    .from('sm_followups')
    .update({
      status: 'Done',
      notes: `[${outcome.clientResponse || 'Updated'}] ${outcome.notes || ''}`,
      completed_date: new Date().toISOString(),
    })
    .eq('followup_id', followUpId);

  if (updErr) return { success: false, message: updErr.message };

  if (outcome.nextFollowUpDate) {
    await addFollowUp(
      {
        leadId: outcome.leadId,
        leadName: outcome.leadName,
        followUpDate: outcome.nextFollowUpDate,
        followUpTime: outcome.nextFollowUpTime,
        type: outcome.nextFollowUpType || 'Call',
        notes: `Follow-up from previous visit: ${outcome.notes || ''}`,
      },
      currentUser
    );
  }
  return { success: true };
}

/** Searchable contact list for the "Contact" field in the Schedule modal. */
export async function searchLeads(query = '') {
  let q = supabase.from('sm_leads').select('lead_id, name, phone, company').limit(30);
  if (query) q = q.ilike('name', `%${query}%`);
  const { data, error } = await q;
  if (error) return { success: false, message: error.message };
  return { success: true, data: data || [] };
}

function mapRow(r, lead) {
  return {
    followUpID: r.followup_id,
    leadID: r.lead_id,
    leadName: r.lead_name,
    company: lead?.company || '',
    rating: lead?.rating || '',
    businessVolume: lead?.business_volume || '',
    salesPerson: r.sales_person,
    salesPersonID: r.sales_person_id,
    followUpDate: r.follow_up_date,
    followUpTime: r.follow_up_time,
    type: r.type,
    status: r.status,
    notes: r.notes,
    location: r.location,
    visitNumber: r.visit_number,
    createdDate: r.created_date,
    completedDate: r.completed_date,
  };
}