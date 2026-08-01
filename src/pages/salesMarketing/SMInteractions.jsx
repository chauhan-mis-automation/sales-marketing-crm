import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import './SMInteractions.css'

const TYPE_COLORS = {
  Call: '#2471a3',
  WhatsApp: '#1a8a40',
  Meeting: '#6d28d9',
  Visit: '#b8860b',
  Email: '#0369a1',
  Demo: '#d35400',
}

const RESPONSE_COLORS = {
  Interested: '#2d7a47',
  'Not Interested': '#be123c',
}

function fmtDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function SMInteractions() {
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')

  useEffect(() => {
    loadInteractions()
  }, [])

  async function loadInteractions() {
    setLoading(true)
    const { data } = await supabase
      .from('sm_interactions')
      .select('*')
      .order('created_date', { ascending: false })
      .limit(500)
    setInteractions(data || [])
    setLoading(false)
  }

  const filtered = interactions.filter(i => {
    const matchType = typeFilter === 'All' || i.type === typeFilter
    const s = search.toLowerCase()
    const matchSearch = !s ||
      (i.lead_name || '').toLowerCase().includes(s) ||
      (i.sales_person || '').toLowerCase().includes(s) ||
      (i.notes || '').toLowerCase().includes(s)
    return matchType && matchSearch
  })

  return (
    <div className="fade-in">
      <div className="sin-header">
        <div>
          <h1 className="sin-title">All Interactions <span className="sin-count">({filtered.length})</span></h1>
          <div className="sin-subtitle">Every call, visit, and follow-up logged across the team</div>
        </div>
      </div>

      <div className="sin-filters">
        <div className="sin-search">
          <i className="fas fa-search"></i>
          <input placeholder="Search contact, sales person, notes…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="All">All Types</option>
          {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="sin-card">
        <div className="sin-table-wrap">
          <table className="sin-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Type</th>
                <th>Sales Person</th>
                <th>Notes</th>
                <th>Client Response</th>
                <th>Next Follow-up</th>
                <th>Location</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="sin-empty"><i className="fas fa-spinner fa-spin"></i> Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="sin-empty"><div className="sin-empty-icon">📞</div>No interactions yet</td></tr>
              ) : (
                filtered.map(i => {
                  const typeColor = TYPE_COLORS[i.type] || '#4a5c40'
                  const responseColor = RESPONSE_COLORS[i.client_response] || '#8a9480'
                  const mapLoc = i.type === 'Visit' && i.reached_lat && i.reached_lng ? { lat: i.reached_lat, lng: i.reached_lng } : null
                  return (
                    <tr key={i.id}>
                      <td data-label="Contact"><strong>{i.lead_name}</strong></td>
                      <td data-label="Type">
                        <span className="sin-badge" style={{ background: `${typeColor}18`, color: typeColor }}>{i.type}</span>
                      </td>
                      <td data-label="Sales Person">{i.sales_person}</td>
                      <td data-label="Notes" className="sin-notes">{i.notes || '—'}</td>
                      <td data-label="Client Response">
                        {i.client_response ? (
                          <span className="sin-badge" style={{ background: `${responseColor}18`, color: responseColor }}>{i.client_response}</span>
                        ) : '—'}
                      </td>
                      <td data-label="Next Follow-up">
                        {i.next_followup_date ? (
                          <span>{fmtDate(i.next_followup_date)} <span className="sin-badge" style={{ background: 'rgba(36,113,163,.1)', color: '#2471a3' }}>{i.next_followup_type || 'Call'}</span></span>
                        ) : '—'}
                      </td>
                      <td data-label="Location">
                        {mapLoc ? (
                          <a href={`https://maps.google.com/?q=${mapLoc.lat},${mapLoc.lng}`} target="_blank" rel="noreferrer" className="sin-map-link">
                            <i className="fas fa-map-marker-alt"></i> View Map
                          </a>
                        ) : '—'}
                      </td>
                      <td data-label="Date" className="sin-date">{fmtDate(i.created_date)}</td>
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
