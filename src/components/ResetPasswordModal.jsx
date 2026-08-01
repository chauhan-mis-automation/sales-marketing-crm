import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Modal from './Modal'

export default function ResetPasswordModal({ targetUser, onClose, onSaved }) {
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!newPassword.trim()) {
      alert('Enter a new password')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ password: newPassword.trim() })
        .eq('id', targetUser.id)

      if (error) throw error

      onSaved()
      onClose()
    } catch (err) {
      alert('Error resetting password: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="🔑 Reset Password"
      onClose={onClose}
      width="380px"
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-danger" onClick={handleSave} disabled={saving}>
            <i className="fas fa-key"></i> {saving ? 'Resetting…' : 'Reset Password'}
          </button>
        </>
      }
    >
      <p className="modal-helper" style={{ marginTop: 0 }}>
        Reset password for: <strong>{targetUser.username}</strong>
      </p>

      <div className="modal-form-group">
        <label>New Password *</label>
        <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" />
      </div>
    </Modal>
  )
}
