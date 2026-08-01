import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { sanitizeFileName } from '../lib/fileHelpers'
import Modal from './Modal'

export default function WorkOrderAdminReviewModal({ enquiry, task, decision, onClose, onSaved }) {
  const { user } = useAuth()
  const [remarks, setRemarks] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)

  const isApprove = decision === 'approve'
  const excelUrl = task.excel_file_url || ''
  const additionalFileUrls = (task.additional_file_url || '').split(',').map(u => u.trim()).filter(Boolean)

  function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!isApprove && !remarks.trim()) {
      alert('Please add a rejection reason')
      return
    }

    setSaving(true)
    try {
      if (isApprove) {
        await supabase
          .from('work_orders')
          .update({
            status: 'Approved',
            admin_review_notes: remarks.trim(),
            admin_review_by: user?.name || '',
            admin_review_date: new Date().toISOString()
          })
          .eq('id', task.id)

        await supabase.from('stage_logs').insert({
          log_id: `LOG-${Date.now()}`,
          enquiry_id: enquiry.enquiry_id,
          stage_name: 'Work Order Approved',
          remarks: remarks.trim() || `Work Order ${task.version} approved`,
          logged_by: user?.name || ''
        })

        if (task.assigned_to) {
          await supabase.from('notifications').insert({
            recipient_name: task.assigned_to,
            enquiry_id: enquiry.enquiry_id,
            title: '✅ Work Order Approved',
            message: `Your Work Order ${task.version} for enquiry ${enquiry.enquiry_id} (${enquiry.company_name}) has been approved by ${user?.name}.`,
            type: 'wo_approved'
          })
        }
      } else {
        let fileUrls = []
        for (const file of files) {
          const filePath = `work-order-admin-ref/${enquiry.enquiry_id}/${Date.now()}_${sanitizeFileName(file.name)}`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('enquiry-attachments')
            .upload(filePath, file)
          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage.from('enquiry-attachments').getPublicUrl(filePath)
            fileUrls.push(urlData.publicUrl)
          }
        }

        await supabase
          .from('work_orders')
          .update({
            status: 'Rejected',
            admin_review_notes: remarks.trim(),
            admin_review_by: user?.name || '',
            admin_review_date: new Date().toISOString(),
            admin_reference_file_url: fileUrls.join(', '),
            revision_count: (task.revision_count || 0) + 1
          })
          .eq('id', task.id)

        await supabase.from('stage_logs').insert({
          log_id: `LOG-${Date.now()}`,
          enquiry_id: enquiry.enquiry_id,
          stage_name: 'Work Order Rejected',
          remarks: remarks.trim(),
          logged_by: user?.name || ''
        })

        if (task.assigned_to) {
          await supabase.from('notifications').insert({
            recipient_name: task.assigned_to,
            enquiry_id: enquiry.enquiry_id,
            title: '❌ Work Order Rejected — Please Revise',
            message: `Admin (${user?.name}) rejected your Work Order ${task.version} for ${enquiry.enquiry_id}. Reason: ${remarks.trim()}${fileUrls.length ? ' 📎 Admin has provided reference file(s) — check your dashboard.' : ''} 👤 Client: ${enquiry.company_name}`,
            type: 'wo_rejected'
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
      title={isApprove ? '✅ Approve Work Order' : '❌ Reject Work Order'}
      onClose={onClose}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button
            className={isApprove ? 'btn-modal-primary' : 'btn-modal-danger'}
            onClick={handleSubmit}
            disabled={saving}
          >
            <i className="fas fa-paper-plane"></i> {saving ? 'Submitting…' : isApprove ? 'Approve' : 'Reject'}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>{task.version} — Work Order for {enquiry.enquiry_id}</label>
        {excelUrl && (
          <a href={excelUrl} target="_blank" rel="noreferrer" className="modal-view-file-btn">
            <i className="fas fa-file-excel"></i> View Submitted Excel
          </a>
        )}
        {additionalFileUrls.length > 0 && (
          <div className="modal-file-tags" style={{ marginTop: excelUrl ? -8 : 0, marginBottom: 14 }}>
            {additionalFileUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="modal-file-tag-link">
                <i className="fas fa-paperclip"></i> File {additionalFileUrls.length > 1 ? i + 1 : ''}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="modal-form-group">
        <label>{isApprove ? 'Approval Remarks (optional)' : 'Rejection Reason *'}</label>
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder={isApprove ? 'Any remarks…' : 'Explain what needs to change…'}
        />
      </div>

      {!isApprove && (
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
