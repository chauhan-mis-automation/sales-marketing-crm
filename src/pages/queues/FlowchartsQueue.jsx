import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { formatDateDisplay } from '../../lib/dateHelpers'
import { latestPerEnquiry, queueStatusBadgeClass } from '../../lib/queueHelpers'
import './QueuePages.css'

export default function FlowchartsQueue() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const { data: fcRows } = await supabase.from('flowchart_tasks').select('*')
    const { data: enqRows } = await supabase.from('enquiries').select('*').eq('status', 'Active')

    const enqMap = {}
    ;(enqRows || []).forEach(e => { enqMap[e.enquiry_id] = e })

    let pending = latestPerEnquiry(fcRows).filter(t => t.status !== 'Client Approved' && enqMap[t.enquiry_id])

    if (user?.role === 'backend') {
      pending = pending.filter(t => enqMap[t.enquiry_id]?.assign_to_backend === user.name)
    }

    const merged = pending
      .map(t => ({ task: t, enquiry: enqMap[t.enquiry_id] }))
      .sort((a, b) => new Date(b.task.assigned_date) - new Date(a.task.assigned_date))

    setRows(merged)
    setLoading(false)
  }

  return (
    <div className="qp-wrap">
      <p className="qp-subtitle">Enquiries with pending flowchart work — sent to client, confirmation still pending</p>

      <div className="qp-card">
        <div className="qp-card-header">
          <div className="qp-card-title">🗂 Flowchart Queue <span className="qp-count-sm">({rows.length})</span></div>
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
                <th>Frontend</th>
                <th>Backend</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}><div className="qp-loading">Loading…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="qp-empty">
                    <i className="fas fa-check-circle"></i>
                    <p>No flowchart work pending! 🎉</p>
                  </div>
                </td></tr>
              ) : (
                rows.map(({ task, enquiry }) => (
                  <tr key={task.id} onClick={() => navigate(`/enquiries/${enquiry.enquiry_id}`)}>
                    <td data-label="ID"><span className="qp-id">{enquiry.enquiry_id}</span></td>
                    <td data-label="Company"><span className="qp-company">{enquiry.company_name || '—'}</span></td>
                    <td data-label="Contact">{enquiry.contact_name || '—'}</td>
                    <td data-label="Version"><span className="qp-mono">{task.version || '—'}</span></td>
                    <td data-label="Status"><span className={`qp-badge ${queueStatusBadgeClass(task.status)}`}>{task.status}</span></td>
                    <td data-label="Frontend">{enquiry.assign_to_frontend || '—'}</td>
                    <td data-label="Backend">{enquiry.assign_to_backend || '—'}</td>
                    <td data-label="Date"><span className="qp-mono">{formatDateDisplay(task.assigned_date)}</span></td>
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
