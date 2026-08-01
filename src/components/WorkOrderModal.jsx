import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDropdownData } from '../lib/useDropdownData'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

export default function WorkOrderModal({ enquiry, existingTasksCount, onClose, onSaved }) {
  const { user } = useAuth()
  const { designTeam } = useDropdownData()

  const [assignedTo, setAssignedTo] = useState('')
  const [instructions, setInstructions] = useState('')
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

    setSaving(true)
    try {
      let fileUrls = []
      for (const file of files) {
        const filePath = `work-orders/${enquiry.enquiry_id}/${Date.now()}_${file.name}`
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
      const taskId = `WO-${Date.now()}`

      const { error: insertError } = await supabase.from('work_orders').insert({
        task_id: taskId,
        enquiry_id: enquiry.enquiry_id,
        version,
        assigned_to: assignedTo,
        instructions: instructions.trim(),
        request_file_url: fileUrls.join(', '),
        status: 'Requested',
        revision_count: 0,
        authorized_by: user?.name || ''
      })
      if (insertError) throw insertError

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: 'Work Order Assigned',
        remarks: `Work Order ${version} assigned to ${assignedTo}${instructions.trim() ? ' | ' + instructions.trim() : ''}`,
        logged_by: user?.name || ''
      })

      onSaved()
      onClose()
    } catch (err) {
      alert('Error assigning Work Order: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="📋 Assign Work Order"
      onClose={onClose}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-paper-plane"></i> {saving ? 'Assigning…' : 'Assign'}
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
        <label>Instructions</label>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="Work order details, specifications..."
        />
      </div>

      <div className="modal-form-group">
        <label>Reference File(s) (optional)</label>
        <label className="modal-file-btn modal-file-btn-block">
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