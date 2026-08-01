import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDropdownData } from '../lib/useDropdownData'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

export default function PurchaseOrderReviewModal({ enquiry, latestPO, isAuthorizedReview, onClose, onSaved, onApprove }) {
  const { user } = useAuth()
  const { authorizedPerson } = useDropdownData()

  const [remarks, setRemarks] = useState('')
  const [reassignTo, setReassignTo] = useState('')
  const [action, setAction] = useState('')
  const [saving, setSaving] = useState(false)

  const fileUrls = (latestPO.file_url || '').split(',').map(u => u.trim()).filter(Boolean)

  async function handleSubmit() {
    if (!action) {
      alert('Please choose an action')
      return
    }

    // Approve hone par ye modal band karke seedha "Assign Work Order" wala modal khulta hai
    if (action === 'approve') {
      onClose()
      onApprove()
      return
    }

    if (action === 'reassign' && !reassignTo) {
      alert('Please select an authorized person to reassign to')
      return
    }

    setSaving(true)
    try {
      if (action === 'reject') {
        if (!remarks.trim()) {
          alert('Please add a rejection reason')
          setSaving(false)
          return
        }

        const { error: rejectError } = await supabase
          .from('purchase_orders')
          .update({
            status: 'Rejected',
            admin_review_notes: remarks.trim(),
            reviewed_by: user?.name || '',
            reviewed_date: new Date().toISOString()
          })
          .eq('id', latestPO.id)

        if (rejectError) throw rejectError

        await supabase.from('stage_logs').insert({
          log_id: `LOG-${Date.now()}`,
          enquiry_id: enquiry.enquiry_id,
          stage_name: 'PO Rejected',
          remarks: remarks.trim(),
          logged_by: user?.name || ''
        })

        if (latestPO.submitted_by) {
          await supabase.from('notifications').insert({
            recipient_name: latestPO.submitted_by,
            enquiry_id: enquiry.enquiry_id,
            title: '❌ PO Rejected — Please Resubmit',
            message: `PO ${latestPO.version} for enquiry ${enquiry.enquiry_id} (${enquiry.company_name}) was rejected by ${user?.name}. Reason: ${remarks.trim()}. Please fill and resubmit the Purchase Order.`,
            type: 'po_rejected'
          })
        }
      } else if (action === 'reassign') {
        const { error: reassignError } = await supabase
          .from('purchase_orders')
          .update({
            reassigned_to: reassignTo,
            admin_review_notes: remarks.trim(),
            reviewed_by: user?.name || '',
            reviewed_date: new Date().toISOString()
          })
          .eq('id', latestPO.id)

        if (reassignError) throw reassignError

        await supabase.from('stage_logs').insert({
          log_id: `LOG-${Date.now()}`,
          enquiry_id: enquiry.enquiry_id,
          stage_name: 'PO Reassigned',
          remarks: `PO ${latestPO.version} reassigned to ${reassignTo}${remarks.trim() ? ' | ' + remarks.trim() : ''}`,
          logged_by: user?.name || ''
        })

        await supabase.from('notifications').insert({
          recipient_name: reassignTo,
          enquiry_id: enquiry.enquiry_id,
          title: '📄 PO Reassigned to You — Review Required',
          message: `PO ${latestPO.version} for enquiry ${enquiry.enquiry_id} (${enquiry.company_name}) has been reassigned to you by ${user?.name} for approval. Please review.`,
          type: 'po_reassigned'
        })
      }

      onSaved()
      onClose()
    } catch (err) {
      alert('Error submitting review: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="📄 Purchase Order"
      onClose={onClose}
      width="600px"
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Close</button>
          <button className="btn-modal-primary" onClick={handleSubmit} disabled={saving}>
            <i className="fas fa-paper-plane"></i> {saving ? 'Submitting…' : 'Submit'}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>PO File(s) — {latestPO.version}</label>
        {fileUrls.length > 0 ? (
          fileUrls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer" className="modal-view-file-btn" style={{ marginBottom: i < fileUrls.length - 1 ? 8 : 16 }}>
              <i className="fas fa-file"></i> View File {fileUrls.length > 1 ? i + 1 : ''}
            </a>
          ))
        ) : (
          <div className="modal-helper" style={{ marginTop: 0 }}>No file uploaded.</div>
        )}
      </div>

      <div className="modal-helper" style={{ marginTop: -8, marginBottom: 16, fontWeight: 600, color: 'var(--slate-700)' }}>
        Payment: {latestPO.payment_terms || '—'} &nbsp;|&nbsp; Delivery: {latestPO.delivery_period || '—'} &nbsp;|&nbsp; Warranty: {latestPO.warranty_period || '—'}
      </div>

      {isAuthorizedReview && (
        <div className="modal-info-banner">
          <i className="fas fa-info-circle"></i>
          <span>You have been designated to approve this Purchase Order.</span>
        </div>
      )}

      <div className="modal-form-group">
        <label>{isAuthorizedReview ? 'Your Remarks' : 'Admin Remarks (optional)'}</label>
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Approval / rejection remarks…"
        />
      </div>

      {!isAuthorizedReview && (
        <div className="modal-form-group">
          <label>Reassign to Authorized Person (optional)</label>
          <select value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
            <option value="">-- Select Person --</option>
            {authorizedPerson.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="modal-helper">If selected, that person will be notified to approve/reject the PO.</div>
        </div>
      )}

      <div className="modal-form-group">
        <label>Select Action *</label>
        <select value={action} onChange={e => setAction(e.target.value)}>
          <option value="">-- Choose Action --</option>
          <option value="approve">✅ Approve PO</option>
          {!isAuthorizedReview && (
            <option value="reassign">🔄 Reassign to Authorized Person</option>
          )}
          <option value="reject">❌ Reject PO</option>
        </select>
      </div>
    </Modal>
  )
}
