import { useMemo } from 'react'
import Modal from './Modal'
import './SourceDetailModal.css'

const STATUS_ORDER = ['New', 'Assigned', 'Contacted', 'Interested', 'Follow-up', 'Closed', 'Lost']
const STATUS_COLORS = {
  New: '#0369a1', Assigned: '#6d28d9', Contacted: '#0d9488',
  Interested: '#b45309', 'Follow-up': '#b45309', Closed: '#059669', Lost: '#be123c',
}

export default function SourceDetailModal({ source, leads, onClose }) {
  const sourceLeads = useMemo(() => leads.filter(l => (l.source || 'Unknown') === source), [leads, source])

  const statusCounts = useMemo(() => {
    const counts = {}
    STATUS_ORDER.forEach(s => { counts[s] = 0 })
    sourceLeads.forEach(l => {
      const st = l.status || 'New'
      counts[st] = (counts[st] || 0) + 1
    })
    return counts
  }, [sourceLeads])

  const hotLeads = (statusCounts['Interested'] || 0) + (statusCounts['Follow-up'] || 0)
  const wonLeads = statusCounts['Closed'] || 0
  const lostLeads = statusCounts['Lost'] || 0

  const bySalesPerson = useMemo(() => {
    const counts = {}
    sourceLeads.forEach(l => {
      const sp = l.assigned_to || 'Unassigned'
      counts[sp] = (counts[sp] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [sourceLeads])

  const byCategory = useMemo(() => {
    const counts = {}
    sourceLeads.forEach(l => {
      const cat = l.category || 'Uncategorized'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [sourceLeads])

  const recentLeads = sourceLeads.slice(0, 10)
  const total = sourceLeads.length || 1

  return (
    <Modal title={null} onClose={onClose} width={860} footer={<button className="btn-modal-ghost" onClick={onClose}>Close</button>}>
      <div className="sdm-head">
        <div className="sdm-head-icon"><i className="fas fa-chart-pie"></i></div>
        <div>
          <div className="sdm-head-title">{source}</div>
          <div className="sdm-head-sub">Contact Source Analysis</div>
        </div>
      </div>

      <div className="sdm-stats">
        <div className="sdm-stat">
          <div className="sdm-stat-icon">👥</div>
          <div className="sdm-stat-value" style={{ color: '#2471a3' }}>{sourceLeads.length}</div>
          <div className="sdm-stat-label">Total Contacts</div>
        </div>
        <div className="sdm-stat">
          <div className="sdm-stat-icon">🔥</div>
          <div className="sdm-stat-value" style={{ color: '#b45309' }}>{hotLeads}</div>
          <div className="sdm-stat-label">Hot Leads</div>
        </div>
        <div className="sdm-stat">
          <div className="sdm-stat-icon">🏆</div>
          <div className="sdm-stat-value" style={{ color: '#059669' }}>{wonLeads}</div>
          <div className="sdm-stat-label">Orders Won</div>
        </div>
        <div className="sdm-stat">
          <div className="sdm-stat-icon">❌</div>
          <div className="sdm-stat-value" style={{ color: '#be123c' }}>{lostLeads}</div>
          <div className="sdm-stat-label">Lost</div>
        </div>
      </div>

      <div className="sdm-grid">
        <div className="sdm-panel">
          <div className="sdm-panel-title">Pipeline Breakdown</div>
          {STATUS_ORDER.map(st => {
            const count = statusCounts[st] || 0
            const pct = Math.round((count / total) * 100)
            const color = STATUS_COLORS[st]
            return (
              <div className="sdm-bar-row" key={st}>
                <div className="sdm-bar-top">
                  <span className="sdm-badge" style={{ background: `${color}18`, color }}>{st}</span>
                  <span className="sdm-bar-count" style={{ color }}>{count}</span>
                </div>
                <div className="sdm-bar-track"><div className="sdm-bar-fill" style={{ width: `${pct}%`, background: color }}></div></div>
              </div>
            )
          })}
        </div>

        <div className="sdm-panel">
          <div className="sdm-panel-title">By Sales Person</div>
          {bySalesPerson.length === 0 ? (
            <p className="sdm-empty-text">No assignments yet</p>
          ) : bySalesPerson.map(([name, count]) => {
            const pct = Math.round((count / total) * 100)
            return (
              <div className="sdm-bar-row" key={name}>
                <div className="sdm-bar-top">
                  <span className="sdm-sp-name">{name}</span>
                  <span className="sdm-bar-count">{count} ({pct}%)</span>
                </div>
                <div className="sdm-bar-track"><div className="sdm-bar-fill" style={{ width: `${pct}%`, background: '#4a5c40' }}></div></div>
              </div>
            )
          })}
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="sdm-panel" style={{ marginBottom: 16 }}>
          <div className="sdm-panel-title">By Category</div>
          <div className="sdm-category-row">
            {byCategory.map(([cat, count]) => (
              <div className="sdm-category-box" key={cat}>
                <div className="sdm-category-count">{count}</div>
                <div className="sdm-category-label">{cat}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sdm-panel">
        <div className="sdm-panel-title">Recent Contacts from {source}</div>
        {recentLeads.length === 0 ? (
          <p className="sdm-empty-text">No contacts from this source yet</p>
        ) : (
          <div className="sdm-table-wrap">
            <table className="sdm-table">
              <thead>
                <tr><th>Name</th><th>Company</th><th>Category</th><th>Status</th><th>Assigned To</th></tr>
              </thead>
              <tbody>
                {recentLeads.map(l => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.name}</strong>
                      {l.designation && <div className="sdm-sub">{l.designation}</div>}
                    </td>
                    <td>{l.company || '—'}</td>
                    <td>{l.category || '—'}</td>
                    <td><span className="sdm-badge" style={{ background: `${STATUS_COLORS[l.status] || '#888'}18`, color: STATUS_COLORS[l.status] || '#888' }}>{l.status}</span></td>
                    <td>{l.assigned_to || 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sourceLeads.length > 10 && (
          <div className="sdm-more-note">Showing 10 of {sourceLeads.length} contacts</div>
        )}
      </div>

      <div className="sdm-soon-banner">
        <span>🚀</span>
        <div>
          <div className="sdm-soon-title">Coming Soon</div>
          <div className="sdm-soon-text">Order value, quantity won, and revenue tracking per source will be added in a future update.</div>
        </div>
      </div>
    </Modal>
  )
}
