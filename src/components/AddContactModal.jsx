import { useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSMAuth } from '../context/SMAuthContext'
import { useSMDropdownData } from '../lib/useSMDropdownData'
import { fetchStates, fetchCities } from '../lib/locationApi'
import { sanitizeFileName } from '../lib/fileHelpers'
import { parseCardText } from '../lib/parseCardText'
import { COUNTRY_CODES } from '../lib/countryCodes'
import { logActivity } from '../lib/activityLog'
import SearchableSelect from './SearchableSelect'
import AddDropdownOptionModal from './AddDropdownOptionModal'
import CameraCaptureModal from './CameraCaptureModal'
import ScheduleFollowUpModal from './ScheduleFollowUpModal'
import Modal from './Modal'
import './AddContactModal.css'

const DEFAULT_CC = '+91'

export default function AddContactModal({ onClose, onSaved }) {
  const { smUser } = useSMAuth()
  const dropdowns = useSMDropdownData()
  const { source, businessVolume, industry, category, rating, region, loading: dropdownsLoading } = dropdowns

  const isAdmin = smUser?.role === 'Admin'
  const canAssign = smUser?.role === 'Admin' || smUser?.role === 'BackOffice'

  const [form, setForm] = useState({
    name: '', countryCode: DEFAULT_CC, phone: '',
    altCountryCode: DEFAULT_CC, alternatePhone: '',
    email: '', company: '', designation: '',
    source: '', businessVolume: '', industry: '', category: '',
    rating: '', region: '', address: '', state: '', city: '',
    notes: '', assignedTo: '',
  })

  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [statesLoading, setStatesLoading] = useState(false)
  const [citiesLoading, setCitiesLoading] = useState(false)

  const [cardFile, setCardFile] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const uploadInputRef = useRef(null)
  const attachInputRef = useRef(null)

  const [addOptionFor, setAddOptionFor] = useState(null) // { category, label }
  const [showCamera, setShowCamera] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [newlySavedLead, setNewlySavedLead] = useState(null)
  const [saving, setSaving] = useState(false)

  function updateField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
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

  // Load states once, lazily, on first focus of the State field
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

  // ── Smart Scan (OCR) ────────────────────────────────────
  async function handleScanFile(file) {
    if (!file) return
    setCardFile(file)
    setScanning(true)
    setScanProgress(0)
    try {
      const Tesseract = await import('tesseract.js')
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') setScanProgress(Math.round(m.progress * 100))
        },
      })
      const parsed = parseCardText(data.text || '')
      setForm(f => ({
        ...f,
        name: parsed.name || f.name,
        phone: parsed.phone || f.phone,
        email: parsed.email || f.email,
        company: parsed.company || f.company,
        designation: parsed.designation || f.designation,
      }))
    } catch (err) {
      alert('Could not scan the card automatically — please fill details manually. (' + err.message + ')')
    } finally {
      setScanning(false)
    }
  }

  function handleAttachFile(e) {
    const file = e.target.files?.[0]
    if (file) setCardFile(file)
    e.target.value = ''
  }

  async function handleSave(planMeeting = false) {
    if (!form.name.trim()) { alert('Full Name is required'); return }
    if (!form.phone.trim()) { alert('Phone/Mobile is required'); return }
    if (!form.email.trim()) { alert('Email is required'); return }
    if (!form.company.trim()) { alert('Company is required'); return }
    if (!form.designation.trim()) { alert('Designation is required'); return }
    if (!form.source) { alert('Source is required'); return }
    if (!form.businessVolume) { alert('Business Volume is required'); return }
    if (!form.industry) { alert('Industry is required'); return }
    if (!form.category) { alert('Category is required'); return }
    if (!form.rating) { alert('Business Rating is required'); return }
    if (!form.region) { alert('Region is required'); return }
    if (!form.address.trim()) { alert('Address is required'); return }
    if (!form.state) { alert('State is required'); return }
    if (!form.city) { alert('City is required'); return }
    if (!form.notes.trim()) { alert('Notes is required'); return }

    setSaving(true)
    try {
      let cardImageUrl = ''
      if (cardFile) {
        const filePath = `sm-cards/${Date.now()}_${sanitizeFileName(cardFile.name)}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('enquiry-attachments')
          .upload(filePath, cardFile)
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('enquiry-attachments').getPublicUrl(filePath)
          cardImageUrl = urlData.publicUrl
        }
      }

      const leadId = `LEAD-${Date.now()}`

      let assignedTo = ''
      let status = 'New'
      if (!canAssign) {
        assignedTo = smUser?.name || ''
        status = 'Assigned'
      }

      const { error } = await supabase.from('sm_leads').insert({
        lead_id: leadId,
        name: form.name.trim(),
        phone: `${form.countryCode} ${form.phone.trim()}`,
        alternate_phone: form.alternatePhone.trim() ? `${form.altCountryCode} ${form.alternatePhone.trim()}` : '',
        email: form.email.trim(),
        company: form.company.trim(),
        designation: form.designation.trim(),
        address: form.address.trim(),
        city: form.city,
        state: form.state,
        source: form.source,
        business_volume: form.businessVolume,
        card_image_url: cardImageUrl,
        status,
        assigned_to: assignedTo,
        created_by: smUser?.name || '',
        created_by_id: smUser?.userId || '',
        priority: 'Medium',
        notes: form.notes.trim(),
        industry: form.industry,
        category: form.category,
        rating: form.rating,
        region: form.region,
      })

      if (error) throw error

      logActivity({
        userId: smUser?.userId, userName: smUser?.name, role: smUser?.role,
        leadId, leadName: form.name.trim(),
        action: 'ADD_LEAD', module: 'Leads',
        details: `New contact added: ${form.phone.trim()}${!canAssign ? ' (auto-assigned to self)' : ''}`,
      })

      onSaved()

      if (planMeeting) {
        setNewlySavedLead({ leadId, leadName: form.name.trim() })
        setShowSchedule(true)
      } else {
        onClose()
      }
    } catch (err) {
      alert('Error adding contact: ' + err.message)
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
            <button
              type="button"
              className="acm-add-opt-btn"
              title={`Add new ${label} option`}
              onClick={() => setAddOptionFor({ category: categoryKey, label: categoryLabel })}
            >
              <i className="fas fa-plus"></i>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Modal
      title="👤 Add New Contact"
      onClose={onClose}
      width={720}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-ghost" onClick={() => handleSave(true)} disabled={saving || scanning}>
            <i className="fas fa-calendar-plus"></i> {saving ? 'Saving…' : 'Plan Meeting'}
          </button>
          <button className="btn-modal-primary" onClick={() => handleSave(false)} disabled={saving || scanning}>
            <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Save Contact'}
          </button>
        </>
      }
    >
      {/* ── Smart Scan ─────────────────────────────────────── */}
      <div className="acm-scan-box">
        <div>
          <div className="acm-scan-title"><i className="fas fa-magic"></i> Smart Scan</div>
          <div className="acm-scan-sub">Upload a card or scan with camera to auto-fill details.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="acm-scan-btn dark" onClick={() => setShowCamera(true)} disabled={scanning}>
            <i className="fas fa-camera"></i> Open Camera
          </button>
          <button type="button" className="acm-scan-btn" onClick={() => uploadInputRef.current?.click()} disabled={scanning}>
            <i className="fas fa-upload"></i> Upload File
          </button>
        </div>
        <input ref={uploadInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleScanFile(e.target.files?.[0])} />
      </div>

      {scanning && (
        <div className="acm-scanning-note">
          <i className="fas fa-spinner fa-spin"></i> Scanning card… {scanProgress}%
        </div>
      )}
      {!scanning && cardFile && (
        <div className="acm-scanned-note">
          <i className="fas fa-check-circle"></i> Card attached: {cardFile.name} — please double-check the auto-filled fields below.
        </div>
      )}

      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Full Name *</label>
          <input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="John Doe" />
        </div>
        <div className="modal-form-group">
          <label>Phone/Mobile *</label>
          <div className="acm-phone-row">
            <select value={form.countryCode} onChange={e => updateField('countryCode', e.target.value)}>
              {COUNTRY_CODES.map(c => <option key={c.code + c.name} value={c.code}>{c.code}</option>)}
            </select>
            <input value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="9876543210" />
          </div>
        </div>
      </div>

      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Alternate Phone</label>
          <div className="acm-phone-row">
            <select value={form.altCountryCode} onChange={e => updateField('altCountryCode', e.target.value)}>
              {COUNTRY_CODES.map(c => <option key={c.code + c.name} value={c.code}>{c.code}</option>)}
            </select>
            <input value={form.alternatePhone} onChange={e => updateField('alternatePhone', e.target.value)} placeholder="Optional number" />
          </div>
        </div>
        <div className="modal-form-group">
          <label>Email *</label>
          <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="example@mail.com" />
        </div>
      </div>

      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Company *</label>
          <input value={form.company} onChange={e => updateField('company', e.target.value)} placeholder="Company name" />
        </div>
        <div className="modal-form-group">
          <label>Designation *</label>
          <input value={form.designation} onChange={e => updateField('designation', e.target.value)} placeholder="Job title" />
        </div>
      </div>

      <div className="modal-form-row">
        <DropdownWithAdd label="Source *" categoryKey="Source" categoryLabel="Source" value={form.source} onChange={v => updateField('source', v)} options={source} />
        <DropdownWithAdd label="Business Volume *" categoryKey="BusinessVolume" categoryLabel="Business Volume" value={form.businessVolume} onChange={v => updateField('businessVolume', v)} options={businessVolume} />
      </div>

      <div className="modal-form-row">
        <DropdownWithAdd label="Industry *" categoryKey="Industry" categoryLabel="Industry" value={form.industry} onChange={v => updateField('industry', v)} options={industry} />
        <DropdownWithAdd label="Category *" categoryKey="Category" categoryLabel="Category" value={form.category} onChange={v => updateField('category', v)} options={category} />
      </div>

      <div className="modal-form-row">
        <DropdownWithAdd label="Business Rating *" categoryKey="Rating" categoryLabel="Rating" value={form.rating} onChange={v => updateField('rating', v)} options={rating} />
        <DropdownWithAdd label="Region *" categoryKey="Region" categoryLabel="Region" value={form.region} onChange={v => updateField('region', v)} options={region} />
      </div>

      <div className="modal-form-group">
        <label>Address *</label>
        <input value={form.address} onChange={e => updateField('address', e.target.value)} placeholder="Street / area" />
      </div>

      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>State *</label>
          <div onFocus={ensureStatesLoaded} onClick={ensureStatesLoaded}>
            <SearchableSelect
              value={form.state}
              onChange={handleStateChange}
              options={states}
              loading={statesLoading}
              placeholder="Type to search state…"
            />
          </div>
        </div>
        <div className="modal-form-group">
          <label>City *</label>
          <SearchableSelect
            value={form.city}
            onChange={v => updateField('city', v)}
            options={cities}
            loading={citiesLoading}
            disabled={!form.state}
            placeholder={form.state ? 'Type to search city…' : 'Select state first…'}
          />
        </div>
      </div>

      <div className="modal-form-group">
        <label>Notes *</label>
        <textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} placeholder="Initial notes…" />
      </div>

      <div className="modal-form-group">
        <label><i className="fas fa-paperclip"></i> Attachment: Visiting Card (optional)</label>
        <div className="acm-attach-box" onClick={() => attachInputRef.current?.click()}>
          <i className="fas fa-camera"></i>
          <span>{cardFile ? cardFile.name : 'Upload File for Records'}</span>
        </div>
        <input ref={attachInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAttachFile} />
      </div>

      {addOptionFor && (
        <AddDropdownOptionModal
          category={addOptionFor.category}
          label={addOptionFor.label}
          onClose={() => setAddOptionFor(null)}
          onSaved={dropdowns.refetch}
        />
      )}

      {showCamera && (
        <CameraCaptureModal
          onCapture={file => { setShowCamera(false); handleScanFile(file) }}
          onClose={() => setShowCamera(false)}
        />
      )}

      <ScheduleFollowUpModal
        open={showSchedule}
        lead={newlySavedLead}
        currentUser={{ name: smUser?.name, userID: smUser?.userId }}
        onClose={() => { setShowSchedule(false); onClose() }}
        onScheduled={() => { setShowSchedule(false); onClose() }}
      />
    </Modal>
  )
}