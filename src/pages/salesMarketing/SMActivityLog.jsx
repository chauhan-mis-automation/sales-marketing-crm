import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import './SMActivityLog.css'

const ROLE_COLORS = { Admin: '#be123c', Sales: '#4a5c40', BackOffice: '#b8860b', Marketing: '#4f46e5' }

const ACTION_COLORS = {
  ADD_LEAD: '#2471a3',
  ASSIGN_LEAD: '#6d28d9',
  LOG_INTERACTION: '#0d9488',
  LOG_VISIT: '#b8860b',
  ADD_PROJECT: '#ca8a04',
  EDIT_PROJECT: '#ca8a04',
  ADD_USER: '#2d7a47',
  ACTIVATE_USER: '#2d7a47',
  DEACTIVATE_USER: '#be123c',
}

function fmtDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function SMActivityLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('All')

  useEffect(() => {
    loadLogs()
  }, [])

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('sm_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    setLogs(data || [])
    setLoading(false)
  }

  const modules = ['All', ...new Set(logs.map(l => l.module).filter(Boolean))]

  const filtered = logs.filter(l => {
    const matchModule = moduleFilter === 'All' || l.module === moduleFilter
    const s = search.toLowerCase()
    const matchSearch = !s ||
      (l.user_name || '').toLowerCase().includes(s) ||
      (l.lead_name || '').toLowerCase().includes(s) ||
      (l.details || '').toLowerCase().includes(s) ||
      (l.action || '').toLowerCase().includes(s)
    return matchModule && matchSearch
  })

  return (
    <div className="fade-in">
      <div className="sal-header">
        <div>
          <h1 className="sal-title">Activity Log <span className="sal-count">({filtered.length})</span></h1>
          <div className="sal-subtitle">Full audit trail of actions taken across the CRM</div>
        </div>
        <button className="sal-refresh-btn" onClick={loadLogs}>
          <i className="fas fa-sync-alt"></i> Refresh
        </button>
      </div>

      <div className="sal-filters">
        <div className="sal-search">
          <i className="fas fa-search"></i>
          <input placeholder="Search user, contact, details…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}>
          {modules.map(m => <option key={m} value={m}>{m === 'All' ? 'All Modules' : m}</option>)}
        </select>
      </div>

      <div className="sal-card">
        <div className="sal-table-wrap">
          <table className="sal-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Module</th>
                <th>Contact</th>
                <th>Details</th>
                <th>Location</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="sal-empty"><i className="fas fa-spinner fa-spin"></i> Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="sal-empty"><div className="sal-empty-icon">📋</div>No activity recorded yet</td></tr>
              ) : (
                filtered.map(l => {
                  const roleColor = ROLE_COLORS[l.role] || '#4a5c40'
                  const actionColor = ACTION_COLORS[l.action] || '#4a5c40'
                  return (
                    <tr key={l.id}>
                      <td data-label="User"><strong>{l.user_name || '—'}</strong></td>
                      <td data-label="Role">
                        {l.role && <span className="sal-badge" style={{ background: `${roleColor}18`, color: roleColor }}>{l.role}</span>}
                      </td>
                      <td data-label="Action">
                        <span className="sal-badge mono" style={{ background: `${actionColor}18`, color: actionColor }}>{l.action}</span>
                      </td>
                      <td data-label="Module">{l.module}</td>
                      <td data-label="Contact">{l.lead_name || '—'}</td>
                      <td data-label="Details" className="sal-details">{l.details || '—'}</td>
                      <td data-label="Location">
                        {l.location && l.latitude && l.longitude ? (
                          <a href={`https://maps.google.com/?q=${l.latitude},${l.longitude}`} target="_blank" rel="noreferrer" className="sal-map-link">
                            <i className="fas fa-map-marker-alt"></i> View
                          </a>
                        ) : '—'}
                      </td>
                      <td data-label="Time" className="sal-date">{fmtDate(l.created_at)}</td>
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
