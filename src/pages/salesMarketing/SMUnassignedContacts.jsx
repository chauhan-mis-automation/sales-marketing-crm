import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AssignContactModal from '../../components/AssignContactModal'
import './SMUnassignedContacts.css'

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SMUnassignedContacts() {
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState([])
  const [assigningLead, setAssigningLead] = useState(null)

  useEffect(() => {
    loadLeads()
  }, [])

  async function loadLeads() {
    setLoading(true)
    const { data } = await supabase
      .from('sm_leads')
      .select('*')
      .order('created_date', { ascending: false })
    const unassigned = (data || []).filter(l => !l.assigned_to || l.assigned_to.trim() === '')
    setLeads(unassigned)
    setLoading(false)
  }

  return (
    <div>
      <h1 className="uc-title">Unassigned Contacts ({leads.length})</h1>
      <p className="uc-subtitle">Assign these Contacts to your sales team</p>

      <div className="uc-card">
        <div className="uc-table-wrap">
          <table className="uc-table">
            <thead>
              <tr>
                <th>Contact</th><th>Phone</th><th>Company</th><th>Source</th>
                <th>Priority</th><th>Date Added</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="uc-empty"><i className="fas fa-spinner fa-spin"></i> Loading…</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={7} className="uc-empty"><i className="fas fa-check-circle"></i> No unassigned contacts — all caught up!</td></tr>
              ) : (
                leads.map(lead => (
                  <tr key={lead.id}>
                    <td>
                      <div className="uc-contact-cell">
                        <div className="uc-avatar">{lead.name?.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="uc-name">{lead.name}</div>
                          <div className="uc-email">{lead.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="uc-mono">{lead.phone || '—'}</td>
                    <td>{lead.company || '—'}</td>
                    <td>{lead.source && <span className="uc-source-badge">{lead.source.toUpperCase()}</span>}</td>
                    <td><span className={`uc-priority uc-priority-${(lead.priority || 'medium').toLowerCase()}`}>{lead.priority || 'Medium'}</span></td>
                    <td className="uc-mono">{formatDate(lead.created_date)}</td>
                    <td>
                      <button className="uc-assign-btn" onClick={() => setAssigningLead(lead)}>Assign</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {assigningLead && (
        <AssignContactModal lead={assigningLead} onClose={() => setAssigningLead(null)} onSaved={loadLeads} />
      )}
    </div>
  )
}
