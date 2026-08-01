import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useDropdownData } from '../lib/useDropdownData'
import { useAuth } from '../context/AuthContext'
import EditEnquiryModal from '../components/EditEnquiryModal'
import './AllEnquiries.css'

function stageBadgeClass(stage) {
  const s = (stage || '').toLowerCase()
  if (s.includes('won')) return 'b-emerald'
  if (s.includes('lost')) return 'b-rose'
  if (s.includes('flowchart')) return 'b-purple'
  if (s.includes('quotation')) return 'b-purple'
  if (s.includes('drawing')) return 'b-teal'
  if (s.includes('assign') || s.includes('received')) return 'b-sky'
  if (s.includes('follow')) return 'b-amber'
  return 'b-gray'
}

function statusBadgeClass(status) {
  const s = (status || '').toLowerCase()
  if (s === 'won') return 'b-emerald'
  if (s === 'lost') return 'b-rose'
  return 'b-teal'
}

export default function AllEnquiries() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { enquirySource, customerCategory, products, stages, loading: dropdownsLoading } = useDropdownData()

  const [enquiries, setEnquiries] = useState([])
  const [editingEnquiry, setEditingEnquiry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fStage, setFStage] = useState('')
  const [fSource, setFSource] = useState('')
  const [fCategory, setFCategory] = useState('')
  const [fProduct, setFProduct] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    loadEnquiries()
  }, [])

  useEffect(() => {
    setPage(0)
  }, [search, fStatus, fStage, fSource, fCategory, fProduct, fromDate, toDate])

  async function loadEnquiries() {
    setLoading(true)
    const { data, error } = await supabase
      .from('enquiries')
      .select('*')
      .order('id', { ascending: false })

    if (!error && data) {
      setEnquiries(data)
    }
    setLoading(false)
  }

  function resetFilters() {
    setSearch('')
    setFStatus('')
    setFStage('')
    setFSource('')
    setFCategory('')
    setFProduct('')
    setFromDate('')
    setToDate('')
  }

  // Role ke hisaab se sirf relevant enquiries dikhao:
  // - superadmin, admin, followup → sab enquiries dikhengi
  // - frontend → sirf jo enquiries usko Frontend assign hui hain
  // - backend → sirf jo enquiries usko Backend assign hui hain
  const visibleEnquiries = useMemo(() => {
    const role = (user?.role || '').toLowerCase().trim()
    if (role === 'frontend') {
      return enquiries.filter(e => e.assign_to_frontend === user.name)
    }
    if (role === 'backend') {
      return enquiries.filter(e => e.assign_to_backend === user.name)
    }
    return enquiries
  }, [enquiries, user])

  const filteredEnquiries = useMemo(() => {
    let list = [...visibleEnquiries]
    const q = search.trim().toLowerCase()

    if (q) {
      list = list.filter(e =>
        (e.enquiry_id || '').toLowerCase().includes(q) ||
        (e.company_name || '').toLowerCase().includes(q) ||
        (e.contact_name || '').toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q) ||
        (e.phone || '').toLowerCase().includes(q) ||
        (e.project_name || '').toLowerCase().includes(q)
      )
    }

    if (fStatus) list = list.filter(e => e.status === fStatus)
    if (fStage) list = list.filter(e => e.current_stage === fStage)
    if (fSource) list = list.filter(e => e.source === fSource)
    if (fCategory) list = list.filter(e => e.customer_category === fCategory)
    if (fProduct) list = list.filter(e => (e.products || '').split(',').map(p => p.trim()).includes(fProduct))

    if (fromDate) list = list.filter(e => e.date >= fromDate)
    if (toDate) list = list.filter(e => e.date <= toDate)

    return list
  }, [visibleEnquiries, search, fStatus, fStage, fSource, fCategory, fProduct, fromDate, toDate])

  function truncate(str, n) {
    if (!str) return '—'
    return str.length > n ? str.slice(0, n) + '…' : str
  }

  return (
    <div>
      {/* ── Toolbar: search + filters ────────────────────── */}
      <div className="ae-toolbar">
        <div className="ae-search">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search ID, company, contact…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="ae-filter-select" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Won">Won</option>
          <option value="Lost">Lost</option>
        </select>

        <select className="ae-filter-select" value={fStage} onChange={e => setFStage(e.target.value)}>
          <option value="">All Stages</option>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className="ae-filter-select" value={fSource} onChange={e => setFSource(e.target.value)}>
          <option value="">All Sources</option>
          {enquirySource.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className="ae-filter-select" value={fCategory} onChange={e => setFCategory(e.target.value)}>
          <option value="">All Categories</option>
          {customerCategory.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select className="ae-filter-select" value={fProduct} onChange={e => setFProduct(e.target.value)}>
          <option value="">All Products</option>
          {products.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <button className="ae-reset-btn" onClick={resetFilters}>
          <i className="fas fa-times"></i> Reset
        </button>
      </div>

      {/* ── Date Range ───────────────────────────────────── */}
      <div className="ae-date-bar">
        <label>From</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        <label>To</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        <button className="btn-apply-date" onClick={loadEnquiries}>
          <i className="fas fa-search"></i> Apply Date
        </button>
        <button className="btn-clear-date" onClick={() => { setFromDate(''); setToDate('') }}>
          Clear Date
        </button>
      </div>

      {/* ── Table Card ───────────────────────────────────── */}
      <div className="ae-card">
        <div className="ae-card-header">
          <i className="fas fa-inbox" style={{ color: 'var(--green)' }}></i>
          <span className="ae-card-title">Enquiries</span>
          <span className="ae-count">({filteredEnquiries.length})</span>
        </div>

        {loading ? (
          <div className="ae-loading">
            <i className="fas fa-spinner fa-spin"></i> Loading enquiries…
          </div>
        ) : filteredEnquiries.length === 0 ? (
          <div className="ae-empty">
            <i className="fas fa-inbox"></i>
            <p>No enquiries found</p>
          </div>
        ) : (
          <div className="ae-table-wrap">
            <table className="ae-table">
              <thead>
                <tr>
                  <th>Enq. ID</th>
                  <th>Date</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Mobile</th>
                  <th>Location</th>
                  <th>Category</th>
                  <th>Source</th>
                  <th>Frontend</th>
                  <th>Backend</th>
                  <th>Project Name</th>
                  <th>Products</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnquiries.slice(page * 10, page * 10 + 10).map(e => (
                  <tr key={e.id}>
                    <td data-label="Enq. ID"><span className="ae-id">{e.enquiry_id}</span></td>
                    <td data-label="Date"><span className="ae-mono">{e.date}</span></td>
                    <td data-label="Company"><span className="ae-company">{e.company_name}</span></td>
                    <td data-label="Contact">{e.contact_name}</td>
                    <td data-label="Mobile"><span className="ae-mono">{e.country_code} {e.phone}</span></td>
                    <td data-label="Location" className="wrap-cell">{truncate(e.location, 22)}</td>
                    <td data-label="Category">
                      {e.customer_category && <span className="badge b-gray">{e.customer_category}</span>}
                    </td>
                    <td data-label="Source">
                      {e.source && <span className="badge b-sky">{e.source}</span>}
                    </td>
                    <td data-label="Frontend">{e.assign_to_frontend || '—'}</td>
                    <td data-label="Backend">{e.assign_to_backend || '—'}</td>
                    <td data-label="Project Name">{e.project_name || '—'}</td>
                    <td data-label="Products" className="wrap-cell">{truncate(e.products, 40)}</td>
                    <td data-label="Stage">
                      <span className={`badge ${stageBadgeClass(e.current_stage)}`}>{e.current_stage || '—'}</span>
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${statusBadgeClass(e.status)}`}>{e.status || '—'}</span>
                    </td>
                    <td data-label="Action">
                      <div className="ae-actions">
                        <button className="ae-icon-btn" title="View" onClick={() => navigate(`/enquiries/${e.enquiry_id}`)}>
                          <i className="fas fa-eye"></i>
                        </button>
                        <button className="ae-icon-btn edit" title="Edit" onClick={() => setEditingEnquiry(e)}>
                          <i className="fas fa-pencil-alt"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEnquiries.length > 10 && (
              <div className="ae-pagination">
                <span>{page * 10 + 1}–{Math.min(page * 10 + 10, filteredEnquiries.length)} of {filteredEnquiries.length}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="ae-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  <button className="ae-page-btn" disabled={(page + 1) * 10 >= filteredEnquiries.length} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {editingEnquiry && (
        <EditEnquiryModal
          enquiry={editingEnquiry}
          onClose={() => setEditingEnquiry(null)}
          onSaved={loadEnquiries}
        />
      )}
    </div>
  )
}