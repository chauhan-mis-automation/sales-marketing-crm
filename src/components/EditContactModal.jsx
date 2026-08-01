import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSMAuth } from '../context/SMAuthContext'
import { useSMDropdownData } from '../lib/useSMDropdownData'
import { fetchStates, fetchCities } from '../lib/locationApi'
import AddDropdownOptionModal from './AddDropdownOptionModal'
import SearchableSelect from './SearchableSelect'
import Modal from './Modal'
import './AddContactModal.css'

export default function EditContactModal({ lead, onClose, onSaved }) {
  const { smUser } = useSMAuth()
  const dropdowns = useSMDropdownData()
  const { source, businessVolume, industry, category, rating, region, loading: dropdownsLoading } = dropdowns
  const isAdmin = smUser?.role === 'Admin'

  const [form, setForm] = useState({
    name: lead.name || '',
    phone: lead.phone || '',
    alternatePhone: lead.alternate_phone || '',
    email: lead.email || '',
    company: lead.company || '',
    designation: lead.designation || '',
    source: lead.source || '',
    businessVolume: lead.business_volume || '',
    industry: lead.industry || '',
    category: lead.category || '',
    rating: lead.rating || '',
    region: lead.region || '',
    address: lead.address || '',
    state: lead.state || '',
    city: lead.city || '',
    notes: lead.notes || '',
    status: lead.status || 'New',
  })

  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [statesLoading, setStatesLoading] = useState(false)
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [addOptionFor, setAddOptionFor] = useState(null)
  const [saving, setSaving] = useState(false)

  function updateField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function ensureStatesLoaded() {
    if (states.length > 0 || statesLoading) return
    setStatesLoading(true)
    try {
      const list = await fetchStates('India')
      setStates(list)
    } finally {
      setStatesLoading(false)
    }
  }

  function handleStateChange(v) {
    updateField('state', v)
    updateField('city', '')
    setCities([])
    if (v) {
      setCitiesLoading(true)
      fetchCities('India', v).then(setCities).finally(() => setCitiesLoading(false))
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Full Name is required'); return }
    if (!form.phone.trim()) { alert('Phone/Mobile is required'); return }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('sm_leads')
        .update({
          name: form.name.trim(),
          phone: form.phone.trim(),
          alternate_phone: form.alternatePhone.trim(),
          email: form.email.trim(),
          company: form.company.trim(),
          designation: form.designation.trim(),
          source: form.source,
          business_volume: form.businessVolume,
          industry: form.industry,
          category: form.category,
          rating: form.rating,
          region: form.region,
          address: form.address.trim(),
          state: form.state,
          city: form.city,
          notes: form.notes.trim(),
          status: form.status,
          updated_date: new Date().toISOString(),
        })
        .eq('id', lead.id)

      if (error) throw error

      onSaved()
      onClose()
    } catch (err) {
      alert('Error updating contact: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function DropdownWithAdd({ label, categoryKey, categoryLabel, value, onChange, options }) {
    return (
      <div className="modal-form-group">
        <label>{label}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SearchableSelect value={value} onChange={onChange} options={options} loading={dropdownsLoading} placeholder={`-- Select ${label} --`} />
          </div>
          {isAdmin && (
            <button type="button" className="acm-add-opt-btn" title={`Add new ${label} option`} onClick={() => setAddOptionFor({ category: categoryKey, label: categoryLabel })}>
              <i className="fas fa-plus"></i>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Modal
      title={`✏️ Edit Contact — ${lead.name}`}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Full Name *</label>
          <input value={form.name} onChange={e => updateField('name', e.target.value)} />
        </div>
        <div className="modal-form-group">
          <label>Phone/Mobile *</label>
          <input value={form.phone} onChange={e => updateField('phone', e.target.value)} />
        </div>
      </div>

      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Alternate Phone</label>
          <input value={form.alternatePhone} onChange={e => updateField('alternatePhone', e.target.value)} />
        </div>
        <div className="modal-form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} />
        </div>
      </div>

      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Company</label>
          <input value={form.company} onChange={e => updateField('company', e.target.value)} />
        </div>
        <div className="modal-form-group">
          <label>Designation</label>
          <input value={form.designation} onChange={e => updateField('designation', e.target.value)} />
        </div>
      </div>

      <div className="modal-form-row">
        <DropdownWithAdd label="Source" categoryKey="Source" categoryLabel="Source" value={form.source} onChange={v => updateField('source', v)} options={source} />
        <DropdownWithAdd label="Business Volume" categoryKey="BusinessVolume" categoryLabel="Business Volume" value={form.businessVolume} onChange={v => updateField('businessVolume', v)} options={businessVolume} />
      </div>

      <div className="modal-form-row">
        <DropdownWithAdd label="Industry" categoryKey="Industry" categoryLabel="Industry" value={form.industry} onChange={v => updateField('industry', v)} options={industry} />
        <DropdownWithAdd label="Category" categoryKey="Category" categoryLabel="Category" value={form.category} onChange={v => updateField('category', v)} options={category} />
      </div>

      <div className="modal-form-row">
        <DropdownWithAdd label="Business Rating" categoryKey="Rating" categoryLabel="Rating" value={form.rating} onChange={v => updateField('rating', v)} options={rating} />
        <DropdownWithAdd label="Region" categoryKey="Region" categoryLabel="Region" value={form.region} onChange={v => updateField('region', v)} options={region} />
      </div>

      <div className="modal-form-group">
        <label>Address</label>
        <input value={form.address} onChange={e => updateField('address', e.target.value)} />
      </div>

      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>State</label>
          <div onFocus={ensureStatesLoaded} onClick={ensureStatesLoaded}>
            <SearchableSelect value={form.state} onChange={handleStateChange} options={states} loading={statesLoading} placeholder="Type to search state…" />
          </div>
        </div>
        <div className="modal-form-group">
          <label>City</label>
          <SearchableSelect value={form.city} onChange={v => updateField('city', v)} options={cities} loading={citiesLoading} disabled={!form.state} placeholder={form.state ? 'Type to search city…' : 'Select state first…'} />
        </div>
      </div>

      <div className="modal-form-group">
        <label>Status</label>
        <select value={form.status} onChange={e => updateField('status', e.target.value)}>
          {['New', 'Assigned', 'Contacted', 'Interested', 'Follow-up', 'Closed', 'Lost'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="modal-form-group">
        <label>Notes</label>
        <textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} />
      </div>

      {addOptionFor && (
        <AddDropdownOptionModal
          category={addOptionFor.category}
          label={addOptionFor.label}
          onClose={() => setAddOptionFor(null)}
          onSaved={dropdowns.refetch}
        />
      )}
    </Modal>
  )
}
