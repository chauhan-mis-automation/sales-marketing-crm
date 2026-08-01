import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDropdownData } from '../lib/useDropdownData'
import { fetchCountries, fetchStates, fetchCities } from '../lib/locationApi'
import { useAuth } from '../context/AuthContext'
import { sanitizeFileName } from '../lib/fileHelpers'
import SearchableSelect from './SearchableSelect'
import '../pages/NewEnquiry.css'
import { COUNTRY_CODES } from '../lib/countryCodes'
import './EditEnquiryModal.css'


export default function EditEnquiryModal({ enquiry, onClose, onSaved }) {
  const { user } = useAuth()
  const { customerCategory, enquirySource, products, frontendTeam, backendTeam, loading: dropdownsLoading } = useDropdownData()

  const [countries, setCountries] = useState([])
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [statesLoading, setStatesLoading] = useState(false)
  const [citiesLoading, setCitiesLoading] = useState(false)

  const existingCC = (enquiry.cc_emails || '').split(',').map(e => e.trim()).filter(Boolean)

  const [form, setForm] = useState({
    companyName: enquiry.company_name || '',
    contactName: enquiry.contact_name || '',
    email: enquiry.email || '',
    countryCode: enquiry.country_code || '+91',
    phone: enquiry.phone || '',
    country: enquiry.country || 'India',
    state: enquiry.state || '',
    city: enquiry.city || '',
    customerCategory: enquiry.customer_category || '',
    consultantMake: enquiry.consultant_make || '',
    approvedMakes: enquiry.approved_makes || '',
    source: enquiry.source || '',
    projectName: enquiry.project_name || '',
    assignedFrontend: enquiry.assign_to_frontend || '',
    assignedBackend: enquiry.assign_to_backend || '',
    cc1: existingCC[0] || '', cc2: existingCC[1] || '', cc3: existingCC[2] || '',
    cc4: existingCC[3] || '', cc5: existingCC[4] || '', cc6: existingCC[5] || '',
  })

  const [selectedProducts, setSelectedProducts] = useState(
    (enquiry.products || '').split(',').map(p => p.trim()).filter(Boolean)
  )

  const existingFileUrls = (enquiry.attachment_url || '').split(',').map(u => u.trim()).filter(Boolean)
  const [removedExisting, setRemovedExisting] = useState([])
  const keptExistingUrls = existingFileUrls.filter(u => !removedExisting.includes(u))
  const [newFiles, setNewFiles] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCountries().then(setCountries)
  }, [])

  // On mount, load the states/cities lists for the ALREADY-SAVED country/state — this
  // must not touch form.state/form.city, and must be safe if React StrictMode
  // double-invokes it in dev (which is why the old "first run" ref-flag approach broke).
  useEffect(() => {
    if (enquiry.country) {
      setStatesLoading(true)
      fetchStates(enquiry.country).then(setStates).finally(() => setStatesLoading(false))
    }
    if (enquiry.country && enquiry.state) {
      setCitiesLoading(true)
      fetchCities(enquiry.country, enquiry.state).then(setCities).finally(() => setCitiesLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Explicit user-driven handlers — only these reset the downstream dropdowns,
  // so loading the existing saved values never gets wiped out.
  function handleCountryChange(v) {
    updateField('country', v)
    setForm(f => ({ ...f, state: '', city: '' }))
    setStates([])
    setCities([])
    if (v) {
      setStatesLoading(true)
      fetchStates(v).then(setStates).finally(() => setStatesLoading(false))
    }
  }

  function handleStateChange(v) {
    updateField('state', v)
    setForm(f => ({ ...f, city: '' }))
    setCities([])
    if (v) {
      setCitiesLoading(true)
      fetchCities(form.country, v).then(setCities).finally(() => setCitiesLoading(false))
    }
  }

  function updateField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleProduct(product) {
    setSelectedProducts(prev =>
      prev.includes(product) ? prev.filter(p => p !== product) : [...prev, product]
    )
  }

  function handleFileSelect(e) {
    const picked = Array.from(e.target.files || [])
    if (picked.length === 0) return
    setNewFiles(prev => [...prev, ...picked])
    e.target.value = ''
  }

  function removeNewFile(idx) {
    setNewFiles(prev => prev.filter((_, i) => i !== idx))
  }

  function removeExistingFile(url) {
    setRemovedExisting(prev => [...prev, url])
  }

  async function handleSave() {
    if (!form.companyName.trim()) { alert('Company name is required'); return }
    if (!form.contactName.trim()) { alert('Contact name is required'); return }
    if (!form.phone.trim()) { alert('Mobile number is required'); return }
    if (!form.assignedFrontend) { alert('Assign To Frontend is required'); return }

    setSaving(true)
    try {
      let newFileUrls = []
      for (const file of newFiles) {
        const filePath = `${Date.now()}_${sanitizeFileName(file.name)}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('enquiry-attachments')
          .upload(filePath, file)
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('enquiry-attachments').getPublicUrl(filePath)
          newFileUrls.push(urlData.publicUrl)
        }
      }
      const allFileUrls = [...keptExistingUrls, ...newFileUrls]

      const location = [form.city, form.state, form.country].filter(Boolean).join(', ')
      const ccEmails = [form.cc1, form.cc2, form.cc3, form.cc4, form.cc5, form.cc6]
        .filter(e => e.trim()).join(', ')

      const { error } = await supabase
        .from('enquiries')
        .update({
          contact_name: form.contactName,
          company_name: form.companyName,
          email: form.email,
          phone: form.phone,
          country_code: form.countryCode,
          source: form.source,
          assign_to_frontend: form.assignedFrontend,
          assign_to_backend: form.assignedBackend,
          customer_category: form.customerCategory,
          location,
          city: form.city,
          state: form.state,
          country: form.country,
          project_name: form.projectName,
          products: selectedProducts.join(', '),
          cc_emails: ccEmails,
          consultant_make: form.consultantMake,
          approved_makes: form.approvedMakes,
          attachment_url: allFileUrls.join(', '),
        })
        .eq('enquiry_id', enquiry.enquiry_id)

      if (error) throw error

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: 'Enquiry Details Updated',
        remarks: `Enquiry details edited by ${user?.name || ''}`,
        logged_by: user?.name || ''
      })

      onSaved()
      onClose()
    } catch (err) {
      alert('Error updating enquiry: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="eem-overlay" onClick={onClose}>
      <div className="eem-modal" onClick={e => e.stopPropagation()}>
        <div className="eem-header">
          <span><i className="fas fa-pencil-alt"></i> Edit Enquiry</span>
          <button className="eem-close-btn" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        <div className="eem-body">
          <div className="ne-section-title">Customer Information</div>
          <div className="ne-grid">
            <div className="ne-field">
              <label>Company Name *</label>
              <input value={form.companyName} onChange={e => updateField('companyName', e.target.value)} placeholder="Company / Organisation" />
            </div>
            <div className="ne-field">
              <label>Contact Name *</label>
              <input value={form.contactName} onChange={e => updateField('contactName', e.target.value)} placeholder="Full name" />
            </div>
            <div className="ne-field">
              <label>Customer E-mail ID</label>
              <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="client@email.com" />
            </div>
            <div className="ne-field">
              <label>Mobile No. *</label>
              <div className="ne-phone-row">
                <select value={form.countryCode} onChange={e => updateField('countryCode', e.target.value)}>
                  {COUNTRY_CODES.map(c => <option key={c.code + c.name} value={c.code}>{c.code} {c.name}</option>)}
                </select>
                <input value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="Enter mobile number" />
              </div>
            </div>

            <div className="ne-field">
              <label>Country</label>
              <SearchableSelect
                value={form.country}
                onChange={handleCountryChange}
                options={countries}
                placeholder="Type or select country"
              />
            </div>
            <div className="ne-field">
              <label>State</label>
              <SearchableSelect
                value={form.state}
                onChange={handleStateChange}
                options={states}
                loading={statesLoading}
                disabled={!form.country}
                placeholder={form.country ? 'Type or select state' : 'Select country first'}
              />
            </div>
            <div className="ne-field">
              <label>City</label>
              <SearchableSelect
                value={form.city}
                onChange={v => updateField('city', v)}
                options={cities}
                loading={citiesLoading}
                disabled={!form.state}
                placeholder={form.state ? 'Type or select city' : 'Select state first'}
              />
            </div>

            <div className="ne-field">
              <label>Customer Category</label>
              <SearchableSelect
                value={form.customerCategory}
                onChange={v => updateField('customerCategory', v)}
                options={customerCategory}
                loading={dropdownsLoading}
                placeholder="Select category"
              />
            </div>
            <div className="ne-field">
              <label>Consultant Make</label>
              <input value={form.consultantMake} onChange={e => updateField('consultantMake', e.target.value)} placeholder="Consultant make" />
            </div>
          </div>

          <div className="ne-field full">
            <label>Approved Makes</label>
            <input value={form.approvedMakes} onChange={e => updateField('approvedMakes', e.target.value)} placeholder="Type makes separated by comma" />
            <div className="ne-helper">Example: Carrier, Blue Star, Voltas — duplicates auto removed while saving.</div>
          </div>

          <div className="ne-section-title">Enquiry Details</div>
          <div className="ne-grid">
            <div className="ne-field">
              <label>Enquiry Source</label>
              <SearchableSelect
                value={form.source}
                onChange={v => updateField('source', v)}
                options={enquirySource}
                loading={dropdownsLoading}
                placeholder="Select source"
              />
            </div>
            <div className="ne-field">
              <label>Project Name</label>
              <input value={form.projectName} onChange={e => updateField('projectName', e.target.value)} placeholder="Project name" />
            </div>
          </div>

          <div className="ne-field full">
            <label>Enquiry Details / Products</label>
            <div className="ne-products-grid">
              {dropdownsLoading ? (
                <span style={{ fontSize: 12, color: 'var(--muted2)' }}>Loading options…</span>
              ) : products.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--muted2)' }}>No products configured in Dropdown list.</span>
              ) : (
                products.map(p => (
                  <label key={p} className={`ne-product-chip ${selectedProducts.includes(p) ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(p)}
                      onChange={() => toggleProduct(p)}
                    />
                    {p}
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="ne-field full">
            <label>Attachments</label>
            {keptExistingUrls.length > 0 && (
              <div className="modal-file-tags" style={{ marginBottom: 8 }}>
                {keptExistingUrls.map((url, i) => (
                  <div key={i} className="modal-file-tag" style={{ background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'rgba(45,122,71,.25)' }}>
                    <a href={url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                      <i className="fas fa-file"></i> File {i + 1}
                    </a>
                    <button type="button" onClick={() => removeExistingFile(url)}>×</button>
                  </div>
                ))}
              </div>
            )}
            <label className="ne-file-btn">
              <i className="fas fa-paperclip"></i> Add Attachment(s)
              <input type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
            </label>
            {newFiles.length > 0 && (
              <div className="ne-file-tags">
                {newFiles.map((f, i) => (
                  <div key={i} className="ne-file-tag">
                    <span>{f.name}</span>
                    <button type="button" onClick={() => removeNewFile(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ne-section-title">CC Email IDs (optional)</div>
          <div className="ne-grid">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div className="ne-field" key={n}>
                <label>CC Email {n}</label>
                <input
                  type="email"
                  value={form[`cc${n}`]}
                  onChange={e => updateField(`cc${n}`, e.target.value)}
                  placeholder={`cc${n}@email.com`}
                />
              </div>
            ))}
          </div>

          <div className="ne-section-title">Assignment</div>
          <div className="ne-grid">
            <div className="ne-field">
              <label>Assign To Frontend *</label>
              <SearchableSelect
                value={form.assignedFrontend}
                onChange={v => updateField('assignedFrontend', v)}
                options={frontendTeam}
                loading={dropdownsLoading}
                placeholder="Select"
              />
            </div>
            <div className="ne-field">
              <label>Assign To Backend</label>
              <SearchableSelect
                value={form.assignedBackend}
                onChange={v => updateField('assignedBackend', v)}
                options={backendTeam}
                loading={dropdownsLoading}
                placeholder="Select"
              />
            </div>
          </div>
        </div>

        <div className="eem-footer">
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}