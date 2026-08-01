import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Modal from './Modal'

export default function EditSMUserModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user.name || '')
  const [email, setEmail] = useState(user.email || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      alert('Name, Email and Phone are required')
      return
    }

    setSaving(true)
    try {
      const payload = { name: name.trim(), email: email.trim(), phone: phone.trim() }
      if (password.trim()) payload.password = password.trim()

      const { error } = await supabase.from('sm_users').update(payload).eq('user_id', user.user_id)
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
      title="✏️ Edit Team Member"
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>Full Name *</label>
        <input value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="modal-form-group">
        <label>Email *</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="modal-form-group">
        <label>Phone *</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} />
      </div>
      <div className="modal-form-group">
        <label>New Password <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(leave blank to keep current)</span></label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter new password or leave blank" />
      </div>
    </Modal>
  )
}
