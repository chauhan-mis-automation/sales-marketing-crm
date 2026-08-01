import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { sanitizeFileName } from '../lib/fileHelpers'
import Modal from './Modal'

export default function GADrawingClientActionModal({ enquiry, latestTask, onClose, onSaved }) {
  const { user } = useAuth()
  const [action, setAction] = useState('')
  const [remarks, setRemarks] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)

  function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!action) {
      alert('Please select an action')
      return
    }

    setSaving(true)
    try {
      if (action === 'share') {
        await supabase
          .from('ga_drawing_tasks')
          .update({ status: 'Shared with Client', client_shared_date: new Date().toISOString() })
          .eq('id', latestTask.id)

        await supabase.from('stage_logs').insert({
          log_id: `LOG-${Date.now()}`,
          enquiry_id: enquiry.enquiry_id,
          stage_name: 'GA Drawing Shared with Client',
          remarks: 'GA Drawing shared with client.',
          logged_by: user?.name || ''
        })
      } else if (action === 'approved') {
        await supabase
          .from('ga_drawing_tasks')
          .update({
            status: 'Client Approved',
            client_feedback: remarks.trim(),
            client_approved_date: new Date().toISOString()
          })
          .eq('id', latestTask.id)

        await supabase
          .from('enquiries')
          .update({ current_stage: 'Client is Waiting For Approval on GA Drawing By End Client' })
          .eq('enquiry_id', enquiry.enquiry_id)

        await supabase.from('stage_logs').insert({
          log_id: `LOG-${Date.now()}`,
          enquiry_id: enquiry.enquiry_id,
          stage_name: 'GA Drawing Approved by Client',
          remarks: `Client approved GA Drawing (via follow-up)${remarks.trim() ? ': ' + remarks.trim() : ''}`,
          logged_by: user?.name || ''
        })
      } else if (action === 'changes') {
        if (!remarks.trim()) {
          alert("Please enter client's feedback")
          setSaving(false)
          return
        }

        let fileUrls = []
        for (const file of files) {
          const filePath = `ga-drawing-client-feedback/${enquiry.enquiry_id}/${Date.now()}_${sanitizeFileName(file.name)}`
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
            status: 'Client Revision Requested',
            client_feedback: remarks.trim(),
            client_reference_file_url: fileUrls.join(', '),
            client_approved_date: new Date().toISOString()
          })
          .eq('id', latestTask.id)

        await supabase
          .from('enquiries')
          .update({ current_stage: 'GA Drawing Revision By client' })
          .eq('enquiry_id', enquiry.enquiry_id)

        await supabase.from('stage_logs').insert({
          log_id: `LOG-${Date.now()}`,
          enquiry_id: enquiry.enquiry_id,
          stage_name: 'Client Wants Changes on GA Drawing',
          remarks: `Client wants changes (via follow-up): ${remarks.trim()}${fileUrls.length ? ' | Client ref file uploaded' : ''}`,
          logged_by: user?.name || ''
        })

        if (latestTask.assigned_to) {
          await supabase.from('notifications').insert({
            recipient_name: latestTask.assigned_to,
            enquiry_id: enquiry.enquiry_id,
            title: '🔄 Client Wants Changes — Create Revision',
            message: `Client wants changes on GA Drawing for ${enquiry.enquiry_id} (${enquiry.company_name}). Please create a revision.`,
            type: 'ga_client_changes'
          })
        }
      }

      onSaved()
      onClose()
    } catch (err) {
      alert('Error saving action: ' + err.message)
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
            <i className="fas fa-paper-plane"></i> {saving ? 'Submitting…' : 'Submit'}
          </button>
        </>
      }
    >
      <div className="modal-approved-banner">
        <div><i className="fas fa-check-circle"></i><strong>GA Drawing Approved by Admin!</strong></div>
        <div>Please select what you want to do from the dropdown below and submit.</div>
      </div>

      <div className="modal-section-label">
        <i className="fas fa-user-check"></i> GA Drawing Action
      </div>

      <div className="modal-form-group">
        <label>Select Action *</label>
        <select value={action} onChange={e => setAction(e.target.value)}>
          <option value="">-- Select Action --</option>
          <option value="share">📤 Share Drawing with Client</option>
          <option value="approved">✅ Client Approved Drawing</option>
          <option value="changes">🔄 Client Wants Changes</option>
        </select>
      </div>

      {(action === 'approved' || action === 'changes') && (
        <div className="modal-form-group">
          <label>Remarks {action === 'changes' ? '/ Client Feedback *' : ''}</label>
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Enter remarks or client feedback…"
          />
        </div>
      )}

      {action === 'changes' && (
        <div className="modal-form-group">
          <label>Client Reference File (optional)</label>
          <div className="modal-helper" style={{ marginTop: 0, marginBottom: 10 }}>
            <i className="fas fa-info-circle"></i> Upload any reference/markup file from client showing the required changes. This will be visible to the designer.
          </div>
          <label className="modal-file-btn modal-file-btn-block">
            <i className="fas fa-paperclip"></i> Add Client Reference File(s)
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
