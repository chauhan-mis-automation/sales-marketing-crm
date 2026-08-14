import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { formatDateDisplay } from '../../lib/dateHelpers'
import { latestPerEnquiry, queueStatusBadgeClass } from '../../lib/queueHelpers'
import './QueuePages.css'

export default function QuotationsQueue() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const { data: qtRows } = await supabase.from('quotation_versions').select('*')
    const { data: enqRows } = await supabase.from('enquiries').select('*').eq('status', 'Active')

    const enqMap = {}
    ;(enqRows || []).forEach(e => { enqMap[e.enquiry_id] = e })

    let latest = latestPerEnquiry(qtRows).filter(t => enqMap[t.enquiry_id])

    if (user?.role === 'backend') {
      latest = latest.filter(t => enqMap[t.enquiry_id]?.assign_to_backend === user.name)
    }

    const merged = latest
      .map(t => ({ task: t, enquiry: enqMap[t.enquiry_id] }))
      .sort((a, b) => new Date(b.task.shared_date) - new Date(a.task.shared_date))

    setRows(merged)
    setLoading(false)
  }

  const filteredRows = rows.filter(({ enquiry }) => {
    const s = search.toLowerCase().trim()
    if (!s) return true
    return (enquiry.company_name || '').toLowerCase().includes(s) ||
      (enquiry.contact_name || '').toLowerCase().includes(s) ||
      (enquiry.enquiry_id || '').toLowerCase().includes(s)
  })

  return (
    <div className="qp-wrap">
      <p className="qp-subtitle">Enquiries in quotation stage — a running log of quotations sent to clients</p>

      <div className="qp-card">
        <div className="qp-card-header">
          <div className="qp-card-title">💰 Quotation Queue <span className="qp-count-sm">({filteredRows.length})</span></div>
          <div className="qp-search">
            <i className="fas fa-search"></i>
            <input placeholder="Search company, contact, ID…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="qp-table-wrap">
          <table className="qp-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Company</th>
                <th>Contact</th>
                <th>Version</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Frontend</th>
                <th>Backend</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10}><div className="qp-loading">Loading…</div></td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={10}>
                  <div className="qp-empty">
                    <i className="fas fa-file-invoice-dollar"></i>
                    <p>{rows.length === 0 ? 'No quotations sent yet.' : 'No matches found'}</p>
                  </div>
                </td></tr>
              ) : (
                filteredRows.map(({ task, enquiry }) => (
                  <tr key={task.id} onClick={() => navigate(`/enquiries/${enquiry.enquiry_id}`)}>
                    <td data-label="ID"><span className="qp-id">{enquiry.enquiry_id}</span></td>
                    <td data-label="Company"><span className="qp-company">{enquiry.company_name || '—'}</span></td>
                    <td data-label="Contact">{enquiry.contact_name || '—'}</td>
                    <td data-label="Version"><span className="qp-mono">{task.version || '—'}</span></td>
                    <td data-label="Status"><span className={`qp-badge ${queueStatusBadgeClass(task.status)}`}>{task.status}</span></td>
                    <td data-label="Amount">{task.amount ? `₹${Number(task.amount).toLocaleString('en-IN')}` : '—'}</td>
                    <td data-label="Frontend">{enquiry.assign_to_frontend || '—'}</td>
                    <td data-label="Backend">{enquiry.assign_to_backend || '—'}</td>
                    <td data-label="Date"><span className="qp-mono">{formatDateDisplay(task.shared_date)}</span></td>
                    <td data-label="">
                      <button className="qp-open-btn" onClick={(ev) => { ev.stopPropagation(); navigate(`/enquiries/${enquiry.enquiry_id}`) }}>
                        Open →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}