import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDropdownData } from '../lib/useDropdownData'
import { useAuth } from '../context/AuthContext'
import SearchableSelect from './SearchableSelect'
import Modal from './Modal'

export default function AssignTeamModal({ enquiry, onClose, onSaved }) {
  const { user } = useAuth()
  const { frontendTeam, backendTeam, loading: dropdownsLoading } = useDropdownData()

  const [assignedFrontend, setAssignedFrontend] = useState(enquiry.assign_to_frontend || '')
  const [assignedBackend, setAssignedBackend] = useState(enquiry.assign_to_backend || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!assignedFrontend) { alert('Assign To Frontend is required'); return }

    setSaving(true)
    try {
      const frontendChanged = assignedFrontend !== enquiry.assign_to_frontend
      const backendChanged = assignedBackend && assignedBackend !== enquiry.assign_to_backend

      const { error } = await supabase
        .from('enquiries')
        .update({
          assign_to_frontend: assignedFrontend,
          assign_to_backend: assignedBackend || null,
        })
        .eq('enquiry_id', enquiry.enquiry_id)

      if (error) throw error

      const wasUnassigned = !enquiry.assign_to_frontend && !enquiry.assign_to_backend

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: wasUnassigned ? 'Team Assigned' : 'Team Reassigned',
        remarks: `Frontend: ${assignedFrontend || '—'} | Backend: ${assignedBackend || '—'} — by ${user?.name || ''}`,
        logged_by: user?.name || ''
      })

      const notifRecipients = []
      if (frontendChanged && assignedFrontend) notifRecipients.push({ name: assignedFrontend, role: 'Frontend' })
      if (backendChanged) notifRecipients.push({ name: assignedBackend, role: 'Backend' })

      if (notifRecipients.length > 0) {
        await supabase.from('notifications').insert(
          notifRecipients.map(r => ({
            recipient_name: r.name,
            enquiry_id: enquiry.enquiry_id,
            title: '🎯 Enquiry Assigned to You',
            message: `Enquiry ${enquiry.enquiry_id} (${enquiry.company_name}) has been assigned to you as ${r.role} by ${user?.name || ''}.`,
            type: 'assignment'
          }))
        )
      }

      onSaved()
      onClose()
    } catch (err) {
      alert('Error assigning team: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="👥 Assign Team"
      onClose={onClose}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Save Assignment'}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>
        {enquiry.enquiry_id} · {enquiry.company_name}
      </p>

      <div className="modal-form-group">
        <label>Assign To Frontend *</label>
        <SearchableSelect
          value={assignedFrontend}
          onChange={setAssignedFrontend}
          options={frontendTeam}
          loading={dropdownsLoading}
          placeholder="Select"
        />
      </div>

      <div className="modal-form-group">
        <label>Assign To Backend</label>
        <SearchableSelect
          value={assignedBackend}
          onChange={setAssignedBackend}
          options={backendTeam}
          loading={dropdownsLoading}
          placeholder="Select"
        />
      </div>
    </Modal>
  )
}
