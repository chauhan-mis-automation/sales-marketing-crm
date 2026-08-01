import { supabase } from './supabaseClient'

function genActivityId() {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ACT-${ts}${rand}`
}

/**
 * Records one row in sm_activity_log. Mirrors the Apps Script logActivity()
 * helper — fire-and-forget, so a logging failure never blocks the action
 * the user actually cares about.
 */
export async function logActivity({
  userId, userName, role,
  leadId = '', leadName = '',
  action, module,
  details = '', location = '', latitude = null, longitude = null,
}) {
  try {
    await supabase.from('sm_activity_log').insert({
      activity_id: genActivityId(),
      user_id: userId || '',
      user_name: userName || '',
      role: role || '',
      lead_id: leadId,
      lead_name: leadName,
      action,
      module,
      details,
      location,
      latitude,
      longitude,
    })
  } catch (err) {
    // Never let a logging failure break the calling action.
    console.warn('logActivity failed:', err.message)
  }
}
