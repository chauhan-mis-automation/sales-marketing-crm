import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { sanitizeFileName } from '../lib/fileHelpers'
import Modal from './Modal'

export default function GADrawingAdminReviewModal({ enquiry, latestTask, onClose, onSaved }) {
  const { user } = useAuth()
  const [decision, setDecision] = useState('')
  const [remarks, setRemarks] = useState('')
  const [checkedSpec, setCheckedSpec] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)

  const designerFileUrls = (latestTask.designer_file_url || '').split(',').map(u => u.trim()).filter(Boolean)

  function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!decision) {
      alert('Please select a decision')
      return
    }
    if (!checkedSpec) {
      alert('Please answer: Have you checked the GA Drawing as per the specification required?')
      return
    }

    setSaving(true)
    try {
      if (decision === 'approve') {
        const notesWithConfirmation = `[Checked as per specification: ${checkedSpec}]${remarks.trim() ? ' ' + remarks.trim() : ''}`
        await supabase
          .from('ga_drawing_tasks')
          .update({
            status: 'Approved by Admin',
            admin_review_notes: notesWithConfirmation,
            admin_review_by: user?.name || '',
            admin_review_date: new Date().toISOString()
          })
          .eq('id', latestTask.id)

        await supabase.from('stage_logs').insert({
          log_id: `LOG-${Date.now()}`,
          enquiry_id: enquiry.enquiry_id,
          stage_name: 'GA Drawing Approved by Admin',
          remarks: remarks.trim() || 'Approved by admin',
          logged_by: user?.name || ''
        })

        const { data: followupUsers } = await supabase
          .from('users')
          .select('name')
          .eq('role', 'followup')
          .eq('active', true)

        const notifyRecipients = (followupUsers || []).map(u => u.name)
        if (enquiry.assign_to_backend && !notifyRecipients.includes(enquiry.assign_to_backend)) {
          notifyRecipients.push(enquiry.assign_to_backend)
        }

        if (notifyRecipients.length > 0) {
          await supabase.from('notifications').insert(
            notifyRecipients.map(name => ({
              recipient_name: name,
              enquiry_id: enquiry.enquiry_id,
              title: '📐 GA Drawing Approved — Share with Client Now!',
              message: `Admin (${user?.name}) approved the GA Drawing for enquiry ${enquiry.enquiry_id} (${enquiry.company_name}). Please open GA Drawing Action → select "Share Drawing with Client" and submit.`,
              type: 'ga_approved'
            }))
          )
        }
      } else {
        let fileUrls = []
        for (const file of files) {
          const filePath = `ga-drawing-admin-ref/${enquiry.enquiry_id}/${Date.now()}_${sanitizeFileName(file.name)}`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('enquiry-attachments')
            .upload(filePath, file)
          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage.from('enquiry-attachments').getPublicUrl(filePath)
            fileUrls.push(urlData.publicUrl)
          }
        }

        await supabase
          .from('ga_drawing_tasks')
          .update({
            status: 'Rejected by Admin',
            admin_review_notes: `[Checked as per specification: ${checkedSpec}]${remarks.trim() ? ' ' + remarks.trim() : ''}`,
            admin_review_by: user?.name || '',
            admin_review_date: new Date().toISOString(),
            admin_reference_file_url: fileUrls.join(', '),
            revision_count: (latestTask.revision_count || 0) + 1
          })
          .eq('id', latestTask.id)

        await supabase.from('stage_logs').insert({
          log_id: `LOG-${Date.now()}`,
          enquiry_id: enquiry.enquiry_id,
          stage_name: 'GA Drawing Rejected by Admin',
          remarks: remarks.trim() || 'Rejected by admin',
          logged_by: user?.name || ''
        })

        if (latestTask.assigned_to) {
          await supabase.from('notifications').insert({
            recipient_name: latestTask.assigned_to,
            enquiry_id: enquiry.enquiry_id,
            title: '❌ GA Drawing Rejected — Please Revise',
            message: `Admin (${user?.name}) rejected your GA Drawing for ${enquiry.enquiry_id}. Reason: ${remarks.trim() || '—'}${fileUrls.length ? ' 📎 Admin has provided reference file(s) — check your dashboard.' : ''} 👤 Client: ${enquiry.company_name}`,
            type: 'ga_rejected'
          })
        }
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
      title="📐 GA Drawing Action"
      onClose={onClose}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Close</button>
          <button className="btn-modal-primary" onClick={handleSubmit} disabled={saving}>
            <i className="fas fa-paper-plane"></i> {saving ? 'Submitting…' : 'Submit Review'}
          </button>
        </>
      }
    >
      {designerFileUrls.length > 0 && (
        <a href={designerFileUrls[0]} target="_blank" rel="noreferrer" className="modal-view-file-btn">
          <i className="fas fa-file"></i> View Drawing File
        </a>
      )}

      <div className="modal-form-group">
        <label>Have you checked the GA Drawing as per the specification required? *</label>
        <select value={checkedSpec} onChange={e => setCheckedSpec(e.target.value)}>
          <option value="">-- Select --</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>

      <div className="modal-form-group">
        <label>Review Remarks</label>
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Add approval/rejection remarks…"
        />
      </div>

      <div className="modal-form-group">
        <label>Decision *</label>
        <select value={decision} onChange={e => setDecision(e.target.value)}>
          <option value="">-- Select Decision --</option>
          <option value="approve">✅ Approve Drawing</option>
          <option value="reject">❌ Reject — Send Back to Designer</option>
        </select>
      </div>

      {decision === 'reject' && (
        <div className="modal-form-group">
          <label>Reference File for Designer (optional)</label>
          <div className="modal-helper" style={{ marginTop: 0, marginBottom: 10 }}>
            <i className="fas fa-info-circle"></i> Upload a reference/markup file for the designer to understand changes needed.
          </div>
          <label className="modal-file-btn modal-file-btn-block">
            <i className="fas fa-paperclip"></i> Add Reference File(s)
            <input type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
          </label>
          {files.length > 0 && (
            <div className="modal-file-tags">
              {files.map((f, i) => (
                <div key={i} className="modal-file-tag">
                  <span>{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}