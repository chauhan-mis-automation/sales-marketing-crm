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

export default function AddUserModal({ onClose, onSaved }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!username.trim() || !password.trim() || !name.trim() || !role) {
      alert('Please fill all required fields (username, password, name, role)')
      return
    }

    setSaving(true)
    try {
      const cleanUsername = username.trim().toLowerCase()

      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle()

      if (existing) {
        alert('Username already exists.')
        setSaving(false)
        return
      }

      const { error } = await supabase.from('users').insert({
        username: cleanUsername,
        password: password.trim(),
        name: name.trim(),
        role,
        email: email.trim() || null,
        active: true
      })
      if (error) throw error

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
      title="👤 Add New User"
      onClose={onClose}
      width="440px"
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Adding…' : 'Add User'}
          </button>
        </>
      }
    >
      <div className="modal-grid-2">
        <div className="modal-form-group">
          <label>Username *</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. rahul.s" />
        </div>
        <div className="modal-form-group">
          <label>Password *</label>
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
        </div>
      </div>

      <div className="modal-form-group">
        <label>Full Name *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
      </div>

      <div className="modal-form-group">
        <label>Role *</label>
        <select value={role} onChange={e => setRole(e.target.value)}>
          <option value="">Select Role</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div className="modal-form-group">
        <label>Email (optional)</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com" />
      </div>

      <div className="modal-info-banner">
        <i className="fas fa-info-circle"></i>
        <span><strong>frontend</strong> role = Frontend salesperson; sees only their own enquiries. <strong>design</strong> role = Designer; sees only tasks assigned to them.</span>
      </div>
    </Modal>
  )
}
