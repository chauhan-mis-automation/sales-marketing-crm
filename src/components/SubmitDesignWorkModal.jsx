import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { sanitizeFileName } from '../lib/fileHelpers'
import Modal from './Modal'

export default function SubmitDesignWorkModal({ task, companyName, isResubmission, onClose, onSaved }) {
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [remarks, setRemarks] = useState('')
  const [asPerRef, setAsPerRef] = useState('')
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
    if (files.length === 0) {
      alert('Please upload the completed file')
      return
    }
    if (!asPerRef) {
      alert('Please answer: Have you prepared the GA Drawing as per the reference file?')
      return
    }

    setSaving(true)
    try {
      let fileUrls = []
      for (const file of files) {
        const filePath = `ga-drawing-submissions/${task.enquiry_id}/${Date.now()}_${sanitizeFileName(file.name)}`
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

      const notesWithConfirmation = `[Prepared as per reference file: ${asPerRef}]${remarks.trim() ? ' ' + remarks.trim() : ''}`

      await supabase
        .from('ga_drawing_tasks')
        .update({
          designer_file_url: fileUrls.join(', '),
          designer_notes: notesWithConfirmation,
          designer_submission_date: new Date().toISOString(),
          status: 'Submitted for Review',
          revision_count: isResubmission ? (task.revision_count || 0) + 1 : (task.revision_count || 0)
        })
        .eq('id', task.id)

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: task.enquiry_id,
        stage_name: isResubmission ? 'GA Drawing Resubmitted by Designer' : 'GA Drawing Submitted by Designer',
        remarks: isResubmission
          ? 'Designer resubmitted GA drawing after rejection. Awaiting admin review.'
          : 'Designer submitted GA drawing. Awaiting admin review.',
        logged_by: user?.name || ''
      })

      // Admin/superadmin users ko notify karo
      const { data: adminUsers } = await supabase
        .from('users')
        .select('name')
        .in('role', ['admin', 'superadmin'])
        .eq('active', true)

      if (adminUsers && adminUsers.length > 0) {
        const title = isResubmission ? '📐 GA Drawing Resubmitted After Rejection' : '📐 New GA Drawing Submitted for Review'
        const message = isResubmission
          ? `${user?.name} has resubmitted the GA Drawing for enquiry ${task.enquiry_id} (${companyName}) after your rejection. Please review again.`
          : `${user?.name} has submitted GA Drawing for enquiry ${task.enquiry_id} (${companyName}). Please review and approve/reject.`

        await supabase.from('notifications').insert(
          adminUsers.map(a => ({
            recipient_name: a.name,
            enquiry_id: task.enquiry_id,
            title,
            message,
            type: isResubmission ? 'ga_resubmitted' : 'ga_review'
          }))
        )
      }

      onSaved()
      onClose()
    } catch (err) {
      alert('Error submitting work: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="🚀 Submit Design Work"
      onClose={onClose}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSubmit} disabled={saving}>
            <i className="fas fa-upload"></i> {saving ? 'Submitting…' : 'Submit Work'}
          </button>
        </>
      }
    >
      <div className="modal-info-banner">
        <i className="fas fa-info-circle"></i>
        <span>Your submission will be sent to admin for review before sharing with the client.</span>
      </div>

      <div className="modal-form-group">
        <label>Upload Completed File *</label>
        <label className="modal-file-btn modal-file-btn-block">
          <i className="fas fa-paperclip"></i> {files.length > 0 ? `${files.length} file(s) selected` : 'Choose Files'}
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

      <div className="modal-form-group">
        <label>Have you prepared the GA Drawing as per the reference file? *</label>
        <select value={asPerRef} onChange={e => setAsPerRef(e.target.value)}>
          <option value="">-- Select --</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>

      <div className="modal-form-group">
        <label>Work Remarks (optional)</label>
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Any comments for the admin / follow-up team?"
        />
      </div>
    </Modal>
  )
}