import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useDropdownData } from '../lib/useDropdownData'
import { fetchCountries, fetchStates, fetchCities } from '../lib/locationApi'
import { useAuth } from '../context/AuthContext'
import SearchableSelect from '../components/SearchableSelect'
import { COUNTRY_CODES } from '../lib/countryCodes'
import './NewEnquiry.css'

export default function NewEnquiry() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { customerCategory, enquirySource, products, frontendTeam, backendTeam, loading: dropdownsLoading } = useDropdownData()

  // Sirf Follow-up team (+ admin/superadmin) hi assignment kar sakti hai — Frontend/Backend
  // jab khud enquiry create karte hain to unhe Assign fields dikhte hi nahi, Follow-up team
  // ko notify kiya jaata hai taaki wo Enquiry Detail ke "Assign Team" button se assign kare.
  const canAssign = ['followup', 'admin', 'superadmin'].includes(user?.role)

  const [countries, setCountries] = useState([])
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [statesLoading, setStatesLoading] = useState(false)
  const [citiesLoading, setCitiesLoading] = useState(false)

  const [form, setForm] = useState({
    companyName: '', contactName: '', email: '', countryCode: '+91', phone: '',
    country: 'India', state: '', city: '',
    customerCategory: '', consultantMake: '', approvedMakes: '',
    source: '', projectName: '',
    assignedFrontend: '', assignedBackend: '',
    cc1: '', cc2: '', cc3: '', cc4: '', cc5: '', cc6: ''
  })

  const [selectedProducts, setSelectedProducts] = useState([])
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCountries().then(setCountries)
  }, [])

  useEffect(() => {
    if (!form.country) return
    setForm(f => ({ ...f, state: '', city: '' }))
    setStates([])
    setCities([])
    setStatesLoading(true)
    fetchStates(form.country)
      .then(setStates)
      .finally(() => setStatesLoading(false))
  }, [form.country])

  useEffect(() => {
    if (!form.state) return
    setForm(f => ({ ...f, city: '' }))
    setCities([])
    setCitiesLoading(true)
    fetchCities(form.country, form.state)
      .then(setCities)
      .finally(() => setCitiesLoading(false))
  }, [form.state])

  function updateField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleProduct(product) {
    setSelectedProducts(prev =>
      prev.includes(product) ? prev.filter(p => p !== product) : [...prev, product]
    )
  }

  function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function generateEnquiryId() {
    // Settings table se counter uthao — abhi simple timestamp based ID (baad mein counter table bana sakte hain)
    const { count } = await supabase.from('enquiries').select('*', { count: 'exact', head: true })
    const nextNum = 282000 + (count || 0) + 1
    return `CAS-${nextNum}`
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.companyName.trim()) { alert('Company name is required'); return }
    if (!form.contactName.trim()) { alert('Contact name is required'); return }
    if (!form.phone.trim()) { alert('Mobile number is required'); return }
    if (canAssign && !form.assignedFrontend) { alert('Assign To Frontend is required'); return }

    setSaving(true)

    try {
      // Files upload karo Supabase Storage mein
      let attachmentUrls = []
      for (const file of files) {
        const filePath = `${Date.now()}_${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('enquiry-attachments')
          .upload(filePath, file)

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('enquiry-attachments')
            .getPublicUrl(filePath)
          attachmentUrls.push(urlData.publicUrl)
        }
      }

      const enquiryId = await generateEnquiryId()
      const location = [form.city, form.state, form.country].filter(Boolean).join(', ')
      const ccEmails = [form.cc1, form.cc2, form.cc3, form.cc4, form.cc5, form.cc6]
        .filter(e => e.trim()).join(', ')

      const { error } = await supabase.from('enquiries').insert({
        enquiry_id: enquiryId,
        contact_name: form.contactName,
        company_name: form.companyName,
        email: form.email,
        phone: form.phone,
        country_code: form.countryCode,
        source: form.source,
        assign_to_frontend: canAssign ? form.assignedFrontend : null,
        assign_to_backend: canAssign ? form.assignedBackend : null,
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
        created_by: user?.name || '',
        attachment_url: attachmentUrls.join(', '),
        current_stage: 'Assigned',
        status: 'Active'
      })

      if (error) throw error

      // Stage log entries (Received + Assigned) — GAS ke addEnquiry() jaisa hi
      await supabase.from('stage_logs').insert([
        {
          log_id: `LOG-${Date.now()}`,
          enquiry_id: enquiryId,
          stage_name: 'Received',
          remarks: 'Enquiry received in system',
          logged_by: user?.name || ''
        },
        {
          log_id: `LOG-${Date.now() + 1}`,
          enquiry_id: enquiryId,
          stage_name: 'Assigned',
          remarks: canAssign
            ? `Enquiry created & assigned | Frontend: ${form.assignedFrontend || '—'} | Backend: ${form.assignedBackend || '—'}`
            : `Enquiry created by ${user?.name || ''} — awaiting Frontend/Backend assignment by Follow-up team`,
          logged_by: user?.name || ''
        }
      ])

      // Notifications bhejo — agar creator khud assign kar chuka hai to naye assignees ko,
      // warna Follow-up team (+ admin/superadmin) ko batao ki assignment abhi baaki hai.
      if (canAssign) {
        const notifRecipients = []
        if (form.assignedFrontend) notifRecipients.push({ name: form.assignedFrontend, role: 'Frontend' })
        if (form.assignedBackend) notifRecipients.push({ name: form.assignedBackend, role: 'Backend' })

        if (notifRecipients.length > 0) {
          await supabase.from('notifications').insert(
            notifRecipients.map(r => ({
            recipient_name: r.name,
            enquiry_id: enquiryId,
            title: '🎯 New Enquiry Assigned',
            message: `New Enquiry Assigned: Enquiry ${enquiryId} assigned to you as ${r.role}. Client: ${form.companyName}.`,
          type: 'assignment'
        }))
        )
        }
      } else {
        const { data: followupUsers } = await supabase
          .from('users')
          .select('name')
          .in('role', ['followup', 'admin', 'superadmin'])
          .eq('active', true)

        if (followupUsers && followupUsers.length > 0) {
          await supabase.from('notifications').insert(
            followupUsers.map(u => ({
              recipient_name: u.name,
              enquiry_id: enquiryId,
              title: '📥 New Enquiry Needs Assignment',
              message: `${user?.name || 'A team member'} created Enquiry ${enquiryId} (${form.companyName}). Please assign Frontend/Backend from the Enquiry Detail page.`,
              type: 'assignment'
            }))
          )
        }
      }

      alert(`Enquiry ${enquiryId} created successfully!`)
      navigate('/enquiries')
    } catch (err) {
      alert('Error saving enquiry: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ne-card">
      <div className="ne-card-header">➕ Add New Enquiry</div>
      <div className="ne-card-body">
        <form onSubmit={handleSubmit}>

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
                onChange={v => updateField('country', v)}
                options={countries}
                placeholder="Type or select country"
              />
            </div>
            <div className="ne-field">
              <label>State</label>
              <SearchableSelect
                value={form.state}
                onChange={v => updateField('state', v)}
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
            <label>Attachments (optional, multiple files)</label>
            <label className="ne-file-btn">
              <i className="fas fa-paperclip"></i> Add Attachment(s)
              <input type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
            </label>
            {files.length > 0 && (
              <div className="ne-file-tags">
                {files.map((f, i) => (
                  <div key={i} className="ne-file-tag">
                    <span>{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="ne-helper">You can select multiple files (PDF, images, documents).</div>
          </div>

          <div className="ne-section-title">CC Email IDs (optional)</div>
          <div className="ne-grid">
            {[1,2,3,4,5,6].map(n => (
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

          {canAssign ? (
            <>
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
            </>
          ) : (
            <div className="ne-assign-note">
              <i className="fas fa-info-circle"></i> Frontend/Backend assignment is done by the Follow-up team. They'll be notified as soon as you save this enquiry.
            </div>
          )}

          <div className="ne-footer">
            <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>
              <i className="fas fa-times"></i> Clear
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Save Enquiry'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}