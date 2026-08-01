import { useState } from 'react'
import Swal from 'sweetalert2'
import { supabase } from '../lib/supabaseClient'
import { useDropdownData } from '../lib/useDropdownData'
import { useAuth } from '../context/AuthContext'
import { sanitizeFileName } from '../lib/fileHelpers'
import Modal from './Modal'

export default function GADrawingModal({ enquiry, existingTasksCount, onClose, onSaved }) {
  const { user } = useAuth()
  const { designTeam } = useDropdownData()

  const [assignedTo, setAssignedTo] = useState('')
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
    if (!assignedTo) {
      alert('Please select a designer')
      return
    }

    const confirm = await Swal.fire({
      title: 'Assign GA Drawing',
      text: `Assign to ${assignedTo}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Assign',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2d7a47',
      cancelButtonColor: '#6a8c6f'
    })
    if (!confirm.isConfirmed) return

    setSaving(true)
    try {
      let fileUrls = []
      for (const file of files) {
        const filePath = `ga-drawing-requests/${enquiry.enquiry_id}/${Date.now()}_${sanitizeFileName(file.name)}`
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
      const taskId = `GAD-${Date.now()}`

      const { error: insertError } = await supabase.from('ga_drawing_tasks').insert({
        task_id: taskId,
        enquiry_id: enquiry.enquiry_id,
        version,
        assigned_to: assignedTo,
        assigned_by: `${user?.name || ''} (${(user?.role || '').toLowerCase()})`,
        request_notes: notes.trim(),
        request_file_url: fileUrls.join(', '),
        status: 'Requested',
        revision_count: 0
      })
      if (insertError) throw insertError

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: 'GA Drawing Assigned',
        remarks: `GA Drawing ${version} assigned to ${assignedTo}${notes.trim() ? ' | ' + notes.trim() : ''}`,
        logged_by: user?.name || ''
      })

      // TAT dropdown_list ke "ga_drawing" column se nikalo
      const { data: tatRows } = await supabase
        .from('dropdown_list')
        .select('ga_drawing')
        .not('ga_drawing', 'is', null)
        .order('row_no', { ascending: true })
        .limit(1)
      const tat = tatRows && tatRows[0] ? tatRows[0].ga_drawing : null

      await supabase.from('notifications').insert({
        recipient_name: assignedTo,
        enquiry_id: enquiry.enquiry_id,
        title: '📐 New GA Drawing Task',
        message: `New GA Drawing task for ${enquiry.enquiry_id}.${tat ? ` Deadline: ${tat}.` : ''} 👤 Client: ${enquiry.company_name}`,
        type: 'ga_new_task'
      })

      onSaved()
      onClose()
    } catch (err) {
      alert('Error assigning GA Drawing: ' + err.message)
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
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-paper-plane"></i> {saving ? 'Assigning…' : 'Submit'}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>Select Designer *</label>
        <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
          <option value="">-- Choose Designer --</option>
          {designTeam.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="modal-form-group">
        <label>Instructions / Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Requirements or instructions for the designer…"
        />
      </div>

      <div className="modal-form-group">
        <label>Reference File(s) (optional)</label>
        <label className="modal-file-btn">
          <i className="fas fa-paperclip"></i> Add File(s)
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
    </Modal>
  )
}
