import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSMAuth } from '../context/SMAuthContext'
import { logActivity } from '../lib/activityLog'
import Modal from './Modal'

const ROLES = ['Admin', 'Sales', 'BackOffice', 'Marketing']

function generateUserId() {
  return 'USR-' + Math.random().toString(36).substr(2, 9).toUpperCase()
}

export default function AddSMUserModal({ onClose, onSaved }) {
  const { smUser } = useSMAuth()
  const [form, setForm] = useState({
    name: '', email: '', designation: '', officialEmail: '',
    phone: '', role: '', password: '',
  })
  const [saving, setSaving] = useState(false)

  function updateField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.role || !form.password || !form.designation.trim()) {
      alert('All required fields (*) must be filled')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('sm_users').insert({
        user_id: generateUserId(),
        name: form.name.trim(),
        email: form.email.trim(),
        official_email: form.officialEmail.trim() || null,
        phone: form.phone.trim(),
        role: form.role,
        password: form.password,
        designation: form.designation.trim(),
        status: 'Active',
      })
      if (error) throw error

      logActivity({
        userId: smUser?.userId, userName: smUser?.name, role: smUser?.role,
        action: 'ADD_USER', module: 'Team',
        details: `New team member added: ${form.name.trim()} (${form.role})`,
      })

      onSaved()
      onClose()
    } catch (err) {
      alert('Error adding user: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="👤 Add Team Member"
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-user-plus"></i> {saving ? 'Adding…' : 'Add User'}
          </button>
        </>
      }
    >
      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Full Name *</label>
          <input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Full name" />
        </div>
        <div className="modal-form-group">
          <label>Personal Email *</label>
          <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="name@email.com" />
        </div>
      </div>
      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Designation *</label>
          <input value={form.designation} onChange={e => updateField('designation', e.target.value)} placeholder="e.g. Sales Manager" />
        </div>
        <div className="modal-form-group">
          <label>Official Email</label>
          <input type="email" value={form.officialEmail} onChange={e => updateField('officialEmail', e.target.value)} placeholder="company@email.com" />
        </div>
      </div>
      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Phone *</label>
          <input value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="Phone number" />
        </div>
        <div className="modal-form-group">
          <label>Role *</label>
          <select value={form.role} onChange={e => updateField('role', e.target.value)}>
            <option value="">-- Select Role --</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="modal-form-group">
        <label>Password *</label>
        <input type="password" value={form.password} onChange={e => updateField('password', e.target.value)} placeholder="Minimum 6 characters" />
      </div>
    </Modal>
  )
}
