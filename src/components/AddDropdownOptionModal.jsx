import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Modal from './Modal'

export default function AddDropdownOptionModal({ category, label, onClose, onSaved }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!value.trim()) { alert('Please enter a value'); return }

    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('sm_dropdown_options')
        .select('sort_order')
        .eq('category', category)
        .order('sort_order', { ascending: false })
        .limit(1)

      const nextOrder = (existing?.[0]?.sort_order || 0) + 1

      const { error } = await supabase.from('sm_dropdown_options').insert({
        category,
        value: value.trim(),
        sort_order: nextOrder,
      })

      if (error) throw error

      await onSaved()
      onClose()
    } catch (err) {
      alert('Error adding option: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`➕ Add ${label} Option`}
      onClose={onClose}
      width={420}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Add Option'}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>New {label} Value</label>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={`Type new ${label.toLowerCase()}…`}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        />
      </div>
    </Modal>
  )
}
