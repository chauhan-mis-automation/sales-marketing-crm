import { useState } from 'react'
import Swal from 'sweetalert2'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

export default function FlowchartDecisionModal({ enquiry, latestTask, onClose, onSaved }) {
  const { user } = useAuth()

  const [decision, setDecision] = useState('')
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
    if (!decision) {
      alert('Please select a client decision')
      return
    }
    if (!remarks.trim()) {
      alert("Please enter client's feedback")
      return
    }

    if (decision === 'approved') {
      const result = await Swal.fire({
        title: 'Confirm Client Approval?',
        text: 'This will move the enquiry to "Flowchart Approved" stage.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Approve',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#2d7a47',
        cancelButtonColor: '#6a8c6f'
      })
      if (!result.isConfirmed) return
      await handleApprove()
    } else {
      await handleReject()
    }
  }

  async function handleApprove() {
    setSaving(true)
    try {
      await supabase
        .from('flowchart_tasks')
        .update({
          status: 'Client Approved',
          client_feedback: remarks.trim(),
          decision_date: new Date().toISOString()
        })
        .eq('id', latestTask.id)

      await supabase
        .from('enquiries')
        .update({ current_stage: 'Received Confirmation on Flow Chart' })
        .eq('enquiry_id', enquiry.enquiry_id)

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: 'Flowchart Approved',
        remarks: `Flowchart approved by client (via follow-up): ${remarks.trim()}`,
        logged_by: user?.name || ''
      })

      if (enquiry.assign_to_backend) {
        await supabase.from('notifications').insert({
          recipient_name: enquiry.assign_to_backend,
          enquiry_id: enquiry.enquiry_id,
          title: '✅ Flowchart Approved — Send Quotation',
          message: `Client approved flowchart for ${enquiry.enquiry_id}. Please send the quotation now. TAT timer has started. 👤 Client: ${enquiry.company_name}`,
          type: 'approval'
        })
      }

      onSaved()
      onClose()
    } catch (err) {
      alert('Error saving approval: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleReject() {
    setSaving(true)
    try {
      let fileUrls = []
      for (const file of files) {
        const filePath = `flowchart-client-feedback/${enquiry.enquiry_id}/${Date.now()}_${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('enquiry-attachments')
          .upload(filePath, file)

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('enquiry-attachments')
            .getPublicUrl(filePath)
          fileUrls.push(urlData.publicUrl)
        }
      }

      await supabase
        .from('flowchart_tasks')
        .update({
          status: 'Client Revision Requested',
          client_feedback: remarks.trim(),
          client_reference_file_url: fileUrls.join(', '),
          decision_date: new Date().toISOString()
        })
        .eq('id', latestTask.id)

      await supabase
        .from('enquiries')
        .update({ current_stage: 'Client Want Flowchart Revision' })
        .eq('enquiry_id', enquiry.enquiry_id)

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: 'Client Wants Changes',
        remarks: `Client wants changes (via follow-up): ${remarks.trim()}${fileUrls.length ? ' | Client ref file uploaded' : ''}`,
        logged_by: user?.name || ''
      })

      if (enquiry.assign_to_backend) {
        await supabase.from('notifications').insert({
          recipient_name: enquiry.assign_to_backend,
          enquiry_id: enquiry.enquiry_id,
          title: '❌ Flowchart/GA Drawing Rejected!',
          message: `Client Rejected Flowchart for ${enquiry.enquiry_id}. Please update and resend!`,
          type: 'rejection'
        })
      }

      onSaved()
      onClose()
    } catch (err) {
      alert('Error saving decision: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="📁 Flowchart Action"
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
      <div className="modal-section-label">
        <i className="fas fa-user-check"></i> Client Decision on Flowchart
      </div>

      <div className="modal-form-group">
        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 12px', fontSize: 13.5, color: 'var(--text2)'
        }}>
          <strong>Current Stage:</strong> {enquiry.current_stage || '—'}
        </div>
      </div>

      <div className="modal-form-group">
        <label>Client Decision *</label>
        <select value={decision} onChange={e => setDecision(e.target.value)}>
          <option value="">-- Select Decision --</option>
          <option value="approved">✅ Client Approved Flowchart</option>
          <option value="changes">🔄 Client Wants Changes</option>
        </select>
      </div>

      <div className="modal-form-group">
        <label>Remarks / Feedback *</label>
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Enter client's feedback here…"
        />
      </div>

      {decision === 'changes' && (
        <div className="modal-form-group">
          <label>Client Reference File (optional)</label>
          <div className="modal-helper" style={{ marginTop: 0, marginBottom: 10 }}>
            <i className="fas fa-info-circle"></i> Upload any markup/reference file from client. Backend team will see this in the Flowchart section.
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