import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { formatDateDisplay } from '../../lib/dateHelpers'
import { todayISO } from '../../lib/queueHelpers'
import './QueuePages.css'

export default function FollowupsQueue() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('enquiries')
      .select('*')
      .eq('status', 'Active')
      .not('next_followup_date', 'is', null)
      .lte('next_followup_date', todayISO())
      .order('next_followup_date', { ascending: true })

    setRows(data || [])
    setLoading(false)
  }

  function overdueDays(dateStr) {
    const diff = Math.round((new Date(todayISO()) - new Date(dateStr)) / 86400000)
    return diff
  }

  const filteredRows = rows.filter(e => {
    const s = search.toLowerCase().trim()
    if (!s) return true
    return (e.company_name || '').toLowerCase().includes(s) ||
      (e.contact_name || '').toLowerCase().includes(s) ||
      (e.enquiry_id || '').toLowerCase().includes(s)
  })

  return (
    <div className="qp-wrap">
      <p className="qp-subtitle">Enquiries with overdue or due follow-ups</p>

      <div className="qp-card">
        <div className="qp-card-header">
          <div className="qp-card-title">🔔 Follow-up Queue <span className="qp-count-sm">({filteredRows.length})</span></div>
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
                <th>Stage</th>
                <th>Frontend</th>
                <th>Backend</th>
                <th>Follow-up Date</th>
                <th>Overdue</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}><div className="qp-loading">Loading…</div></td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="qp-empty">
                    <i className="fas fa-check-circle"></i>
                    <p>{rows.length === 0 ? 'No overdue follow-ups! 🎉' : 'No matches found'}</p>
                  </div>
                </td></tr>
              ) : (
                filteredRows.map(e => {
                  const days = overdueDays(e.next_followup_date)
                  return (
                    <tr key={e.id} className={days > 0 ? 'qp-row-overdue' : ''} onClick={() => navigate(`/enquiries/${e.enquiry_id}`)}>
                      <td data-label="ID"><span className="qp-id">{e.enquiry_id}</span></td>
                      <td data-label="Company"><span className="qp-company">{e.company_name || '—'}</span></td>
                      <td data-label="Contact">{e.contact_name || '—'}</td>
                      <td data-label="Stage">{e.current_stage || '—'}</td>
                      <td data-label="Frontend">{e.assign_to_frontend || '—'}</td>
                      <td data-label="Backend">{e.assign_to_backend || '—'}</td>
                      <td data-label="Follow-up Date"><span className="qp-mono">{formatDateDisplay(e.next_followup_date)}</span></td>
                      <td data-label="Overdue">
                        {days > 0 ? (
                          <span className="qp-badge qb-rose">{days} day{days !== 1 ? 's' : ''} overdue</span>
                        ) : (
                          <span className="qp-badge qb-amber">Due today</span>
                        )}
                      </td>
                      <td data-label="">
                        <button className="qp-open-btn" onClick={(ev) => { ev.stopPropagation(); navigate(`/enquiries/${e.enquiry_id}`) }}>
                          Open →
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}