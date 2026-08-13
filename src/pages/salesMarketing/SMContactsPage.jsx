import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useSMAuth } from '../../context/SMAuthContext'
import { useSMDropdownData } from '../../lib/useSMDropdownData'
import { downloadCSV } from '../../lib/csvHelpers'
import AddContactModal from '../../components/AddContactModal'
import EditContactModal from '../../components/EditContactModal'
import ViewContactModal from '../../components/ViewContactModal'
import AssignContactModal from '../../components/AssignContactModal'
import ScheduleFollowUpModal from '../../components/ScheduleFollowUpModal'
import BulkUploadModal from '../../components/BulkUploadModal'
import './SMContactsPage.css'

const STATUS_COLORS = {
  New: '#0369a1', Assigned: '#6d28d9', Contacted: '#0d9488',
  Interested: '#b45309', 'Follow-up': '#b45309', Closed: '#059669', Lost: '#be123c',
}

const RATING_COLORS = {
  Pro: '#059669', Neutral: '#64748b', Anti: '#be123c', 'Yet to meet': '#0369a1',
}

const VOLUME_COLORS = { High: '#be123c', Medium: '#b45309', Low: '#059669' }

const CSV_HEADERS = [
  'Lead ID', 'Name', 'Designation', 'Company', 'Email', 'Phone', 'Source', 'Category',
  'Rating', 'Region', 'City', 'State', 'Address', 'Business Volume', 'Status', 'Assigned To',
]

