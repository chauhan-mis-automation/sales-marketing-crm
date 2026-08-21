import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { addBusinessDaysExcludingSunday, formatDateISO } from '../lib/dateHelpers'
import Modal from './Modal'

export default function FlowchartModal({ enquiry, existingTasksCount, isRevision, onClose, onSaved }) {
  const { user } = useAuth()

  const [notes, setNotes] = useState('')
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

  async function handleSave() {
    if (files.length === 0) {
      alert('Please upload the flowchart file')
      return
    }

    setSaving(true)
    try {
      let fileUrls = []
      for (const file of files) {
        const filePath = `flowchart-requests/${enquiry.enquiry_id}/${Date.now()}_${file.name}`
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

      const version = `V${(existingTasksCount || 0) + 1}`
      const taskId = `FC-${Date.now()}`

      const { error: insertError } = await supabase.from('flowchart_tasks').insert({
        task_id: taskId,
        enquiry_id: enquiry.enquiry_id,
        version,
        designer_file_url: fileUrls.join(', '),
        designer_notes: notes.trim(),
        client_shared_date: new Date().toISOString(),
        status: 'Shared with Client',
        revision_count: existingTasksCount || 0
      })
      if (insertError) throw insertError

      // Next follow-up date: 3 working days baad, Sunday skip karke
      const nextFollowupDate = formatDateISO(addBusinessDaysExcludingSunday(new Date(), 3))

      await supabase
        .from('enquiries')
        .update({
          current_stage: 'Technical Flow Chart Submited',
          next_followup_date: nextFollowupDate
        })
        .eq('enquiry_id', enquiry.enquiry_id)

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: 'Flowchart Shared with Client',
        remarks: `Flowchart shared with client. Next follow-up date: ${nextFollowupDate}`,
        logged_by: user?.name || ''
      })

      // Followup team ke sab active users ko notification bhejo
      const { data: followupUsers } = await supabase
        .from('users')
        .select('name')
        .eq('role', 'followup')
        .eq('active', true)

      if (followupUsers && followupUsers.length > 0) {
        const title = isRevision ? '📤 Revised Flowchart Sent to Client' : '📤 Flowchart Sent to Client'
        const label = isRevision ? 'Revised Flowchart' : 'Flowchart'
        await supabase.from('notifications').insert(
          followupUsers.map(u => ({
            recipient_name: u.name,
            enquiry_id: enquiry.enquiry_id,
            title,
            message: `${label} sent to client — ${enquiry.company_name} (${enquiry.enquiry_id}). Please take follow-up on ${nextFollowupDate}.`,
            type: 'followup_reminder'
          }))
        )
      }

      onSaved()
      onClose()
    } catch (err) {
      alert('Error submitting flowchart: ' + err.message)
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
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-paper-plane"></i> {saving ? 'Submitting…' : 'Submit'}
          </button>
        </>
      }
    >
      <div className="modal-section-label">
        <i className="fas fa-upload"></i> Upload &amp; Submit
      </div>

      <div className="modal-form-group">
        <label>Upload Flowchart File *</label>
        <label className="modal-file-btn modal-file-btn-block">
          <i className="fas fa-paperclip"></i> Upload Flowchart File(s)
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
        <label>Remarks</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add remarks…"
        />
      </div>
    </Modal>
  )
}