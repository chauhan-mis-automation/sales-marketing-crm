import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { latestPerEnquiry, todayISO } from './queueHelpers'

// Computes the counts shown as red badges next to each Work Queue sidebar item.
// Quotations intentionally has no badge (no approve/reject concept for it).
export function useQueueBadges(user) {
  const [badges, setBadges] = useState({})
  const intervalRef = useRef(null)

  const loadBadges = useCallback(async () => {
    if (!user) return
    const role = user.role

    try {
      const next = {}

      // ── Follow-ups: overdue/due active enquiries ──────────
      if (['superadmin', 'admin', 'followup'].includes(role)) {
        const { data } = await supabase
          .from('enquiries')
          .select('id')
          .eq('status', 'Active')
          .not('next_followup_date', 'is', null)
          .lte('next_followup_date', todayISO())
        next.followups = data?.length || 0
      }

      // ── Flowcharts: latest task per enquiry not yet Client Approved ──
      if (['superadmin', 'admin', 'followup', 'backend'].includes(role)) {
        const { data: fcRows } = await supabase.from('flowchart_tasks').select('id, enquiry_id, status')
        let pending = latestPerEnquiry(fcRows).filter(t => t.status !== 'Client Approved')
        if (role === 'backend') {
          const { data: enqRows } = await supabase
            .from('enquiries')
            .select('enquiry_id')
            .eq('assign_to_backend', user.name)
          const mine = new Set((enqRows || []).map(e => e.enquiry_id))
          pending = pending.filter(t => mine.has(t.enquiry_id))
        }
        next.flowcharts = pending.length
      }

      // ── GA Drawings: latest task per enquiry not yet Client Approved ──
      if (['superadmin', 'admin', 'design'].includes(role)) {
        const { data: gaRows } = await supabase.from('ga_drawing_tasks').select('id, enquiry_id, status, assigned_to')
        let pending = latestPerEnquiry(gaRows).filter(t => t.status !== 'Client Approved')
        if (role === 'design') {
          pending = pending.filter(t => t.assigned_to === user.name)
        }
        next.drawings = pending.length
      }

      // ── PO Approvals: latest PO per enquiry still Uploaded ──
      if (['superadmin', 'admin'].includes(role)) {
        const { data: poRows } = await supabase.from('purchase_orders').select('id, enquiry_id, status')
        const pending = latestPerEnquiry(poRows).filter(t => t.status === 'Uploaded')
        next.poapprovals = pending.length
      }

      // ── Work Orders: latest WO per enquiry Submitted for Review ──
      if (['superadmin', 'admin'].includes(role)) {
        const { data: woRows } = await supabase.from('work_orders').select('id, enquiry_id, status')
        const pending = latestPerEnquiry(woRows).filter(t => t.status === 'Submitted for Review')
        next.workorders = pending.length
      }

      setBadges(next)
    } catch (err) {
      console.warn('Error loading queue badges:', err.message)
    }
  }, [user])

  useEffect(() => {
    loadBadges()
    intervalRef.current = setInterval(loadBadges, 30000)
    return () => clearInterval(intervalRef.current)
  }, [loadBadges])

  return { badges, refreshBadges: loadBadges }
}
