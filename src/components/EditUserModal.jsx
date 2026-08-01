import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Modal from './Modal'

const ROLES = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'followup', label: 'Follow-up Team' },
  { value: 'frontend', label: 'User (Frontend)' },
  { value: 'backend', label: 'Backend Team' },
  { value: 'design', label: 'Design Team' },
]

export default function EditUserModal({ targetUser, onClose, onSaved }) {
  const [username, setUsername] = useState(targetUser.username)
  const [name, setName] = useState(targetUser.name || '')
  const [email, setEmail] = useState(targetUser.email || '')
  const [role, setRole] = useState(targetUser.role || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!username.trim() || !name.trim() || !role) {
      alert('Username, Name and Role are required')
      return
    }

    setSaving(true)
    try {
      const cleanUsername = username.trim().toLowerCase()

      if (cleanUsername !== targetUser.username) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('username', cleanUsername)
          .maybeSingle()

        if (existing) {
          alert('That username is already taken by another user.')
          setSaving(false)
          return
        }
      }

      const { error } = await supabase
        .from('users')
        .update({
          username: cleanUsername,
          name: name.trim(),
          email: email.trim() || null,
          role
        })
        .eq('id', targetUser.id)

      if (error) throw error

      onSaved()
      onClose()
    } catch (err) {
      alert('Error updating user: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="✏️ Edit User"
      onClose={onClose}
      width="440px"
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      <p className="modal-helper" style={{ marginTop: 0 }}>
        Editing: <strong>{targetUser.username}</strong>
      </p>

      <div className="modal-form-group">
        <label>Username *</label>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. sales1@casilica.com" />
      </div>

      <div className="modal-form-group">
        <label>Full Name *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
      </div>

      <div className="modal-form-group">
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com" />
      </div>

      <div className="modal-form-group">
        <label>Role *</label>
        <select value={role} onChange={e => setRole(e.target.value)}>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
    </Modal>
  )
}
