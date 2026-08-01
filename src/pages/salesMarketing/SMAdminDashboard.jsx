import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useSMAuth } from '../../context/SMAuthContext'
import TypewriterText from '../../components/TypewriterText'
import AddContactModal from '../../components/AddContactModal'
import SourceDetailModal from '../../components/SourceDetailModal'
import './SMDashboards.css'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function SMAdminDashboard() {
  const { smUser } = useSMAuth()
  const [leads, setLeads] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [viewingSource, setViewingSource] = useState(null)
  const [activityDate, setActivityDate] = useState(todayStr())

  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: leadRows }, { data: intRows }] = await Promise.all([
      supabase.from('sm_leads').select('*'),
      supabase.from('sm_interactions').select('*').order('created_date', { ascending: false }),
    ])
    setLeads(leadRows || [])
    setInteractions(intRows || [])
    setLoading(false)
  }

  const totalContacts = leads.length
  const unassignedCount = leads.filter(l => !l.assigned_to || l.assigned_to.trim() === '').length

  const scorecard = useMemo(() => {
    const byPerson = {}
    leads.forEach(l => {
      if (!l.assigned_to) return
      if (!byPerson[l.assigned_to]) byPerson[l.assigned_to] = { name: l.assigned_to, total: 0, closed: 0 }
      byPerson[l.assigned_to].total++
      if (l.status === 'Closed') byPerson[l.assigned_to].closed++
    })
    return Object.values(byPerson)
      .map(p => ({ ...p, kpiScore: p.total > 0 ? Math.round((p.closed / p.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
  }, [leads])

  const contactSources = useMemo(() => {
    const counts = {}
    leads.forEach(l => {
      const src = l.source || 'Unknown'
      counts[src] = (counts[src] || 0) + 1
    })
    return Object.entries(counts)
      .map(([source, count]) => ({ source, count, pct: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
  }, [leads, totalContacts])

  const dayActivity = useMemo(() => {
    return interactions.filter(i => (i.created_date || '').slice(0, 10) === activityDate)
  }, [interactions, activityDate])

  function kpiColor(score) {
    if (score >= 80) return '#059669'
    if (score >= 50) return '#b45309'
    return '#be123c'
  }

  return (
    <div className="fade-in">
      <div className="smd-top-row">
        <div>
          <h1 className="smd-greeting"><TypewriterText text={`Welcome Back, ${smUser?.name}!`} /> 👋</h1>
          <p className="smd-date">{dateLabel}</p>
        </div>
        <button className="smd-add-btn" onClick={() => setShowAddModal(true)}>
          <i className="fas fa-plus"></i> Add New Contact
        </button>
      </div>

      <div className="smd-stat-grid">
        <div className="smd-stat-card">
          <div className="smd-stat-icon purple"><i className="fas fa-users"></i></div>
          <div className="smd-stat-value">{loading ? '—' : totalContacts}</div>
          <div className="smd-stat-label">Total Contacts</div>
        </div>
        <div className="smd-stat-card">
          <div className="smd-stat-icon amber"><i className="fas fa-inbox"></i></div>
          <div className="smd-stat-value">{loading ? '—' : unassignedCount}</div>
          <div className="smd-stat-label">Unassigned</div>
        </div>
      </div>

      <div className="smd-card">
        <div className="smd-card-title">User Performance Scorecard (KPI Based)</div>
        <div className="smd-table-wrap">
          <table className="smd-table">
            <thead>
              <tr><th>Sales Person</th><th>Total Assigned</th><th>Overall KPI Score</th></tr>
            </thead>
            <tbody>
              {scorecard.length === 0 ? (
                <tr><td colSpan={3} className="smd-empty-row">No assignments yet</td></tr>
              ) : scorecard.map(p => (
                <tr key={p.name}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.total}</td>
                  <td>
                    <div className="smd-kpi-row">
                      <div className="smd-kpi-bar"><div className="smd-kpi-fill" style={{ width: `${p.kpiScore}%`, background: kpiColor(p.kpiScore) }}></div></div>
                      <span style={{ color: kpiColor(p.kpiScore), fontWeight: 800, fontSize: 12, minWidth: 50 }}>{p.kpiScore} / 100</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="smd-card">
        <div className="smd-card-title">Contact Sources</div>
        <div className="smd-sources-list">
          {contactSources.length === 0 ? (
            <p className="smd-empty-row">No contacts yet</p>
          ) : contactSources.map(s => (
            <div key={s.source} className="smd-source-row">
              <div className="smd-source-top">
                <span className="smd-source-name">{s.source}</span>
                <div className="smd-source-right">
                  <span className="smd-source-count">{s.count} contacts ({s.pct}%)</span>
                  <button className="smd-view-btn" onClick={() => setViewingSource(s.source)}>View →</button>
                </div>
              </div>
              <div className="smd-source-bar"><div className="smd-source-fill" style={{ width: `${s.pct}%` }}></div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="smd-card">
        <div className="smd-activity-header">
          <div className="smd-card-title" style={{ marginBottom: 0 }}>Daily Activity Summary</div>
          <input type="date" value={activityDate} onChange={e => setActivityDate(e.target.value)} className="smd-date-input" />
        </div>
        {dayActivity.length === 0 ? (
          <div className="smd-empty-activity">
            <div className="smd-empty-emoji">🙌</div>
            <p>No activity recorded for this date.</p>
          </div>
        ) : (
          <div className="smd-activity-list">
            {dayActivity.map(a => (
              <div key={a.interaction_id} className="smd-activity-item">
                <i className={`fas ${a.type === 'Visit' ? 'fa-map-marker-alt' : 'fa-phone'}`}></i>
                <div>
                  <strong>{a.lead_name}</strong> — {a.type} by {a.sales_person}
                  {a.notes && <div className="smd-activity-notes">{a.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddContactModal onClose={() => setShowAddModal(false)} onSaved={loadData} />
      )}
      {viewingSource && (
        <SourceDetailModal source={viewingSource} leads={leads} onClose={() => setViewingSource(null)} />
      )}
    </div>
  )
}
