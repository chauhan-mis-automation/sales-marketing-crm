import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSMAuth } from '../context/SMAuthContext'
import { sanitizeFileName } from '../lib/fileHelpers'
import { logActivity } from '../lib/activityLog'
import Modal from './Modal'
import './ProjectFormModal.css'

const PRODUCT_OPTIONS = ['Dehumidifier', 'Others']

const STAGE_OPTIONS = [
  'Budgeting By Contractor',
  'Design Stage',
  'Tender Stage',
  'Bidding by Contractors',
  'Won by Consultant',
  'Won by Contractor',
  'Negotiation stage by us',
  'Won by us',
  'lost by us',
]

function emptyContact() {
  return { name: '', contact: '', mobile: '', email: '', designation: '' }
}

// One reusable "person card" used for both main contractors and
// the enquiry-contractor sub-list — mirrors the Apps Script contractor entry blocks.
function ContactEntryCard({ title, data, onChange, onRemove, showRemove }) {
  return (
    <div className="pfm-entry-card">
      <div className="pfm-entry-head">
        <span>{title}</span>
        {showRemove && (
          <button type="button" className="pfm-remove-btn" onClick={onRemove} title="Remove">
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>
      <div className="modal-form-group">
        <label>Contractor Name</label>
        <input value={data.name} onChange={e => onChange('name', e.target.value)} placeholder="Contractor company / firm name" />
      </div>
      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Contact Person</label>
          <input value={data.contact} onChange={e => onChange('contact', e.target.value)} placeholder="Contact person name" />
        </div>
        <div className="modal-form-group">
          <label>Mobile Number</label>
          <input value={data.mobile} onChange={e => onChange('mobile', e.target.value)} placeholder="Mobile number" />
        </div>
      </div>
      <div className="modal-form-row">
        <div className="modal-form-group" style={{ marginBottom: 0 }}>
          <label>Mail ID</label>
          <input type="email" value={data.email} onChange={e => onChange('email', e.target.value)} placeholder="Email address" />
        </div>
        <div className="modal-form-group" style={{ marginBottom: 0 }}>
          <label>Designation</label>
          <input value={data.designation} onChange={e => onChange('designation', e.target.value)} placeholder="Designation" />
        </div>
      </div>
    </div>
  )
}

/**
 * ProjectFormModal — used for BOTH "Add New Project" and "Edit Project".
 * Pass `project` (an existing sm_projects row) to edit; omit/pass null to create.
 */
export default function ProjectFormModal({ project, onClose, onSaved }) {
  const { smUser } = useSMAuth()
  const isEdit = !!project

  const [form, setForm] = useState({
    projectName: project?.project_name || '',
    consultantName: project?.consultant_name || '',
    consultantContactPerson: project?.consultant_contact_person || '',
    consultantMobile: project?.consultant_mobile || '',
    consultantEmail: project?.consultant_email || '',
    consultantDesignation: project?.consultant_designation || '',
    endClientName: project?.end_client_name || '',
    endClientContactPerson: project?.end_client_contact_person || '',
    endClientMobile: project?.end_client_mobile || '',
    endClientEmail: project?.end_client_email || '',
    requiredProduct: project?.required_product || '',
    projectStage: project?.project_stage || '',
    casilicaApproved: project?.casilica_approved || '',
    biddingContractorsList: project?.bidding_contractors_list || '',
    enquiryFromConsultant: project?.enquiry_from_consultant || '',
    enquiryFromContractor: project?.enquiry_from_contractor || '',
  })

  const [contractors, setContractors] = useState(
    project?.contractors?.length ? project.contractors : [emptyContact()]
  )
  const [enquiryContractors, setEnquiryContractors] = useState(
    project?.contractor_details?.length ? project.contractor_details : [emptyContact()]
  )

  const [makeListFile, setMakeListFile] = useState(null)
  const [biddingFile, setBiddingFile] = useState(null)
  const [saving, setSaving] = useState(false)

  function updateField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  // ── Main contractors list ──
  function updateContractor(idx, field, value) {
    setContractors(list => list.map((c, i) => (i === idx ? { ...c, [field]: value } : c)))
  }
  function addContractor() {
    setContractors(list => [...list, emptyContact()])
  }
  function removeContractor(idx) {
    setContractors(list => list.filter((_, i) => i !== idx))
  }

  // ── Enquiry (Won by Contractor) sub-list ──
  function updateEnquiryContractor(idx, field, value) {
    setEnquiryContractors(list => list.map((c, i) => (i === idx ? { ...c, [field]: value } : c)))
  }
  function addEnquiryContractor() {
    setEnquiryContractors(list => [...list, emptyContact()])
  }
  function removeEnquiryContractor(idx) {
    setEnquiryContractors(list => list.filter((_, i) => i !== idx))
  }

  function onStageChange(value) {
    setForm(f => ({
      ...f,
      projectStage: value,
      // reset stage-specific fields when the stage changes away from them
      casilicaApproved: value === 'Tender Stage' ? f.casilicaApproved : '',
      biddingContractorsList: value === 'Bidding by Contractors' ? f.biddingContractorsList : '',
      enquiryFromConsultant: value === 'Won by Consultant' ? f.enquiryFromConsultant : '',
      enquiryFromContractor: value === 'Won by Contractor' ? f.enquiryFromContractor : '',
    }))
  }

  async function uploadFile(file, prefix) {
    const filePath = `sm-projects/${prefix}_${Date.now()}_${sanitizeFileName(file.name)}`
    const { error } = await supabase.storage.from('enquiry-attachments').upload(filePath, file)
    if (error) throw error
    const { data: urlData } = supabase.storage.from('enquiry-attachments').getPublicUrl(filePath)
    return { name: file.name, url: urlData.publicUrl }
  }

  async function handleSave() {
    if (!form.projectName.trim()) { alert('Project Name is required!'); return }
    if (!form.requiredProduct) { alert('Please select a Required Product!'); return }
    if (!form.projectStage) { alert('Please select a Project Stage!'); return }

    setSaving(true)
    try {
      let makeListFileName = project?.make_list_file_name || ''
      let makeListFileUrl = project?.make_list_file_url || ''
      if (form.projectStage === 'Tender Stage' && makeListFile) {
        const uploaded = await uploadFile(makeListFile, 'makelist')
        makeListFileName = uploaded.name
        makeListFileUrl = uploaded.url
      }

      let biddingFileName = project?.bidding_file_name || ''
      let biddingFileUrl = project?.bidding_file_url || ''
      if (form.projectStage === 'Bidding by Contractors' && biddingFile) {
        const uploaded = await uploadFile(biddingFile, 'bidding')
        biddingFileName = uploaded.name
        biddingFileUrl = uploaded.url
      }

      const cleanContractors = contractors.filter(c => c.name.trim() || c.contact.trim() || c.mobile.trim())
      const cleanEnquiryContractors =
        form.projectStage === 'Won by Contractor' && form.enquiryFromContractor === 'Yes'
          ? enquiryContractors.filter(c => c.name.trim() || c.contact.trim() || c.mobile.trim())
          : []

      const payload = {
        project_name: form.projectName.trim(),
        consultant_name: form.consultantName.trim(),
        consultant_contact_person: form.consultantContactPerson.trim(),
        consultant_mobile: form.consultantMobile.trim(),
        consultant_email: form.consultantEmail.trim(),
        consultant_designation: form.consultantDesignation.trim(),
        contractors: cleanContractors,
        end_client_name: form.endClientName.trim(),
        end_client_contact_person: form.endClientContactPerson.trim(),
        end_client_mobile: form.endClientMobile.trim(),
        end_client_email: form.endClientEmail.trim(),
        required_product: form.requiredProduct,
        project_stage: form.projectStage,
        casilica_approved: form.projectStage === 'Tender Stage' ? form.casilicaApproved : '',
        make_list_file_name: makeListFileName,
        make_list_file_url: makeListFileUrl,
        bidding_contractors_list: form.projectStage === 'Bidding by Contractors' ? form.biddingContractorsList.trim() : '',
        bidding_file_name: biddingFileName,
        bidding_file_url: biddingFileUrl,
        enquiry_from_consultant: form.projectStage === 'Won by Consultant' ? form.enquiryFromConsultant : '',
        enquiry_from_contractor: form.projectStage === 'Won by Contractor' ? form.enquiryFromContractor : '',
        contractor_details: cleanEnquiryContractors,
      }

      if (isEdit) {
        const { error } = await supabase.from('sm_projects').update(payload).eq('id', project.id)
        if (error) throw error
      } else {
        payload.project_id = `PRJ-${Date.now()}`
        payload.created_by = smUser?.name || ''
        payload.created_by_id = smUser?.userId || ''
        const { error } = await supabase.from('sm_projects').insert(payload)
        if (error) throw error
      }

      logActivity({
        userId: smUser?.userId, userName: smUser?.name, role: smUser?.role,
        action: isEdit ? 'EDIT_PROJECT' : 'ADD_PROJECT', module: 'Projects',
        details: isEdit ? `Project updated: ${form.projectName.trim()}` : `New project added: ${form.projectName.trim()}`,
      })

      onSaved()
      onClose()
    } catch (err) {
      alert('Error saving project: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEdit ? '✏️ Edit Project' : '📁 Add New Project'}
      onClose={onClose}
      width={680}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className={`fas ${isEdit ? 'fa-save' : 'fa-folder-plus'}`}></i>
            {saving ? (isEdit ? ' Updating…' : ' Saving…') : (isEdit ? ' Update Project' : ' Create Project')}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>Project Name *</label>
        <input value={form.projectName} onChange={e => updateField('projectName', e.target.value)} placeholder="Enter project name" />
      </div>

      {/* ── Consultant ── */}
      <div className="pfm-section-banner">
        <i className="fas fa-landmark"></i> Consultant Details
      </div>
      <div className="modal-form-group">
        <label>Consultant Name</label>
        <input value={form.consultantName} onChange={e => updateField('consultantName', e.target.value)} placeholder="Consultant company / firm name" />
      </div>
      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Contact Person Name</label>
          <input value={form.consultantContactPerson} onChange={e => updateField('consultantContactPerson', e.target.value)} placeholder="Contact person name" />
        </div>
        <div className="modal-form-group">
          <label>Mobile Number</label>
          <input value={form.consultantMobile} onChange={e => updateField('consultantMobile', e.target.value)} placeholder="Mobile number" />
        </div>
      </div>
      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Mail ID</label>
          <input type="email" value={form.consultantEmail} onChange={e => updateField('consultantEmail', e.target.value)} placeholder="Email address" />
        </div>
        <div className="modal-form-group">
          <label>Designation</label>
          <input value={form.consultantDesignation} onChange={e => updateField('consultantDesignation', e.target.value)} placeholder="Designation" />
        </div>
      </div>

      {/* ── Contractors ── */}
      <div className="pfm-section-banner">
        <i className="fas fa-hard-hat"></i> Contractor Details
      </div>
      {contractors.map((c, idx) => (
        <ContactEntryCard
          key={idx}
          title={`Contractor ${idx + 1}`}
          data={c}
          onChange={(field, value) => updateContractor(idx, field, value)}
          onRemove={() => removeContractor(idx)}
          showRemove={contractors.length > 1}
        />
      ))}
      <button type="button" className="pfm-add-more-btn" onClick={addContractor}>
        <i className="fas fa-hard-hat"></i> + Add Another Contractor
      </button>

      {/* ── End Client ── */}
      <div className="pfm-section-banner">
        <i className="fas fa-building"></i> End Client Details
      </div>
      <div className="modal-form-group">
        <label>End Client Name</label>
        <input value={form.endClientName} onChange={e => updateField('endClientName', e.target.value)} placeholder="End client company name" />
      </div>
      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Contact Person</label>
          <input value={form.endClientContactPerson} onChange={e => updateField('endClientContactPerson', e.target.value)} placeholder="Contact person name" />
        </div>
        <div className="modal-form-group">
          <label>Mobile Number</label>
          <input value={form.endClientMobile} onChange={e => updateField('endClientMobile', e.target.value)} placeholder="Mobile number" />
        </div>
      </div>
      <div className="modal-form-group">
        <label>Mail ID</label>
        <input type="email" value={form.endClientEmail} onChange={e => updateField('endClientEmail', e.target.value)} placeholder="Email address" />
      </div>

      <div className="pfm-divider"></div>

      {/* ── Product & Stage ── */}
      <div className="modal-form-group">
        <label>Required Product *</label>
        <select value={form.requiredProduct} onChange={e => updateField('requiredProduct', e.target.value)}>
          <option value="">-- Select Product --</option>
          {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="modal-form-group">
        <label>Project Stage *</label>
        <select value={form.projectStage} onChange={e => onStageChange(e.target.value)}>
          <option value="">-- Select Stage --</option>
          {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* ── Conditional: Tender Stage ── */}
      {form.projectStage === 'Tender Stage' && (
        <div className="pfm-conditional-box">
          <div className="modal-form-group" style={{ marginBottom: form.casilicaApproved === 'Yes' ? 10 : 0 }}>
            <label>Casilica Approved?</label>
            <select value={form.casilicaApproved} onChange={e => updateField('casilicaApproved', e.target.value)}>
              <option value="">-- Select --</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          {form.casilicaApproved === 'Yes' && (
            <div>
              <label className="pfm-mini-label">Upload Make List</label>
              <input type="file" onChange={e => setMakeListFile(e.target.files?.[0] || null)} />
              {project?.make_list_file_name && !makeListFile && (
                <div className="pfm-existing-file">
                  <i className="fas fa-paperclip"></i> Current: {project.make_list_file_name}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Conditional: Bidding by Contractors ── */}
      {form.projectStage === 'Bidding by Contractors' && (
        <div className="pfm-conditional-box">
          <label className="pfm-mini-label">List of Contractors</label>
          <textarea
            value={form.biddingContractorsList}
            onChange={e => updateField('biddingContractorsList', e.target.value)}
            placeholder="Type contractor names or details..."
            style={{ minHeight: 70, marginBottom: 10 }}
          />
          <label className="pfm-mini-label">Upload Contractor List (Optional)</label>
          <input type="file" onChange={e => setBiddingFile(e.target.files?.[0] || null)} />
          {project?.bidding_file_name && !biddingFile && (
            <div className="pfm-existing-file">
              <i className="fas fa-paperclip"></i> Current: {project.bidding_file_name}
            </div>
          )}
        </div>
      )}

      {/* ── Conditional: Won by Consultant ── */}
      {form.projectStage === 'Won by Consultant' && (
        <div className="pfm-conditional-box success">
          <div className="modal-form-group" style={{ marginBottom: 0 }}>
            <label>Did we receive the enquiry from consultant?</label>
            <select value={form.enquiryFromConsultant} onChange={e => updateField('enquiryFromConsultant', e.target.value)}>
              <option value="">-- Select --</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Conditional: Won by Contractor ── */}
      {form.projectStage === 'Won by Contractor' && (
        <div className="pfm-conditional-box info">
          <div className="modal-form-group" style={{ marginBottom: form.enquiryFromContractor === 'Yes' ? 14 : 0 }}>
            <label>Did we receive the enquiry from contractor?</label>
            <select value={form.enquiryFromContractor} onChange={e => updateField('enquiryFromContractor', e.target.value)}>
              <option value="">-- Select --</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          {form.enquiryFromContractor === 'Yes' && (
            <>
              <div className="pfm-sub-label">Contractor Details</div>
              {enquiryContractors.map((c, idx) => (
                <ContactEntryCard
                  key={idx}
                  title={`Contractor ${idx + 1}`}
                  data={c}
                  onChange={(field, value) => updateEnquiryContractor(idx, field, value)}
                  onRemove={() => removeEnquiryContractor(idx)}
                  showRemove={enquiryContractors.length > 1}
                />
              ))}
              <button type="button" className="pfm-add-more-btn small" onClick={addEnquiryContractor}>
                + Add More Contractors
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
