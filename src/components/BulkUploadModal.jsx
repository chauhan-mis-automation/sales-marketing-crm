import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSMAuth } from '../context/SMAuthContext'
import { parseCSV, downloadCSV } from '../lib/csvHelpers'
import { logActivity } from '../lib/activityLog'
import Modal from './Modal'
import './BulkUploadModal.css'

const TEMPLATE_HEADERS = [
  'Name*', 'Phone*', 'Alternate Phone', 'Email', 'Company', 'Designation',
  'Address', 'City', 'State', 'Region', 'Source', 'Category', 'Industry',
  'Business Volume', 'Rating', 'Notes',
]

const TEMPLATE_SAMPLE_ROW = [
  'Rahul Sharma', '9876543210', '9876543211', 'rahul@abc.com', 'ABC Ltd', 'Manager',
  '123 MG Road', 'Mumbai', 'Maharashtra', 'West', 'VisitingCard', 'End client', 'Manufacturing',
  'High', 'Pro', 'Interested in DHU product',
]

// Normalized header text -> internal field key. Handles the exact template
// headers above, plus a few common variants, so a manually-typed CSV still works.
const HEADER_MAP = {
  'name': 'name', 'name*': 'name', 'full name': 'name',
  'phone': 'phone', 'phone*': 'phone', 'phone/mobile': 'phone', 'phone/mobile*': 'phone', 'mobile': 'phone',
  'alternate phone': 'alternatePhone', 'alternatephone': 'alternatePhone',
  'email': 'email', 'email id': 'email',
  'company': 'company',
  'designation': 'designation',
  'address': 'address',
  'city': 'city',
  'state': 'state',
  'region': 'region',
  'source': 'source', 'source*': 'source',
  'category': 'category', 'category*': 'category',
  'industry': 'industry',
  'business volume': 'businessVolume', 'businessvolume': 'businessVolume',
  'rating': 'rating', 'engagement rating': 'rating', 'engagementrating': 'rating',
  'notes': 'notes',
}

