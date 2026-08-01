import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

export default function ReceiveQuestionnaireModal({ enquiry, pendingQuestion, onClose, onSaved }) {
  const { user } = useAuth()

  const [file, setFile] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function handleFileSelect(e) {
    setFile(e.target.files[0] || null)
  }

  async function handleSave() {
    if (!file) {
      alert('Please upload the answer / info received file')
      return
    }

    setSaving(true)
    try {
      const filePath = `questionnaire-answers/${enquiry.enquiry_id}/${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('enquiry-attachments')
        .upload(filePath, file)

      let fileUrl = ''
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('enquiry-attachments')
          .getPublicUrl(filePath)
        fileUrl = urlData.publicUrl
      }

      const { error: updateError } = await supabase
        .from('questionnaire_rounds')
        .update({
          received_date: new Date().toISOString(),
          answer_file_url: fileUrl,
          answer_notes: notes.trim(),
          status: 'Received'
        })
        .eq('id', pendingQuestion.id)
      if (updateError) throw updateError

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: 'Questionnaire Received',
        remarks: 'Info received from client' + (notes.trim() ? ' | ' + notes.trim() : ''),
        logged_by: user?.name || ''
      })

      onSaved()
      onClose()
    } catch (err) {
      alert('Error marking as received: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="✅ Mark Questionnaire Received"
      onClose={onClose}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-check"></i> {saving ? 'Saving…' : 'Mark as Received'}
          </button>
        </>
      }
    >
      <div className="modal-question-box">
        <div className="modal-question-label">Question Asked</div>
        <div className="modal-question-text">{pendingQuestion?.question_asked || '—'}</div>
      </div>

      <div className="modal-form-group">
        <label>Answer / Info Received (File Upload) *</label>
        <label className="modal-file-btn modal-file-btn-block">
          <i className="fas fa-paperclip"></i> {file ? file.name : 'Upload Answer File'}
          <input type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
        </label>
      </div>

      <div className="modal-form-group">
        <label>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any additional notes…"
        />
      </div>
    </Modal>
  )
}