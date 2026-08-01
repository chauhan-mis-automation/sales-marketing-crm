import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import ProjectFormModal from '../../components/ProjectFormModal'
import Modal from '../../components/Modal'
import './SMAllProjects.css'

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

const PRODUCT_OPTIONS = ['Dehumidifier', 'Others']

const STAGE_COLORS = {
  'Budgeting By Contractor': '#b45309',
  'Design Stage': '#0369a1',
  'Tender Stage': '#b8860b',
  'Bidding by Contractors': '#6d28d9',
  'Won by Consultant': '#059669',
  'Won by Contractor': '#059669',
  'Negotiation stage by us': '#0d9488',
  'Won by us': '#059669',
  'lost by us': '#be123c',
}

function fmtDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Small "type to search" project-name dropdown, matching the Apps Script filter bar ──
function ProjectNameFilter({ names, value, onSelect }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = names.filter(n => n.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="sap-name-filter" ref={wrapRef}>
      <i className="fas fa-folder"></i>
      <input
        placeholder={value ? undefined : 'All Projects — type to search…'}
        value={open ? query : (value || '')}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={e => setQuery(e.target.value)}
      />
      {open && (
        <div className="sap-name-menu">
          <div className="sap-name-item all" onClick={() => { onSelect(''); setOpen(false) }}>
            <i className="fas fa-clipboard-list"></i> All Projects
          </div>
          {filtered.length === 0 ? (
            <div className="sap-name-empty">No matches found</div>
          ) : (
            filtered.map(n => (
              <div key={n} className="sap-name-item" onClick={() => { onSelect(n); setOpen(false) }}>
                <i className="fas fa-folder"></i> {n}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ContractorList({ contractors }) {
  if (!contractors || contractors.length === 0) return <span className="sap-dash">—</span>
  return (
    <div>
      {contractors.map((c, i) => (
        <div key={i} className={i > 0 ? 'sap-sub-block' : ''}>
          {c.name && <div className="sap-line-strong"><i className="fas fa-hard-hat"></i> {c.name}</div>}
          {c.contact && <div className="sap-line-sub">👤 {c.contact}{c.designation ? ` (${c.designation})` : ''}</div>}
          {c.mobile && <div className="sap-line-mono">📞 {c.mobile}</div>}
          {c.email && <div className="sap-line-sub">✉️ {c.email}</div>}
        </div>
      ))}
    </div>
  )
}

export default function SMAllProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const [nameFilter, setNameFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('All')
  const [productFilter, setProductFilter] = useState('All')

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [viewingProject, setViewingProject] = useState(null)

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    setLoading(true)
    const { data, error } = await supabase.from('sm_projects').select('*').order('created_date', { ascending: false })
    if (!error) setProjects(data || [])
    setLoading(false)
  }

  const projectNames = useMemo(() => {
    const names = []
    projects.forEach(p => { if (p.project_name && !names.includes(p.project_name)) names.push(p.project_name) })
    return names.sort()
  }, [projects])

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (nameFilter && p.project_name !== nameFilter) return false
      if (stageFilter !== 'All' && p.project_stage !== stageFilter) return false
      if (productFilter !== 'All' && p.required_product !== productFilter) return false
      return true
    })
  }, [projects, nameFilter, stageFilter, productFilter])

  function resetFilters() {
    setNameFilter(''); setStageFilter('All'); setProductFilter('All')
  }

  function stageDetails(p) {
    if (p.project_stage === 'Tender Stage' && p.casilica_approved) {
      return <span className={`sap-badge ${p.casilica_approved === 'Yes' ? 'good' : 'bad'}`}>Casilica: {p.casilica_approved}</span>
    }
    if (p.project_stage === 'Bidding by Contractors' && (p.bidding_contractors_list || p.bidding_file_name)) {
      return (
        <div>
          {p.bidding_contractors_list && <div className="sap-line-sub">📋 {p.bidding_contractors_list}</div>}
          {p.bidding_file_url && (
            <a href={p.bidding_file_url} target="_blank" rel="noreferrer" className="sap-file-link">
              📎 {p.bidding_file_name || 'View File'} ↗
            </a>
          )}
        </div>
      )
    }
    if (p.project_stage === 'Won by Consultant' && p.enquiry_from_consultant) {
      return <span className={`sap-badge ${p.enquiry_from_consultant === 'Yes' ? 'good' : 'bad'}`}>Enquiry Recd: {p.enquiry_from_consultant}</span>
    }
    if (p.project_stage === 'Won by Contractor' && p.enquiry_from_contractor) {
      return <span className={`sap-badge ${p.enquiry_from_contractor === 'Yes' ? 'good' : 'bad'}`}>Enquiry Recd: {p.enquiry_from_contractor}</span>
    }
    return <span className="sap-dash">—</span>
  }

  return (
    <div className="fade-in">
      <div className="sap-header">
        <div>
          <h1 className="sap-title">All Projects ({filtered.length})</h1>
          <div className="sap-subtitle">Track all identified projects from consultants &amp; end clients</div>
        </div>
        <button className="sap-add-btn" onClick={() => setShowAddModal(true)}>
          <i className="fas fa-plus"></i> Add Project
        </button>
      </div>

      <div className="sap-filters">
        <ProjectNameFilter names={projectNames} value={nameFilter} onSelect={setNameFilter} />
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="All">All Stages</option>
          {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={productFilter} onChange={e => setProductFilter(e.target.value)}>
          <option value="All">All Products</option>
          {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="sap-reset-btn" onClick={resetFilters}>Reset</button>
      </div>

      <div className="sap-card">
        <div className="sap-table-wrap">
          <table className="sap-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Consultant</th>
                <th>Contractors</th>
                <th>End Client</th>
                <th>Product</th>
                <th>Stage</th>
                <th>Stage Details</th>
                <th>Won By Contractor</th>
                <th>Make List File</th>
                <th>Created By</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="sap-empty"><i className="fas fa-spinner fa-spin"></i> Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="sap-empty"><div className="sap-empty-icon">📁</div>No projects found</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id}>
                    <td data-label="Project Name">
                      <strong>{p.project_name}</strong>
                      <div className="sap-line-mono-sm">{p.project_id}</div>
                    </td>
                    <td className="sap-col-wide" data-label="Consultant">
                      {p.consultant_name && <div className="sap-line-strong">{p.consultant_name}</div>}
                      {p.consultant_contact_person && <div className="sap-line-sub">👤 {p.consultant_contact_person}{p.consultant_designation ? ` (${p.consultant_designation})` : ''}</div>}
                      {p.consultant_mobile && <div className="sap-line-mono">📞 {p.consultant_mobile}</div>}
                      {p.consultant_email && <div className="sap-line-sub">✉️ {p.consultant_email}</div>}
                      {!p.consultant_name && !p.consultant_contact_person && !p.consultant_mobile && !p.consultant_email && <span className="sap-dash">—</span>}
                    </td>
                    <td className="sap-col-wide" data-label="Contractors"><ContractorList contractors={p.contractors} /></td>
                    <td className="sap-col-wide" data-label="End Client">
                      {p.end_client_name && <div className="sap-line-strong">{p.end_client_name}</div>}
                      {p.end_client_contact_person && <div className="sap-line-sub">👤 {p.end_client_contact_person}</div>}
                      {p.end_client_mobile && <div className="sap-line-mono">📞 {p.end_client_mobile}</div>}
                      {p.end_client_email && <div className="sap-line-sub">✉️ {p.end_client_email}</div>}
                      {!p.end_client_name && !p.end_client_contact_person && !p.end_client_mobile && !p.end_client_email && <span className="sap-dash">—</span>}
                    </td>
                    <td data-label="Product"><span className="sap-badge new">{p.required_product || '—'}</span></td>
                    <td data-label="Stage">
                      <span
                        className="sap-badge stage"
                        style={{ background: `${STAGE_COLORS[p.project_stage] || '#4a5c40'}18`, color: STAGE_COLORS[p.project_stage] || '#4a5c40' }}
                      >
                        {p.project_stage || '—'}
                      </span>
                    </td>
                    <td className="sap-col-wide" data-label="Stage Details">{stageDetails(p)}</td>
                    <td className="sap-col-wide" data-label="Won By Contractor"><ContractorList contractors={p.contractor_details} /></td>
                    <td data-label="Make List File">
                      {p.make_list_file_name ? (
                        p.make_list_file_url ? (
                          <a href={p.make_list_file_url} target="_blank" rel="noreferrer" className="sap-file-link">
                            📎 {p.make_list_file_name} ↗
                          </a>
                        ) : <span>📎 {p.make_list_file_name}</span>
                      ) : <span className="sap-dash">—</span>}
                    </td>
                    <td data-label="Created By">{p.created_by || '—'}</td>
                    <td className="sap-line-mono-sm" data-label="Date">{fmtDate(p.created_date)}</td>
                    <td data-label="Actions">
                      <div className="sap-action-btns">
                        <button className="sap-view-btn" onClick={() => setViewingProject(p)}>
                          <i className="fas fa-eye"></i> View
                        </button>
                        <button className="sap-edit-btn" onClick={() => setEditingProject(p)}>
                          <i className="fas fa-pen"></i> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <ProjectFormModal onClose={() => setShowAddModal(false)} onSaved={loadProjects} />
      )}
      {editingProject && (
        <ProjectFormModal project={editingProject} onClose={() => setEditingProject(null)} onSaved={loadProjects} />
      )}
      {viewingProject && (
        <ProjectDetailModal project={viewingProject} onClose={() => setViewingProject(null)} onEdit={() => { setEditingProject(viewingProject); setViewingProject(null) }} />
      )}
    </div>
  )
}

function ProjectDetailModal({ project: p, onClose, onEdit }) {
  return (
    <Modal
      title={`📁 ${p.project_name}`}
      onClose={onClose}
      width={800}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Close</button>
          <button className="btn-modal-primary" onClick={onEdit}><i className="fas fa-pen"></i> Edit Project</button>
        </>
      }
    >
      <div className="sap-detail-grid">
        <div className="sap-detail-card">
          <div className="sap-detail-label"><i className="fas fa-landmark"></i> Consultant</div>
          <div className="sap-line-strong">{p.consultant_name || '—'}</div>
          {p.consultant_contact_person && <div className="sap-line-sub">👤 {p.consultant_contact_person}{p.consultant_designation ? ` (${p.consultant_designation})` : ''}</div>}
          {p.consultant_mobile && <div className="sap-line-mono">📞 {p.consultant_mobile}</div>}
          {p.consultant_email && <div className="sap-line-sub">✉️ {p.consultant_email}</div>}
        </div>
        <div className="sap-detail-card">
          <div className="sap-detail-label"><i className="fas fa-building"></i> End Client</div>
          <div className="sap-line-strong">{p.end_client_name || '—'}</div>
          {p.end_client_contact_person && <div className="sap-line-sub">👤 {p.end_client_contact_person}</div>}
          {p.end_client_mobile && <div className="sap-line-mono">📞 {p.end_client_mobile}</div>}
          {p.end_client_email && <div className="sap-line-sub">✉️ {p.end_client_email}</div>}
        </div>
        <div className="sap-detail-card">
          <div className="sap-detail-label"><i className="fas fa-info-circle"></i> Stage Info</div>
          <div style={{ marginBottom: 6 }}>
            <span className="sap-badge stage" style={{ background: `${STAGE_COLORS[p.project_stage] || '#4a5c40'}18`, color: STAGE_COLORS[p.project_stage] || '#4a5c40' }}>
              {p.project_stage || '—'}
            </span>
          </div>
          {p.casilica_approved && <div className="sap-line-sub">Casilica Approved: <strong>{p.casilica_approved}</strong></div>}
          {p.enquiry_from_consultant && <div className="sap-line-sub">Enquiry (Consultant): <strong>{p.enquiry_from_consultant}</strong></div>}
          {p.enquiry_from_contractor && <div className="sap-line-sub">Enquiry (Contractor): <strong>{p.enquiry_from_contractor}</strong></div>}
          {p.make_list_file_url && (
            <a href={p.make_list_file_url} target="_blank" rel="noreferrer" className="sap-file-link" style={{ display: 'block', marginTop: 6 }}>
              📎 {p.make_list_file_name} ↗
            </a>
          )}
        </div>
      </div>

      <div className="sap-detail-card" style={{ marginTop: 4 }}>
        <div className="sap-detail-label"><i className="fas fa-hard-hat"></i> Contractors</div>
        <ContractorList contractors={p.contractors} />
        {p.contractor_details?.length > 0 && (
          <>
            <div className="pfm-sub-label" style={{ marginTop: 12 }}>Enquiry Received From (Contractor)</div>
            <ContractorList contractors={p.contractor_details} />
          </>
        )}
      </div>
    </Modal>
  )
}