export default function BulkUploadModal({ onClose, onImported }) {
  const { smUser } = useSMAuth()
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [parsedRows, setParsedRows] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  function handleDownloadTemplate() {
    downloadCSV('Contacts_Bulk_Upload_Template.csv', TEMPLATE_HEADERS, [TEMPLATE_SAMPLE_ROW])
  }

  function handleFile(f) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) {
      alert('Please upload a .csv file. (Excel files: open in Excel/Sheets and "Save As CSV" first.)')
      return
    }
    setFile(f)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  async function handlePreview() {
    if (!file) return
    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length < 2) { alert('File is empty or has no data rows!'); return }

    const headers = rows[0].map(h => h.trim())
    const dataRows = rows.slice(1)

    const colMap = {}
    headers.forEach((h, i) => {
      const key = HEADER_MAP[h.toLowerCase().trim()]
      if (key) colMap[key] = i
    })

    const parsed = dataRows.map(row => {
      const get = key => (colMap[key] !== undefined ? (row[colMap[key]] || '').trim() : '')
      const name = get('name')
      const phone = get('phone')
      return {
        name, phone,
        alternatePhone: get('alternatePhone'),
        email: get('email'), company: get('company'), designation: get('designation'),
        address: get('address'), city: get('city'), state: get('state'), region: get('region'),
        source: get('source') || 'Self Entry',
        category: get('category'),
        industry: get('industry'),
        businessVolume: get('businessVolume') || 'Medium',
        rating: get('rating') || 'Yet to meet',
        notes: get('notes'),
        _valid: !!(name && phone),
      }
    })

    setParsedRows(parsed)
    setStep(2)
  }

  async function handleImport() {
    const validRows = parsedRows.filter(r => r._valid)
    if (validRows.length === 0) { alert('No valid rows to import!'); return }

    setImporting(true)
    try {
      const { data: existing } = await supabase.from('sm_leads').select('phone')
      const existingDigits = new Set((existing || []).map(l => (l.phone || '').replace(/\D/g, '').slice(-10)))

      let imported = 0
      let skipped = parsedRows.length - validRows.length
      const rowsToInsert = []
      const seen = new Set()

      validRows.forEach((r, idx) => {
        const digits = r.phone.replace(/\D/g, '').slice(-10)
        if (digits.length !== 10 || existingDigits.has(digits) || seen.has(digits)) { skipped++; return }
        seen.add(digits)

        rowsToInsert.push({
          lead_id: `LEAD-${Date.now()}-${idx}`,
          name: r.name,
          phone: `+91 ${digits}`,
          alternate_phone: r.alternatePhone ? `+91 ${r.alternatePhone.replace(/\D/g, '').slice(-10)}` : '',
          email: r.email, company: r.company, designation: r.designation,
          address: r.address, city: r.city, state: r.state, region: r.region,
          source: r.source, category: r.category, industry: r.industry,
          business_volume: r.businessVolume, rating: r.rating, notes: r.notes,
          status: 'New', assigned_to: '', priority: 'Medium',
          created_by: smUser?.name || '', created_by_id: smUser?.userId || '',
        })
        imported++
      })

      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from('sm_leads').insert(rowsToInsert)
        if (error) throw error
      }

      logActivity({
        userId: smUser?.userId, userName: smUser?.name, role: smUser?.role,
        action: 'BULK_IMPORT', module: 'Leads',
        details: `Bulk imported ${imported} contacts, skipped ${skipped}`,
      })

      setResult({ imported, skipped })
      setStep(3)
      onImported?.()
    } catch (err) {
      alert('Import failed: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  function resetAndUploadAnother() {
    setFile(null); setParsedRows([]); setResult(null); setStep(1)
  }

  const validCount = parsedRows.filter(r => r._valid).length
  const invalidCount = parsedRows.length - validCount

  return (
    <Modal title="📤 Bulk Upload Contacts" onClose={onClose} width={680}>
      <div className="bum-steps">
        <div className={`bum-step ${step >= 1 ? 'active' : ''}`}>1. Upload File</div>
        <div className={`bum-step ${step >= 2 ? 'active' : ''}`}>2. Preview Data</div>
        <div className={`bum-step ${step >= 3 ? 'active' : ''}`}>3. Import Done</div>
      </div>

      {step === 1 && (
        <>
          <div className="bum-info-banner">
            <strong>📌 Instructions:</strong><br />
            1. Download the template using the button below<br />
            2. Fill in your contacts (don't rename the column headers)<br />
            3. Upload the filled CSV file here
          </div>

          <button className="bum-template-btn" onClick={handleDownloadTemplate}>
            <i className="fas fa-file-download"></i> Download Template
          </button>

          <div
            className={`bum-dropzone ${dragActive ? 'active' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('bum-file-input').click()}
          >
            <input id="bum-file-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
            <div className="bum-dropzone-icon"><i className="fas fa-file-csv"></i></div>
            <div className="bum-dropzone-text">Drop your CSV file here, or click to browse</div>
            <div className="bum-dropzone-sub">Only .csv files are supported</div>
          </div>

          {file && (
            <div className="bum-file-info">
              <i className="fas fa-file-alt"></i> {file.name} <span>({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}

          <div className="bum-footer">
            <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-modal-primary" onClick={handlePreview} disabled={!file}>Preview Data →</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="bum-stats">
            <div className="bum-stat good"><div className="bum-stat-value">{validCount}</div><div className="bum-stat-label">Valid Rows</div></div>
            <div className="bum-stat bad"><div className="bum-stat-value">{invalidCount}</div><div className="bum-stat-label">Invalid Rows</div></div>
            <div className="bum-stat neutral"><div className="bum-stat-value">{parsedRows.length}</div><div className="bum-stat-label">Total Rows</div></div>
          </div>

          {invalidCount > 0 && (
            <div className="bum-warning">
              <i className="fas fa-exclamation-triangle"></i> {invalidCount} row(s) missing Name or Phone will be skipped.
            </div>
          )}

          <div className="bum-preview-wrap">
            <table className="bum-preview-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Company</th><th>Source</th><th>Category</th><th>City</th><th>Status</th></tr></thead>
              <tbody>
                {parsedRows.slice(0, 10).map((r, i) => (
                  <tr key={i} className={r._valid ? '' : 'invalid'}>
                    <td>{r.name || '—'}</td>
                    <td>{r.phone || '—'}</td>
                    <td>{r.company || '—'}</td>
                    <td>{r.source || '—'}</td>
                    <td>{r.category || '—'}</td>
                    <td>{r.city || '—'}</td>
                    <td><span className="bum-badge">{r._valid ? 'New' : 'Skip'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 10 && <div className="bum-more-note">…and {parsedRows.length - 10} more rows</div>}
          </div>

          <div className="bum-footer">
            <button className="btn-modal-ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="btn-modal-primary" onClick={handleImport} disabled={importing || validCount === 0}>
              {importing ? 'Importing…' : `✅ Import ${validCount} Contact${validCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}

      {step === 3 && result && (
        <div className="bum-done">
          <div className="bum-done-icon">🎉</div>
          <div className="bum-done-title">Import Complete!</div>
          <div className="bum-done-msg">
            <strong>{result.imported}</strong> contact{result.imported === 1 ? '' : 's'} added successfully
            {result.skipped > 0 && (
              <>
                <br />
                <span className="bum-done-skip">{result.skipped} row(s) skipped (duplicate phone or missing required fields)</span>
              </>
            )}
          </div>
          <div className="bum-footer center">
            <button className="btn-modal-ghost" onClick={onClose}>View Contacts</button>
            <button className="btn-modal-primary" onClick={resetAndUploadAnother}>Upload Another File</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
