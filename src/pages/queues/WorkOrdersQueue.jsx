import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { formatDateDisplay } from '../../lib/dateHelpers'
import { latestPerEnquiry } from '../../lib/queueHelpers'
import './QueuePages.css'

export default function WorkOrdersQueue() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const { data: woRows } = await supabase.from('work_orders').select('*')
    const { data: enqRows } = await supabase.from('enquiries').select('*')

    const enqMap = {}
    ;(enqRows || []).forEach(e => { enqMap[e.enquiry_id] = e })

    const pending = latestPerEnquiry(woRows).filter(t => t.status === 'Submitted for Review' && enqMap[t.enquiry_id])

    const merged = pending
      .map(t => ({ task: t, enquiry: enqMap[t.enquiry_id] }))
      .sort((a, b) => new Date(b.task.designer_submission_date) - new Date(a.task.designer_submission_date))

    setRows(merged)
    setLoading(false)
  }

  return (
    <div className="qp-wrap">
      <p className="qp-subtitle">Work Orders submitted for review — needs your approve/reject decision</p>

      <div className="qp-card">
        <div className="qp-card-header">
          <div className="qp-card-title">📋 Work Order Queue <span className="qp-count-sm">({rows.length})</span></div>
        </div>

        <div className="qp-table-wrap">
          <table className="qp-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Company</th>
                <th>Project</th>
                <th>Version</th>
                <th>Designer</th>
                <th>Submitted On</th>
                <th>Excel</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><div className="qp-loading">Loading…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="qp-empty">
                    <i className="fas fa-check-circle"></i>
                    <p>No Work Orders pending review! 🎉</p>
                  </div>
                </td></tr>
              ) : (
                rows.map(({ task, enquiry }) => (
                  <tr key={task.id} onClick={() => navigate(`/enquiries/${enquiry.enquiry_id}`)}>
                    <td data-label="ID"><span className="qp-id">{enquiry.enquiry_id}</span></td>
                    <td data-label="Company"><span className="qp-company">{enquiry.company_name || '—'}</span></td>
                    <td data-label="Project">{enquiry.project_name || '—'}</td>
                    <td data-label="Version"><span className="qp-mono">{task.version || '—'}</span></td>
                    <td data-label="Designer">{task.assigned_to || '—'}</td>
                    <td data-label="Submitted On"><span className="qp-mono">{formatDateDisplay(task.designer_submission_date)}</span></td>
                    <td data-label="Excel">
                      {task.excel_file_url ? (
                        <a href={task.excel_file_url} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} className="qp-badge qb-sky">
                          <i className="fas fa-file-excel"></i> View
                        </a>
                      ) : '—'}
                    </td>
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
