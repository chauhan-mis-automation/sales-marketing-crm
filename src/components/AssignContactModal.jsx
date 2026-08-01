import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSMAuth } from '../context/SMAuthContext'
import { useSMDropdownData } from '../lib/useSMDropdownData'
import { logActivity } from '../lib/activityLog'
import Swal from 'sweetalert2'
import Modal from './Modal'

export default function AssignContactModal({ lead, onClose, onSaved }) {
  const { smUser } = useSMAuth()
  const { salesTeam, marketingTeam, loading } = useSMDropdownData()
  const [selectedPerson, setSelectedPerson] = useState(lead.assigned_to || '')
  const [saving, setSaving] = useState(false)

  const assignableTeam = [...new Set([...salesTeam, ...marketingTeam])]

  async function handleAssign() {
    if (!selectedPerson) { alert('Please select a Sales/Marketing person'); return }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('sm_leads')
        .update({
          assigned_to: selectedPerson,
          status: lead.status === 'New' ? 'Assigned' : lead.status,
          updated_date: new Date().toISOString(),
        })
        .eq('id', lead.id)

      if (error) throw error

      await supabase.from('sm_notifications').insert({
        recipient_name: selectedPerson,
        lead_id: lead.lead_id,
        title: '🎯 New Contact Assigned',
        message: `${lead.name} (${lead.company || 'No company'}) has been assigned to you by ${smUser?.name || ''}.`,
      })

      logActivity({
        userId: smUser?.userId, userName: smUser?.name, role: smUser?.role,
        leadId: lead.lead_id, leadName: lead.name,
        action: 'ASSIGN_LEAD', module: 'Leads',
        details: `Assigned to ${selectedPerson}`,
      })

      await Swal.fire({
        icon: 'success',
        title: 'Assigned!',
        text: `${lead.name} has been assigned to ${selectedPerson}. They will be notified.`,
        confirmButtonColor: '#4a5c40',
        timer: 2500,
        timerProgressBar: true,
      })

      onSaved()
      onClose()
    } catch (err) {
      alert('Error assigning contact: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="👥 Assign Contact"
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleAssign} disabled={saving}>
            <i className="fas fa-user-check"></i> {saving ? 'Assigning…' : 'Assign Lead'}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>Contact</label>
        <input value={lead.name} disabled />
      </div>

      <div className="modal-form-group">
        <label>Assign To Sales Person *</label>
        <select value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)} disabled={loading}>
          <option value="">-- Select Sales Person --</option>
          {assignableTeam.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
    </Modal>
  )
}
