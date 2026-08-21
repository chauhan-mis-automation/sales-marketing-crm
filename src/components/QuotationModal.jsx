import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { sanitizeFileName } from '../lib/fileHelpers'
import { addBusinessDaysExcludingSunday, formatDateISO } from '../lib/dateHelpers'
import Modal from './Modal'

export default function QuotationModal({ enquiry, existingQuotationsCount, flowchartTasks, onClose, onSaved }) {
  const { user } = useAuth()

  const [action, setAction] = useState(existingQuotationsCount > 0 ? 'revise' : 'add')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)

  // Guard: agar is enquiry mein Flowchart step shuru hua tha (kam se kam 1 task
  // exist karta hai), to jab tak koi bhi version 'Client Approved' na ho,
  // Quotation bhejna block rahega. Agar Flowchart kabhi shuru hi nahi hua
  // (enquiry seedha Quotation path se aaya), to koi restriction nahi.
  const hasFlowchartStarted = (flowchartTasks || []).length > 0
  const flowchartApproved = (flowchartTasks || []).some(t => t.status === 'Client Approved')
  const blockedByFlowchart = hasFlowchartStarted && !flowchartApproved

  function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (blockedByFlowchart) {
      alert('Flowchart abhi tak Client se confirm/approve nahi hua hai. Quotation bhejne se pehle Flowchart Approve hona zaroori hai.')
      return
    }

    if (files.length === 0) {
      alert('Please upload at least one quotation file')
      return
    }

    setSaving(true)
    try {
      let fileUrls = []
      for (const file of files) {
        const filePath = `quotations/${enquiry.enquiry_id}/${Date.now()}_${sanitizeFileName(file.name)}`
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

      const version = `V${(existingQuotationsCount || 0) + 1}`
      const quoteId = `QT-${Date.now()}`
      const isRevision = action === 'revise'

      const { error: insertError } = await supabase.from('quotation_versions').insert({
        quote_id: quoteId,
        enquiry_id: enquiry.enquiry_id,
        version,
        file_url: fileUrls.join(', '),
        revision_count: isRevision ? (existingQuotationsCount || 0) : 0,
        status: isRevision ? 'Revision' : 'Sent',
        notes: notes.trim(),
        amount: amount ? parseFloat(amount) : null
      })
      if (insertError) throw insertError

      // Next follow-up date: 6 working days baad, Sunday skip karke
      const nextFollowupDate = formatDateISO(addBusinessDaysExcludingSunday(new Date(), 6))

      await supabase
        .from('enquiries')
        .update({
          current_stage: isRevision ? 'Client Want Quotation Revision' : 'Quotation',
          next_followup_date: nextFollowupDate
        })
        .eq('enquiry_id', enquiry.enquiry_id)

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: isRevision ? 'Quotation Revision Sent' : 'Quotation Sent',
        remarks: `Quote ${version}${amount ? ' — ₹' + amount : ''}${notes.trim() ? ' | ' + notes.trim() : ''} | Next follow-up date: ${nextFollowupDate}`,
        logged_by: user?.name || ''
      })

      // Followup team ke sab active users ko notification bhejo
      const { data: followupUsers } = await supabase
        .from('users')
        .select('name')
        .eq('role', 'followup')
        .eq('active', true)

      if (followupUsers && followupUsers.length > 0) {
        const title = isRevision ? '💰 Revised Quotation Sent to Client' : '💰 Quotation Sent to Client'
        const label = isRevision ? `Revised Quotation ${version}` : `Quotation ${version}`
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
      alert('Error saving quotation: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="💰 Quotation Action"
      onClose={onClose}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving || blockedByFlowchart}>
            <i className="fas fa-paper-plane"></i> {saving ? 'Submitting…' : 'Submit'}
          </button>
        </>
      }
    >
      {blockedByFlowchart && (
        <div className="modal-form-group" style={{
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
          padding: '10px 14px', color: '#b91c1c', fontSize: 13, fontWeight: 600
        }}>
          ⚠️ Flowchart abhi tak Client se Approve nahi hua hai. Quotation bhejने ke liye pehle Flowchart Approve hona zaroori hai.
        </div>
      )}

      <div className="modal-form-group">
        <label>Upload Quotation File(s) *</label>
        <label className="modal-file-btn">
          <i className="fas fa-paperclip"></i> Add File(s)
          <input type="file" multiple accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
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
        <label>Action *</label>
        <select value={action} onChange={e => setAction(e.target.value)}>
          <option value="add">Send New Quotation to Client</option>
          <option value="revise">Revise Quotation</option>
        </select>
      </div>

      <div className="modal-form-group">
        <label>Amount (₹)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="e.g. 250000"
        />
      </div>

      <div className="modal-form-group">
        <label>Remarks</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Remarks…"
        />
      </div>
    </Modal>
  )
}