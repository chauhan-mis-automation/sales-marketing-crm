import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useDropdownData } from '../lib/useDropdownData'
import { sanitizeFileName } from '../lib/fileHelpers'
import { DRAWING_ITEMS, SIZE_FIELDS } from '../lib/workOrderConstants'
import { generateWorkOrderExcel, getWorkOrderExcelBlob } from '../lib/workOrderExcel'
import './WorkOrderFormModal.css'

function emptyRow() {
  return {
    model: '', pre: '', post: '', vd20: '', rotorDia: '',
    supply: { cfm: '', fanDia: '', hpPole: '', fanSrNo: '', motorMake: '' },
    reactivation: { cfm: '', fanDia: '', hpPole: '', fanSrNo: '', motorMake: '' },
    reqHeater: '',
    instHeater: '',
    machOrient: '',
    qty: 1
  }
}

export default function WorkOrderFormModal({ task, enquiryInfo, initialData, isResubmission, onClose, onSaved }) {
  const { user } = useAuth()
  const {
    model, pre, post, vd20: vd20Options, rotorDia: rotorDiaOptions,
    machineOrientation, fanDia, ieHpPole, instHeater: instHeaterOptions
  } = useDropdownData()

  const [poJobId] = useState(initialData?.poJobId || `PO-${Date.now()}`)
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().slice(0, 10))
  const [completionDate, setCompletionDate] = useState(initialData?.completionDate || '')
  const [rows, setRows] = useState(initialData?.rows?.length ? initialData.rows : [emptyRow()])
  const [drawings, setDrawings] = useState(initialData?.drawings || {})
  const [sizes, setSizes] = useState(initialData?.sizes || {})
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [savingExcel, setSavingExcel] = useState(false)

  // previously uploaded files (only present when editing/resubmitting an already-submitted form)
  const existingFileUrls = (task.additional_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
  const [removedExisting, setRemovedExisting] = useState([])
  const keptExistingUrls = existingFileUrls.filter(u => !removedExisting.includes(u))

  const isEditMode = !!initialData

  const address = [enquiryInfo?.city, enquiryInfo?.state, enquiryInfo?.country].filter(Boolean).join(', ')

  function updateRow(idx, patch) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }
  function updateRowNested(idx, group, patch) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [group]: { ...r[group], ...patch } } : r))
  }
  function addRow() {
    setRows(prev => [...prev, emptyRow()])
  }
  function removeRow(idx) {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }
  function toggleDrawing(item, value) {
    setDrawings(prev => ({ ...prev, [item]: prev[item] === value ? undefined : value }))
  }
  function updateSize(key, value) {
    setSizes(prev => ({ ...prev, [key]: value }))
  }
  function handleFileSelect(e) {
  const picked = Array.from(e.target.files || [])
  if (picked.length === 0) return
  setFiles(prev => [...prev, ...picked])
  e.target.value = ''
}
  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }
  function removeExistingFile(url) {
    setRemovedExisting(prev => [...prev, url])
  }

  function buildFormPayload() {
    return {
      enquiryId: task.enquiry_id,
      date,
      poId: poJobId,
      clientName: enquiryInfo?.company_name || '',
      address,
      offerNo: task.enquiry_id,
      completionDate,
      rows,
      drawings,
      sizes
    }
  }

  async function handleSaveExcel() {
    setSavingExcel(true)
    try {
      await generateWorkOrderExcel(buildFormPayload())
    } catch (err) {
      alert('Error generating Excel: ' + err.message)
    } finally {
      setSavingExcel(false)
    }
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      // 1. newly added reference/attachment files
      let newFileUrls = []
      for (const file of files) {
        const filePath = `work-order-forms/${task.enquiry_id}/${Date.now()}_${sanitizeFileName(file.name)}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('enquiry-attachments')
          .upload(filePath, file)
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('enquiry-attachments').getPublicUrl(filePath)
          newFileUrls.push(urlData.publicUrl)
        }
      }
      const allFileUrls = [...keptExistingUrls, ...newFileUrls]

      // 2. generate the formatted Excel and upload it to storage
      const formData = buildFormPayload()
      let excelUrl = task.excel_file_url || ''
      try {
        const { blob, fileName } = await getWorkOrderExcelBlob(formData)
        const excelPath = `work-order-excel/${task.enquiry_id}/${Date.now()}_${sanitizeFileName(fileName)}`
        const { data: excelUploadData, error: excelUploadError } = await supabase.storage
          .from('enquiry-attachments')
          .upload(excelPath, blob)
        if (!excelUploadError && excelUploadData) {
          const { data: urlData } = supabase.storage.from('enquiry-attachments').getPublicUrl(excelPath)
          excelUrl = urlData.publicUrl
        }
      } catch (excelErr) {
        console.warn('Excel generation/upload failed, continuing without it:', excelErr)
      }

      // 3. update the work order record
      const { error: updateError } = await supabase
        .from('work_orders')
        .update({
          form_data: formData,
          completion_date: completionDate || null,
          additional_file_url: allFileUrls.join(', '),
          excel_file_url: excelUrl,
          designer_submission_date: new Date().toISOString(),
          status: 'Submitted for Review'
        })
        .eq('id', task.id)
      if (updateError) throw updateError

      // 4. stage log
      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: task.enquiry_id,
        stage_name: isEditMode ? 'Work Order Resubmitted by Designer' : 'Work Order Submitted by Designer',
        remarks: `Work order ${task.version} ${isEditMode ? 'resubmitted' : 'submitted'} by ${user?.name || ''}`,
        logged_by: user?.name || ''
      })

      // 5. notify admins for review
      const { data: adminUsers } = await supabase
        .from('users')
        .select('name')
        .in('role', ['admin', 'superadmin'])
        .eq('active', true)

      if (adminUsers && adminUsers.length > 0) {
        const companyName = enquiryInfo?.company_name || ''
        await supabase.from('notifications').insert(
          adminUsers.map(u => ({
            recipient_name: u.name,
            enquiry_id: task.enquiry_id,
            title: isEditMode ? '🔄 Work Order Resubmitted for Review' : '📋 New Work Order Submitted for Review',
            message: `${user?.name || 'Designer'} has ${isEditMode ? 'resubmitted' : 'submitted'} Work Order ${task.version} for enquiry ${task.enquiry_id}${companyName ? ' (' + companyName + ')' : ''}. Please review and approve/reject.`,
            type: 'wo_submitted'
          }))
        )
      }

      onSaved()
      onClose()
    } catch (err) {
      alert('Error submitting form: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="wof-overlay" onClick={onClose}>
      <div className="wof-modal" onClick={e => e.stopPropagation()}>
        <div className="wof-header">
          <span><i className="fas fa-clipboard-list"></i> {isResubmission ? 'Resubmit Work Order Form' : isEditMode ? 'Edit Work Order Form' : 'Fill Work Order Form'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="wof-version-badge">{task.version}</span>
            <button className="wof-close-btn" onClick={onClose}><i className="fas fa-times"></i></button>
          </div>
        </div>

        <div className="wof-body">
          {isResubmission && task.admin_review_notes && (
            <div className="wof-revision-banner">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <strong>Admin's rejection reason:</strong> {task.admin_review_notes}
              </div>
            </div>
          )}

          <div className="wof-section-title">Header Details</div>
          <div className="wof-header-grid">
            <div className="wof-field">
              <label>Date *</label>
              <input type="date" className="wof-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="wof-field">
              <label>PO ID / Job ID</label>
              <input className="wof-input" value={poJobId} readOnly />
            </div>
            <div className="wof-field">
              <label>Client Name</label>
              <input className="wof-input" value={enquiryInfo?.company_name || ''} readOnly />
            </div>
            <div className="wof-field" style={{ gridColumn: '1 / -1' }}>
              <label>Address</label>
              <input className="wof-input" value={address} readOnly />
            </div>
            <div className="wof-field">
              <label>Offer No.</label>
              <input className="wof-input" value={task.enquiry_id} readOnly />
            </div>
            <div className="wof-field">
              <label>Completion Date</label>
              <input type="date" className="wof-input" value={completionDate} onChange={e => setCompletionDate(e.target.value)} />
            </div>
          </div>

          <div className="wof-section-title">Dehumidifier Rows</div>

          {rows.map((row, idx) => (
            <div key={idx} className="wof-row-card">
              <div className="wof-row-header">
                <span><i className="fas fa-tint"></i> Dehumidifier Row {idx + 1}</span>
                {rows.length > 1 && (
                  <button className="wof-remove-row-btn" onClick={() => removeRow(idx)} title="Remove row">
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>

              <div className="wof-table-wrap">
                <table className="wof-table">
                  <thead>
                    <tr>
                      <td></td><td></td><td></td>
                      <td>CFM/Static</td>
                      <td>Fan Dia.</td>
                      <td>HP/Pole</td>
                      <td>Fan Sr. No.</td>
                      <td>Motor Make &amp; Frame</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="wof-label-left">Model</td>
                      <td>
                        <select className="wof-cell-select" value={row.model} onChange={e => updateRow(idx, { model: e.target.value })}>
                          <option value="">Please Select</option>
                          {model.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="wof-lbl-sup">Supply</td>
                      <td><input className="wof-cell-input" placeholder="CFM" value={row.supply.cfm} onChange={e => updateRowNested(idx, 'supply', { cfm: e.target.value })} /></td>
                      <td>
                        <select className="wof-cell-select" value={row.supply.fanDia} onChange={e => updateRowNested(idx, 'supply', { fanDia: e.target.value })}>
                          <option value="">Please Select</option>
                          {fanDia.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="wof-cell-select" value={row.supply.hpPole} onChange={e => updateRowNested(idx, 'supply', { hpPole: e.target.value })}>
                          <option value="">Please Select</option>
                          {ieHpPole.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td><input className="wof-cell-input" placeholder="Sr#" value={row.supply.fanSrNo} onChange={e => updateRowNested(idx, 'supply', { fanSrNo: e.target.value })} /></td>
                      <td><input className="wof-cell-input" placeholder="Motor Make" value={row.supply.motorMake} onChange={e => updateRowNested(idx, 'supply', { motorMake: e.target.value })} /></td>
                    </tr>
                    <tr>
                      <td className="wof-label-left">Pre</td>
                      <td>
                        <select className="wof-cell-select" value={row.pre} onChange={e => updateRow(idx, { pre: e.target.value })}>
                          <option value="">Select</option>
                          {pre.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="wof-lbl-rea">Reactivation</td>
                      <td><input className="wof-cell-input" placeholder="CFM" value={row.reactivation.cfm} onChange={e => updateRowNested(idx, 'reactivation', { cfm: e.target.value })} /></td>
                      <td>
                        <select className="wof-cell-select" value={row.reactivation.fanDia} onChange={e => updateRowNested(idx, 'reactivation', { fanDia: e.target.value })}>
                          <option value="">Please Select</option>
                          {fanDia.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="wof-cell-select" value={row.reactivation.hpPole} onChange={e => updateRowNested(idx, 'reactivation', { hpPole: e.target.value })}>
                          <option value="">Please Select</option>
                          {ieHpPole.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td><input className="wof-cell-input" placeholder="Sr#" value={row.reactivation.fanSrNo} onChange={e => updateRowNested(idx, 'reactivation', { fanSrNo: e.target.value })} /></td>
                      <td><input className="wof-cell-input" placeholder="Motor Make" value={row.reactivation.motorMake} onChange={e => updateRowNested(idx, 'reactivation', { motorMake: e.target.value })} /></td>
                    </tr>
                    <tr>
                      <td className="wof-label-left">Post</td>
                      <td>
                        <select className="wof-cell-select" value={row.post} onChange={e => updateRow(idx, { post: e.target.value })}>
                          <option value="">Select</option>
                          {post.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="wof-lbl-req">Req. Heater</td>
                      <td><input className="wof-cell-input" placeholder="Value" value={row.reqHeater} onChange={e => updateRow(idx, { reqHeater: e.target.value })} /></td>
                      <td></td><td></td><td></td><td></td>
                    </tr>
                    <tr>
                      <td className="wof-label-left">VD2.0</td>
                      <td>
                        <select className="wof-cell-select" value={row.vd20} onChange={e => updateRow(idx, { vd20: e.target.value })}>
                          <option value="">Select</option>
                          {vd20Options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="wof-lbl-req">Inst. Heater</td>
                      <td>
                        <select className="wof-cell-select" value={row.instHeater} onChange={e => updateRow(idx, { instHeater: e.target.value })}>
                          <option value="">Please select</option>
                          {instHeaterOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td></td><td></td><td></td><td></td>
                    </tr>
                    <tr>
                      <td className="wof-label-left">Rotor Dia</td>
                      <td>
                        <select className="wof-cell-select" value={row.rotorDia} onChange={e => updateRow(idx, { rotorDia: e.target.value })}>
                          <option value="">Please Select</option>
                          {rotorDiaOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="wof-lbl-orient">Mach. Orient.</td>
                      <td>
                        <select className="wof-cell-select" value={row.machOrient} onChange={e => updateRow(idx, { machOrient: e.target.value })}>
                          <option value="">Select</option>
                          {machineOrientation.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="wof-qty-cell">
                        <span className="wof-qty-label">Qty</span>
                        <input className="wof-cell-input wof-qty-input" type="number" min="1" value={row.qty} onChange={e => updateRow(idx, { qty: e.target.value })} />
                      </td>
                      <td></td><td></td><td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <button className="wof-add-row-btn" onClick={addRow}>
            <i className="fas fa-plus"></i> Add Another Row
          </button>

          <div className="wof-section-title">Drawings Need</div>
          <div className="wof-drawings-box">
            {DRAWING_ITEMS.map(item => (
              <div key={item} className="wof-drawing-row">
                <span className="wof-drawing-name">{item}</span>
                <span className="wof-drawing-hint">we require tick</span>
                <button
                  className={`wof-tick-btn ${drawings[item] === 'tick' ? 'active-tick' : ''}`}
                  onClick={() => toggleDrawing(item, 'tick')}
                >✓</button>
                <button
                  className={`wof-cross-btn ${drawings[item] === 'cross' ? 'active-cross' : ''}`}
                  onClick={() => toggleDrawing(item, 'cross')}
                >✗</button>
              </div>
            ))}
          </div>

          <div className="wof-section-title">Sizes (Inner to Inner)</div>
          <div className="wof-sizes-grid">
            {SIZE_FIELDS.map(f => (
              <div className="wof-field" key={f.key}>
                <label>{f.label}</label>
                <input className="wof-input" placeholder="Size" value={sizes[f.key] || ''} onChange={e => updateSize(f.key, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="wof-section-title">Additional Files</div>

          {keptExistingUrls.length > 0 && (
            <div className="wof-field" style={{ marginBottom: 10 }}>
              <label>Already Uploaded</label>
              <div className="modal-file-tags">
                {keptExistingUrls.map((url, i) => (
                  <div key={i} className="modal-file-tag" style={{ background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'rgba(45,122,71,.25)' }}>
                    <a href={url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                      <i className="fas fa-file"></i> File {i + 1}
                    </a>
                    <button type="button" onClick={() => removeExistingFile(url)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="wof-field">
            <label>Upload File(s) (optional, multiple allowed)</label>
            <label className="modal-file-btn">
              <i className="fas fa-paperclip"></i> Choose File(s)
              <input type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
            </label>
            {files.length > 0 && (
              <div className="modal-file-tags">
                {files.map((f, i) => (
                  <div key={i} className="modal-file-tag">
                    <span>{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="wof-footer">
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="wof-excel-btn" onClick={handleSaveExcel} disabled={savingExcel}>
            <i className="fas fa-file-excel"></i> {savingExcel ? 'Generating…' : 'Save as Excel'}
          </button>
          <button className="btn-modal-primary" onClick={handleSubmit} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Submitting…' : isResubmission ? 'Resubmit for Review' : isEditMode ? 'Update & Resubmit' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
