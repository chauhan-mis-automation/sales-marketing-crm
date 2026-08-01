import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

export default function SendQuestionnaireModal({ enquiry, onClose, onSaved }) {
  const { user } = useAuth()

  const [question, setQuestion] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!question.trim()) {
      alert('Please enter the question / details asked')
      return
    }

    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('questionnaire_rounds').insert({
        enquiry_id: enquiry.enquiry_id,
        question_asked: question.trim(),
        notes: notes.trim(),
        status: 'Sent'
      })
      if (insertError) throw insertError

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: 'Questionnaire Sent',
        remarks: question.trim(),
        logged_by: user?.name || ''
      })

      // Followup team ke sab active users ko notification bhejo
const { data: followupUsers } = await supabase
  .from('users')
  .select('name')
  .eq('role', 'followup')
  .eq('active', true)

if (followupUsers && followupUsers.length > 0) {
  await supabase.from('notifications').insert(
    followupUsers.map(u => ({
      recipient_name: u.name,
      enquiry_id: enquiry.enquiry_id,
      title: '📋 Questionnaire Sent — Take Follow-up',
      message: `Questionnaire sent for enquiry ${enquiry.enquiry_id} (${enquiry.company_name}). Please take follow-up and collect the client's response.`,
      type: 'followup_reminder'
    }))
  )
}

      onSaved()
      onClose()
    } catch (err) {
      alert('Error sending questionnaire: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="📋 Send Questionnaire"
      onClose={onClose}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-paper-plane"></i> {saving ? 'Sending…' : 'Send Questionnaire'}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>Question / Details Asked *</label>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Enter the questions or details you are asking the client…"
          style={{ minHeight: 110 }}
        />
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