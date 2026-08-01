import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDropdownData } from '../lib/useDropdownData'
import { useAuth } from '../context/AuthContext'
import { sanitizeFileName } from '../lib/fileHelpers'
import Modal from './Modal'

export default function ApprovePOAssignWorkOrderModal({ enquiry, latestPO, existingWOCount, onClose, onSaved }) {
  const { user } = useAuth()
  const { designTeam } = useDropdownData()

  const [designer, setDesigner] = useState('')
  const [instructions, setInstructions] = useState('')
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
    if (!designer) {
      alert('Please select a designer to assign the Work Order')
      return
    }

    setSaving(true)
    try {
      // 1. PO ko approve mark karo
      const { error: poUpdateError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'Approved',
          admin_review_notes: remarks.trim(),
          reviewed_by: user?.name || '',
          reviewed_date: new Date().toISOString()
        })
        .eq('id', latestPO.id)

      if (poUpdateError) throw poUpdateError

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: 'PO Approved by Admin',
        remarks: remarks.trim() || `PO ${latestPO.version} approved`,
        logged_by: user?.name || ''
      })

      if (latestPO.submitted_by) {
        await supabase.from('notifications').insert({
          recipient_name: latestPO.submitted_by,
          enquiry_id: enquiry.enquiry_id,
          title: '✅ PO Approved',
          message: `PO ${latestPO.version} for enquiry ${enquiry.enquiry_id} (${enquiry.company_name}) has been approved by ${user?.name}.`,
          type: 'po_approved'
        })
      }

      // 2. Reference files upload karo (agar diye hain)
      let fileUrls = []
      for (const file of files) {
        const filePath = `work-orders/${enquiry.enquiry_id}/${Date.now()}_${sanitizeFileName(file.name)}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('enquiry-attachments')
          .upload(filePath, file)
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('enquiry-attachments').getPublicUrl(filePath)
          fileUrls.push(urlData.publicUrl)
        }
      }

      // 3. Work Order banao aur designer ko assign karo
      const version = `V${(existingWOCount || 0) + 1}`
      const taskId = `WO-${Date.now()}`

      const { error: insertError } = await supabase.from('work_orders').insert({
        task_id: taskId,
        enquiry_id: enquiry.enquiry_id,
        version,
        assigned_to: designer,
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
        remarks: `Work Order ${version} assigned to ${designer}${instructions.trim() ? ' | ' + instructions.trim() : ''}`,
        logged_by: user?.name || ''
      })

      await supabase.from('notifications').insert({
        recipient_name: designer,
        enquiry_id: enquiry.enquiry_id,
        title: '📋 New Work Order Task',
        message: `New Work Order task for ${enquiry.enquiry_id}. 👤 Client: ${enquiry.company_name}`,
        type: 'wo_new_task'
      })

      onSaved()
      onClose()
    } catch (err) {
      alert('Error approving PO / assigning work order: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="🏆 Approve Purchase Order"
      onClose={onClose}
      width="600px"
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSubmit} disabled={saving}>
            <i className="fas fa-check"></i> {saving ? 'Processing…' : 'Approve & Assign Work Order'}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>Assign Work Order to Designer *</label>
        <select value={designer} onChange={e => setDesigner(e.target.value)}>
          <option value="">-- Select Designer --</option>
          {designTeam.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="modal-form-group">
        <label>Work Order Instructions (optional)</label>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="Instructions for the designer…"
        />
      </div>

      <div className="modal-form-group">
        <label>Reference File for Designer (optional)</label>
        <label className="modal-file-btn modal-file-btn-block">
          <i className="fas fa-paperclip"></i> Add Reference File(s)
          <input type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
        </label>
        <div className="modal-helper" style={{ marginTop: 6 }}>
          This file will be visible to the designer in their task card.
        </div>
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
        <label>Approval Remarks (optional)</label>
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Any remarks…"
        />
      </div>
    </Modal>
  )
}
