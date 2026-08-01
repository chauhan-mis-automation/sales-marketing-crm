import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import AssignContactModal from './AssignContactModal'
import Modal from './Modal'
import './ViewContactModal.css'

const STATUS_COLORS = {
  New: '#0369a1', Assigned: '#6d28d9', Contacted: '#0d9488',
  Interested: '#b45309', 'Follow-up': '#b45309', Closed: '#059669', Lost: '#be123c',
}
const RATING_COLORS = { Pro: '#059669', Neutral: '#64748b', Anti: '#be123c', 'Yet to meet': '#0369a1' }
const VOLUME_COLORS = { High: '#be123c', Medium: '#b45309', Low: '#059669' }
const TYPE_COLORS = { Call: '#0369a1', Visit: '#b45309', WhatsApp: '#059669', Meeting: '#6d28d9', Demo: '#db2777' }

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dt) {
  if (!dt) return null
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function mapsLink(lat, lng) {
  if (lat == null || lng == null) return null
  return `https://maps.google.com/?q=${lat},${lng}`
}

function Field({ label, value, badge, color }) {
  if (!value) return null
  return (
    <div className="vcm-field">
      <div className="vcm-field-label">{label}</div>
      {badge ? (
        <span className="vcm-field-badge" style={{ background: `${color}18`, color }}>{value}</span>
      ) : (
        <div className="vcm-field-value">{value}</div>
      )}
    </div>
  )
}

export default function ViewContactModal({ lead, currentUser, onClose, onSaved }) {
  const [interactions, setInteractions] = useState([])
  const [expensesByInteraction, setExpensesByInteraction] = useState({})
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [showAssign, setShowAssign] = useState(false)

  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.lead_id])

  async function loadHistory() {
    setLoadingHistory(true)
    const { data: ints } = await supabase
      .from('sm_interactions')
      .select('*')
      .eq('lead_id', lead.lead_id)
      .order('created_date', { ascending: false })

    setInteractions(ints || [])

    const claimedIds = (ints || []).filter(i => i.claim_expense).map(i => i.interaction_id)
    if (claimedIds.length > 0) {
      const { data: exp } = await supabase.from('sm_expense_claims').select('*').in('interaction_id', claimedIds)
      const grouped = {}
      ;(exp || []).forEach(e => {
        if (!grouped[e.interaction_id]) grouped[e.interaction_id] = []
        grouped[e.interaction_id].push(e)
      })
      setExpensesByInteraction(grouped)
    } else {
      setExpensesByInteraction({})
    }
    setLoadingHistory(false)
  }

  function handleDownloadPDF() {
    const w = window.open('', '_blank')
    if (!w) { alert('Please allow popups to download the PDF'); return }

    const rows = [
      ['Lead ID', lead.lead_id], ['Status', lead.status], ['Phone', lead.phone], ['Alternate Phone', lead.alternate_phone],
      ['Email', lead.email], ['Company', lead.company], ['Designation', lead.designation], ['Source', lead.source],
      ['Business Rating', lead.rating], ['Industry', lead.industry], ['Category', lead.category], ['Region', lead.region],
      ['Business Volume', lead.business_volume], ['Assigned To', lead.assigned_to], ['Created By', lead.created_by],
      ['City / State', `${lead.city || ''} / ${lead.state || ''}`], ['Address', lead.address],
      ['Last Update', formatDate(lead.updated_date || lead.created_date)],
    ].filter(([, v]) => v)

    w.document.write(`
      <html><head><title>${lead.name} — Contact Details</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #1a1f17; }
        h1 { font-size: 20px; margin-bottom: 2px; }
        .sub { color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }
        td:first-child { font-weight: 700; width: 180px; color: #555; }
        .notes { background: #f7f8f5; padding: 12px; border-radius: 8px; font-size: 13px; }
      </style></head><body>
      <h1>${lead.name}</h1>
      <div class="sub">${lead.designation ? lead.designation + ' @ ' : ''}${lead.company || ''}</div>
      <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
      ${lead.notes ? `<div><strong>Internal Notes</strong><div class="notes">${lead.notes}</div></div>` : ''}
      </body></html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  return (
    <Modal
      title="Contact Details"
      onClose={onClose}
      width={900}
      footer={<button className="btn-modal-ghost" onClick={onClose}>Close</button>}
    >
      <div className="vcm-header">
        <div className="vcm-header-left">
          <div className="vcm-avatar">{lead.name?.charAt(0).toUpperCase()}</div>
          <div>
            <div className="vcm-name">{lead.name}</div>
            <div className="vcm-role">{lead.designation ? `${lead.designation} @ ` : ''}{lead.company}</div>
            <div className="vcm-badges">
              {lead.status && <span className="vcm-badge" style={{ background: `${STATUS_COLORS[lead.status] || '#888'}18`, color: STATUS_COLORS[lead.status] || '#888' }}>{lead.status.toUpperCase()}</span>}
              {lead.rating && <span className="vcm-badge" style={{ background: `${RATING_COLORS[lead.rating] || '#888'}18`, color: RATING_COLORS[lead.rating] || '#888' }}>{lead.rating.toUpperCase()}</span>}
              {lead.source && <span className="vcm-badge" style={{ background: 'rgba(3,105,161,.1)', color: '#0369a1' }}>{lead.source.toUpperCase()}</span>}
            </div>
          </div>
        </div>
        <div className="vcm-header-actions">
          <button className="vcm-action-btn" onClick={() => setShowAssign(true)}>Assign Contact</button>
          <button className="vcm-action-btn primary" onClick={handleDownloadPDF}><i className="fas fa-file-pdf"></i> Download PDF</button>
        </div>
      </div>

      <div className="vcm-info-grid">
        <div className="vcm-info-card">
          <div className="vcm-info-title">Contact &amp; Business Info</div>
          <div className="vcm-field-grid">
            <Field label="Phone" value={lead.phone} />
            <Field label="Alt Phone" value={lead.alternate_phone} />
            <Field label="Email" value={lead.email} />
            <Field label="Company" value={lead.company} />
            <Field label="Source" value={lead.source} badge color="#0369a1" />
            <Field label="Business Rating" value={lead.rating} badge color={RATING_COLORS[lead.rating]} />
            <Field label="Industry" value={lead.industry} />
            <Field label="Category" value={lead.category} />
            <Field label="Region" value={lead.region} />
            <Field label="Business Volume" value={lead.business_volume} badge color={VOLUME_COLORS[lead.business_volume]} />
          </div>
        </div>

        <div className="vcm-info-card">
          <div className="vcm-info-title">Assignment Info</div>
          <div className="vcm-field-grid">
            <Field label="Assigned To" value={lead.assigned_to || 'Unassigned'} />
            <Field label="Created By" value={lead.created_by} />
            <Field label="City / State" value={[lead.city, lead.state].filter(Boolean).join(' / ')} />
            <Field label="Address" value={lead.address} />
            <Field label="Last Update" value={formatDate(lead.updated_date || lead.created_date)} />
          </div>

          {lead.notes && (
            <>
              <div className="vcm-info-title" style={{ marginTop: 16 }}>Internal Notes</div>
              <div className="vcm-notes-box">{lead.notes}</div>
            </>
          )}
        </div>
      </div>

      <div className="vcm-history-section">
        <div className="vcm-history-title"><i className="fas fa-history"></i> Interaction History</div>

        {loadingHistory ? (
          <div className="vcm-history-empty"><i className="fas fa-spinner fa-spin"></i> Loading…</div>
        ) : interactions.length === 0 ? (
          <div className="vcm-history-empty">No interactions logged yet</div>
        ) : (
          <div className="vcm-timeline">
            {interactions.map(i => {
              const expenses = expensesByInteraction[i.interaction_id] || []
              const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
              const reachedLink = mapsLink(i.reached_lat, i.reached_lng)
              const closeLink = mapsLink(i.close_lat, i.close_lng)
              return (
                <div key={i.interaction_id} className="vcm-timeline-item">
                  <div className="vcm-timeline-dot"></div>
                  <div className="vcm-timeline-meta">
                    <span className="vcm-timeline-date">{formatDate(i.created_date)}</span>
                    <span className="vcm-badge" style={{ background: `${TYPE_COLORS[i.type] || '#888'}18`, color: TYPE_COLORS[i.type] || '#888' }}>{i.type?.toUpperCase()}</span>
                  </div>
                  {i.notes && <div className="vcm-timeline-notes">{i.notes}</div>}

                  {i.type === 'Visit' && (i.arrival_time || i.duration_minutes != null) && (
                    <div className="vcm-visit-meta">
                      {i.arrival_time && <span>REACHED: {formatDateTime(i.arrival_time)}</span>}
                      {i.duration_minutes != null && <span>MEETING: {i.duration_minutes} mins</span>}
                    </div>
                  )}

                  {i.client_response && <div className="vcm-timeline-line">Response: <strong>{i.client_response}</strong></div>}
                  {i.next_followup_date && <div className="vcm-timeline-line">Next: {formatDate(i.next_followup_date)} ({i.next_followup_type})</div>}
                  {reachedLink && <a href={reachedLink} target="_blank" rel="noreferrer" className="vcm-map-link"><i className="fas fa-map-marker-alt"></i> Reached Location Map</a>}
                  {closeLink && <a href={closeLink} target="_blank" rel="noreferrer" className="vcm-map-link"><i className="fas fa-flag-checkered"></i> Close Location Map</a>}

                  {i.claim_expense && expenses.length > 0 && (
                    <div className="vcm-expense-box">
                      <div className="vcm-expense-header">
                        <span><i className="fas fa-coins"></i> Expense Claimed</span>
                        <span className="vcm-expense-total">Rs. {total.toFixed(0)}</span>
                      </div>
                      {expenses.map(e => (
                        <div key={e.id} className="vcm-expense-row">
                          <span>{e.category}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="vcm-expense-amount">Rs. {Number(e.amount).toFixed(0)}</span>
                            {e.receipt_url && <a href={e.receipt_url} target="_blank" rel="noreferrer" className="vcm-view-file-btn"><i className="fas fa-file"></i> View File</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAssign && (
        <AssignContactModal
          lead={{ id: lead.id, lead_id: lead.lead_id, name: lead.name, company: lead.company, assigned_to: lead.assigned_to, status: lead.status }}
          onClose={() => setShowAssign(false)}
          onSaved={() => { onSaved?.(); }}
        />
      )}
    </Modal>
  )
}