export default function SMContactsPage({ scope }) {
  const { smUser } = useSMAuth()
  const { leadStatus, category, rating, source, businessVolume, loading: dropdownsLoading } = useSMDropdownData()

  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [volumeFilter, setVolumeFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [page, setPage] = useState(0)

  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [viewingLead, setViewingLead] = useState(null)
  const [editingLead, setEditingLead] = useState(null)
  const [assigningLead, setAssigningLead] = useState(null)
  const [schedulingLead, setSchedulingLead] = useState(null)

  useEffect(() => {
    loadLeads()
  }, [scope, smUser?.name])

  useEffect(() => {
    setPage(0)
  }, [search, statusFilter, categoryFilter, ratingFilter, sourceFilter, volumeFilter, regionFilter])

  async function loadLeads() {
    setLoading(true)
    const { data } = await supabase.from('sm_leads').select('*').order('created_date', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  const scopedLeads = useMemo(() => {
    if (scope === 'mine') return leads.filter(l => l.assigned_to === smUser?.name)
    if (scope === 'unassigned') return leads.filter(l => !l.assigned_to || l.assigned_to.trim() === '')
    return leads
  }, [leads, scope, smUser?.name])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scopedLeads.filter(l => {
      if (statusFilter && l.status !== statusFilter) return false
      if (categoryFilter && l.category !== categoryFilter) return false
      if (ratingFilter && l.rating !== ratingFilter) return false
      if (sourceFilter && l.source !== sourceFilter) return false
      if (volumeFilter && l.business_volume !== volumeFilter) return false
      if (regionFilter && !(l.region || '').toLowerCase().includes(regionFilter.trim().toLowerCase())) return false
      if (!q) return true
      return (
        (l.name || '').toLowerCase().includes(q) ||
        (l.company || '').toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.lead_id || '').toLowerCase().includes(q)
      )
    })
  }, [scopedLeads, search, statusFilter, categoryFilter, ratingFilter, sourceFilter, volumeFilter, regionFilter])

  function resetAll() {
    setSearch(''); setStatusFilter(''); setCategoryFilter(''); setRatingFilter('')
    setSourceFilter(''); setVolumeFilter(''); setRegionFilter('')
  }

  function handleDownloadCSV() {
    const rows = filtered.map(l => [
      l.lead_id, l.name, l.designation, l.company, l.email, l.phone, l.source, l.category,
      l.rating, l.region, l.city, l.state, l.address, l.business_volume, l.status, l.assigned_to,
    ])
    downloadCSV(`Contacts_${new Date().toISOString().slice(0, 10)}.csv`, CSV_HEADERS, rows)
  }

  function handleDownloadTemplate() {
    downloadCSV('Contacts_Upload_Template.csv', CSV_HEADERS.filter(h => h !== 'Lead ID' && h !== 'Status'), [])
  }

  const PER_PAGE = 10
  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1
  const pageSlice = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  const titles = {
    all: 'All Contacts',
    mine: 'My Contacts',
    unassigned: 'Unassigned Contacts',
  }
  const pageTitle = titles[scope] || titles.all

  return (
    <div>
      <div className="scp-header">
        <div>
          <h1 className="scp-title">{pageTitle} ({filtered.length})</h1>
        </div>
        <div className="scp-header-btns">
          <button className="scp-btn-secondary" onClick={handleDownloadCSV}>
            <i className="fas fa-download"></i> Download CSV
          </button>
          <button className="scp-btn-secondary" onClick={handleDownloadTemplate}>
            <i className="fas fa-file-alt"></i> Download Template
          </button>
          <button className="scp-btn-secondary" onClick={() => setShowBulkUpload(true)}>
            <i className="fas fa-cloud-upload-alt"></i> Bulk Upload
          </button>
          <button className="scp-add-btn" onClick={() => setShowAddModal(true)}>
            <i className="fas fa-plus"></i> Add Contact
          </button>
        </div>
      </div>

      <div className="scp-filters">
        <div className="scp-search">
          <i className="fas fa-search"></i>
          <input placeholder="Search name, phone, email, company…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {leadStatus.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {category.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}>
          <option value="">All Engagement</option>
          {rating.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">All Sources</option>
          {source.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={volumeFilter} onChange={e => setVolumeFilter(e.target.value)}>
          <option value="">All Volumes</option>
          {businessVolume.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="scp-region-input" placeholder="Region…" value={regionFilter} onChange={e => setRegionFilter(e.target.value)} />
        <button className="scp-reset-btn" onClick={resetAll}>Reset All</button>
      </div>

      <div className="scp-card">
        <div className="scp-table-wrap">
          <table className="scp-table">
            <thead>
              <tr>
                <th>Contact Name</th><th>Company</th><th>Email ID</th><th>Phone</th><th>Source</th>
                <th>Category</th><th>Engagement</th><th>Region</th><th>City</th><th>State</th>
                <th>Address</th><th>Business Vol</th><th>Status</th><th>Added By</th><th>Assigned To</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading || dropdownsLoading ? (
                <tr><td colSpan={16} className="scp-empty"><i className="fas fa-spinner fa-spin"></i> Loading…</td></tr>
              ) : pageSlice.length === 0 ? (
                <tr><td colSpan={16} className="scp-empty">No contacts found</td></tr>
              ) : (
                pageSlice.map(lead => (
                  <tr key={lead.id}>
                    <td data-label="Contact Name">
                      <strong>{lead.name}</strong>
                      {lead.designation && <div className="scp-sub">{lead.designation}</div>}
                    </td>
                    <td data-label="Company">{lead.company || '—'}</td>
                    <td data-label="Email ID" className="scp-mono">{lead.email || '—'}</td>
                    <td data-label="Phone" className="scp-mono">{lead.phone || '—'}</td>
                    <td data-label="Source">{lead.source && <span className="scp-source-badge">{lead.source.toUpperCase()}</span>}</td>
                    <td data-label="Category">{lead.category || '—'}</td>
                    <td data-label="Engagement">
                      {lead.rating && (
                        <span className="scp-badge" style={{ background: `${RATING_COLORS[lead.rating] || '#888'}18`, color: RATING_COLORS[lead.rating] || '#888' }}>
                          {lead.rating.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td data-label="Region">{lead.region || '—'}</td>
                    <td data-label="City">{lead.city || '—'}</td>
                    <td data-label="State">{lead.state || '—'}</td>
                    <td data-label="Address" className="scp-truncate">{lead.address || '—'}</td>
                    <td data-label="Business Vol">
                      {lead.business_volume && (
                        <span className="scp-badge" style={{ background: `${VOLUME_COLORS[lead.business_volume] || '#888'}18`, color: VOLUME_COLORS[lead.business_volume] || '#888' }}>
                          {lead.business_volume.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td data-label="Status">
                      <span className="scp-badge" style={{ background: `${STATUS_COLORS[lead.status] || '#888'}18`, color: STATUS_COLORS[lead.status] || '#888' }}>
                        {lead.status?.toUpperCase()}
                      </span>
                    </td>
                    <td data-label="Added By">{lead.created_by || '—'}</td>
                    <td data-label="Assigned To">{lead.assigned_to || <span className="scp-unassigned">Unassigned</span>}</td>
                    <td data-label="Actions">
                      <div className="scp-actions">
                        <button onClick={() => setViewingLead(lead)}>View</button>
                        <button onClick={() => setEditingLead(lead)}>Edit</button>
                        <button onClick={() => setAssigningLead(lead)}>Assign</button>
                        <button onClick={() => setSchedulingLead(lead)}>FollowUp</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="scp-pagination">
            <span>{page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddContactModal onClose={() => setShowAddModal(false)} onSaved={loadLeads} />
      )}
      {showBulkUpload && (
        <BulkUploadModal onClose={() => setShowBulkUpload(false)} onImported={loadLeads} />
      )}
      {viewingLead && (
        <ViewContactModal lead={viewingLead} onClose={() => setViewingLead(null)} onSaved={loadLeads} />
      )}
      {editingLead && (
        <EditContactModal lead={editingLead} onClose={() => setEditingLead(null)} onSaved={loadLeads} />
      )}
      {assigningLead && (
        <AssignContactModal lead={assigningLead} onClose={() => setAssigningLead(null)} onSaved={loadLeads} />
      )}
      {schedulingLead && (
        <ScheduleFollowUpModal
          open={!!schedulingLead}
          lead={{ leadId: schedulingLead.lead_id, leadName: schedulingLead.name }}
          currentUser={{ name: smUser?.name, userID: smUser?.userId }}
          onClose={() => setSchedulingLead(null)}
          onScheduled={loadLeads}
        />
      )}
    </div>
  )
}