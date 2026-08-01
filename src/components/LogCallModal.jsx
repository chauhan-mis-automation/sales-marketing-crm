import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDropdownData } from '../lib/useDropdownData'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

// In stages mein se koi select hone par follow-up date field hide ho jayegi
const HIDE_FOLLOWUP_STAGES = [
  'Questionnaire',
  'Waiting For Filled Questionnaire By client',
  'Technical Flow Chart Submited',
  'Client Want Flowchart Revision'
]

export default function LogCallModal({ enquiry, onClose, onSaved }) {
  const { user } = useAuth()
  const { stages } = useDropdownData()

  const [callType, setCallType] = useState('Outgoing')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [newStage, setNewStage] = useState('')
  const [saving, setSaving] = useState(false)

  const shouldHideFollowup = HIDE_FOLLOWUP_STAGES.includes(newStage)

  function handleStageChange(value) {
    setNewStage(value)
    if (HIDE_FOLLOWUP_STAGES.includes(value)) {
      setFollowupDate('') // stage change hone par purani date clear kar do
    }
  }

  async function handleSave() {
    if (!notes.trim()) {
      alert('Please add call notes')
      return
    }

    setSaving(true)
    try {
      const now = new Date().toISOString()
      const today = new Date().toISOString().slice(0, 10)

      const { error: callError } = await supabase.from('call_history').insert({
        call_id: `CALL-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        date: now,
        call_type: callType,
        duration: duration ? parseInt(duration) : null,
        notes: notes.trim(),
        next_action: nextAction.trim(),
        followup_date: shouldHideFollowup ? null : (followupDate || null),
        logged_by: user?.name || ''
      })
      if (callError) throw callError

      const enquiryUpdate = { last_followup_date: today }
      if (!shouldHideFollowup && followupDate) {
        enquiryUpdate.next_followup_date = followupDate
      }

      if (newStage && newStage !== enquiry.current_stage) {
        enquiryUpdate.current_stage = newStage
      }

      const { error: updateError } = await supabase
        .from('enquiries')
        .update(enquiryUpdate)
        .eq('enquiry_id', enquiry.enquiry_id)
      if (updateError) throw updateError

      if (newStage && newStage !== enquiry.current_stage) {
        await supabase.from('stage_logs').insert({
          log_id: `LOG-${Date.now()}`,
          enquiry_id: enquiry.enquiry_id,
          stage_name: newStage,
          remarks: notes.trim(),
          logged_by: user?.name || ''
        })
      }

      onSaved()
      onClose()
    } catch (err) {
      alert('Error saving call: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="📞 Add Call Log"
      onClose={onClose}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Save Call'}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>Call Type</label>
        <select value={callType} onChange={e => setCallType(e.target.value)}>
          <option>Outgoing</option>
          <option>Incoming</option>
        </select>
      </div>

      <div className="modal-form-group">
        <label>Duration (min)</label>
        <input
          type="number"
          min="0"
          value={duration}
          onChange={e => setDuration(e.target.value)}
          placeholder="e.g. 10"
        />
      </div>

      <div className="modal-form-group">
        <label>Notes *</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="What was discussed?"
        />
      </div>

      <div className="modal-form-group">
        <label>Update Stage (optional)</label>
        <select value={newStage} onChange={e => handleStageChange(e.target.value)}>
          <option value="">-- No change --</option>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="modal-helper">Select a stage to move the enquiry forward</div>
      </div>

      {!shouldHideFollowup && (
        <div className="modal-form-group">
          <label>Next Follow-up Date</label>
          <input
            type="date"
            value={followupDate}
            onChange={e => setFollowupDate(e.target.value)}
          />
        </div>
      )}
    </Modal>
  )
}