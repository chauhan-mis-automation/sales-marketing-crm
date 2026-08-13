import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import EnquirySectionCard from '../components/EnquirySectionCard'
import NextFlowActionCard from '../components/NextFlowActionCard'
import LogCallModal from '../components/LogCallModal'
import FlowchartModal from '../components/FlowchartModal'
import FlowchartDecisionModal from '../components/FlowchartDecisionModal'
import QuotationModal from '../components/QuotationModal'
import GADrawingModal from '../components/GADrawingModal'
import GADrawingAdminReviewModal from '../components/GADrawingAdminReviewModal'
import GADrawingClientActionModal from '../components/GADrawingClientActionModal'
import SendQuestionnaireModal from '../components/SendQuestionnaireModal'
import ReceiveQuestionnaireModal from '../components/ReceiveQuestionnaireModal'
import CloseEnquiryModal from '../components/CloseEnquiryModal'
import PurchaseOrderModal from '../components/PurchaseOrderModal'
import PurchaseOrderReviewModal from '../components/PurchaseOrderReviewModal'
import ApprovePOAssignWorkOrderModal from '../components/ApprovePOAssignWorkOrderModal'
import WorkOrderModal from '../components/WorkOrderModal'
import WorkOrderAdminReviewModal from '../components/WorkOrderAdminReviewModal'
import AssignTeamModal from '../components/AssignTeamModal'
import { hrsDiff, fmtHrs, DEFAULT_TAT_TARGETS, parseHrs } from '../lib/tatHelpers'
import { addBusinessDaysExcludingSunday, formatDateISO } from '../lib/dateHelpers'
import './EnquiryDetail.css'

// Parses a leading "[Question label: Yes/No]" marker out of a notes string
// (used for GA Drawing designer/admin confirmation checks) so it can be
// rendered as a clear badge instead of buried inline text.
function parseConfirmationNote(notes) {
  if (!notes) return { label: null, answer: null, rest: '' }
  const m = notes.match(/^\[(.+?):\s*(Yes|No)\]\s*([\s\S]*)$/)
  if (!m) return { label: null, answer: null, rest: notes }
  return { label: m[1], answer: m[2], rest: m[3] }
}

export default function EnquiryDetail() {
  const { enquiryId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [enquiry, setEnquiry] = useState(null)
  const [stageLogs, setStageLogs] = useState([])
  const [callHistory, setCallHistory] = useState([])
  const [callHistoryPage, setCallHistoryPage] = useState(0)
  const [flowchartTasks, setFlowchartTasks] = useState([])
  const [quotations, setQuotations] = useState([])
  const [gaDrawingTasks, setGaDrawingTasks] = useState([])
  const [questionnaires, setQuestionnaires] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [adminApprovalTarget, setAdminApprovalTarget] = useState(DEFAULT_TAT_TARGETS.adminApproval)
  const [loading, setLoading] = useState(true)

  const [showLogCallModal, setShowLogCallModal] = useState(false)
  const [showAssignTeamModal, setShowAssignTeamModal] = useState(false)
  const [showFlowchartModal, setShowFlowchartModal] = useState(false)
  const [showFlowchartDecisionModal, setShowFlowchartDecisionModal] = useState(false)
  const [flowchartIsRevision, setFlowchartIsRevision] = useState(false)
  const [showQuotationModal, setShowQuotationModal] = useState(false)
  const [showGADrawingModal, setShowGADrawingModal] = useState(false)
  const [showGAAdminReviewModal, setShowGAAdminReviewModal] = useState(false)
  const [showGAClientActionModal, setShowGAClientActionModal] = useState(false)
  const [selectedGATask, setSelectedGATask] = useState(null)
  const [showSendQModal, setShowSendQModal] = useState(false)
  const [showReceiveQModal, setShowReceiveQModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showPOModal, setShowPOModal] = useState(false)
  const [showPOReviewModal, setShowPOReviewModal] = useState(false)
  const [poReviewMode, setPoReviewMode] = useState('admin')
  const [showApprovePOModal, setShowApprovePOModal] = useState(false)
  const [poIsRevision, setPoIsRevision] = useState(false)
  const [showWOModal, setShowWOModal] = useState(false)
  const [showWOAdminReviewModal, setShowWOAdminReviewModal] = useState(false)
  const [selectedWOTask, setSelectedWOTask] = useState(null)
  const [woDecision, setWoDecision] = useState('approve')

  useEffect(() => {
    loadDetail()
  }, [enquiryId])

  async function loadDetail() {
    setLoading(true)

    const { data: enqData } = await supabase
      .from('enquiries')
      .select('*')
      .eq('enquiry_id', enquiryId)
      .single()

    const { data: logData } = await supabase
      .from('stage_logs')
      .select('*')
      .eq('enquiry_id', enquiryId)
      .order('id', { ascending: true })

    const { data: callData } = await supabase
      .from('call_history')
      .select('*')
      .eq('enquiry_id', enquiryId)
      .order('date', { ascending: false })

    const { data: fcData } = await supabase
      .from('flowchart_tasks')
      .select('*')
      .eq('enquiry_id', enquiryId)
      .order('assigned_date', { ascending: false })

    const { data: qtData } = await supabase
      .from('quotation_versions')
      .select('*')
      .eq('enquiry_id', enquiryId)
      .order('shared_date', { ascending: false })

    const { data: gaData } = await supabase
      .from('ga_drawing_tasks')
      .select('*')
      .eq('enquiry_id', enquiryId)
      .order('assigned_date', { ascending: false })

    const { data: qnData } = await supabase
      .from('questionnaire_rounds')
      .select('*')
      .eq('enquiry_id', enquiryId)
      .order('sent_date', { ascending: false })

    const { data: poData } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('enquiry_id', enquiryId)
      .order('upload_date', { ascending: false })

    const { data: woData } = await supabase
      .from('work_orders')
      .select('*')
      .eq('enquiry_id', enquiryId)
      .order('assigned_date', { ascending: false })

    const { data: ddData } = await supabase
      .from('dropdown_list')
      .select('tat_admin_approval')
      .order('id', { ascending: true })
      .limit(1)

    setAdminApprovalTarget(parseHrs(ddData?.[0]?.tat_admin_approval, DEFAULT_TAT_TARGETS.adminApproval))

    setEnquiry(enqData || null)
    setStageLogs(logData || [])
    setCallHistory(callData || [])
    setFlowchartTasks(fcData || [])
    setQuotations(qtData || [])
    setGaDrawingTasks(gaData || [])
    setQuestionnaires(qnData || [])
    setPurchaseOrders(poData || [])
    setWorkOrders(woData || [])
    setLoading(false)
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  function formatDateTime(dt) {
    if (!dt) return '—'
    const d = new Date(dt)
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  function notReady(feature) {
    alert(`${feature} — agle phase mein functional banega`)
  }

  if (loading) {
    return (
      <div className="ed-loading">
        <i className="fas fa-spinner fa-spin"></i>
        Loading enquiry…
      </div>
    )
  }

  if (!enquiry) {
    return (
      <div className="ed-empty">
        <i className="fas fa-exclamation-circle"></i>
        <p>Enquiry not found: {enquiryId}</p>
        <button className="ed-back-link" style={{ marginTop: 16 }} onClick={() => navigate('/enquiries')}>
          <i className="fas fa-arrow-left"></i> Back to All Enquiries
        </button>
      </div>
    )
  }

  const stageBadgeClass = (() => {
    const s = (enquiry.current_stage || '').toLowerCase()
    if (s.includes('won')) return 'b-emerald'
    if (s.includes('lost')) return 'b-rose'
    if (s.includes('flowchart') || s.includes('quotation')) return 'b-purple'
    if (s.includes('drawing')) return 'b-teal'
    if (s.includes('follow') || s.includes('revision')) return 'b-amber'
    return 'b-sky'
  })()

  const statusBadgeClass =
    enquiry.status === 'Won' ? 'b-emerald' :
    enquiry.status === 'Lost' ? 'b-rose' : 'b-teal'

  function taskStatusClass(status) {
    if (status === 'Approved by Admin' || status === 'Client Approved' || status === 'Approved') return 'b-emerald'
    if (status === 'Rejected by Admin' || status === 'Rejected') return 'b-rose'
    if (status === 'Shared with Client') return 'b-teal'
    if (status === 'Client Revision Requested') return 'b-amber'
    if (status === 'Submitted for Review') return 'b-sky'
    if (status === 'Revision') return 'b-amber'
    if (status === 'Received') return 'b-emerald'
    if (status === 'Sent') return 'b-amber'
    return 'b-purple'
  }

  const pendingQuestion = questionnaires.find(q => q.status === 'Sent')

  function handleReceivedClick() {
    if (!pendingQuestion) {
      alert('No pending questionnaire to mark as received')
      return
    }
    setShowReceiveQModal(true)
  }

  function handlePOClick() {
    if (enquiry.status !== 'Won') {
      alert('Please mark this enquiry as Won before uploading a Purchase Order')
      return
    }

    const role = (user?.role || '').toLowerCase().trim()
    const latestPO = purchaseOrders[0]
    const isReassignedReviewer = latestPO && latestPO.reassigned_to === user?.name && latestPO.status === 'Uploaded'

    if (isReassignedReviewer) {
      setPoReviewMode('authorized')
      setShowPOReviewModal(true)
      return
    }

    if ((role === 'admin' || role === 'superadmin') && latestPO && latestPO.status === 'Uploaded') {
      setPoReviewMode('admin')
      setShowPOReviewModal(true)
      return
    }

    setPoIsRevision(!!(latestPO && latestPO.status === 'Rejected'))
    setShowPOModal(true)
  }

  // "Flowchart" button click hone par role ke hisaab se sahi modal khulta hai
  function handleFlowchartClick() {
    const role = (user?.role || '').toLowerCase().trim()
    const latestTask = flowchartTasks[0] // sabse recent task (already desc order mein aata hai)

    const isFollowupSide = role === 'followup' || role === 'admin' || role === 'superadmin'

    if (isFollowupSide && latestTask && latestTask.status === 'Shared with Client') {
      // Client ka decision lena hai (Approve / Wants Changes)
      setShowFlowchartDecisionModal(true)
      return
    }

    if (role === 'followup' && (!latestTask || latestTask.status !== 'Shared with Client')) {
      alert('No flowchart pending your review right now.')
      return
    }

    // Backend (ya admin jab koi pending decision na ho) → Send/Resend view
    setFlowchartIsRevision(!!(latestTask && latestTask.status === 'Client Revision Requested'))
    setShowFlowchartModal(true)
  }

  function handleWOClick() {
    if (purchaseOrders.length === 0) {
      alert('Please upload a Purchase Order first')
      return
    }
    setShowWOModal(true)
  }

  // "GA Drawing" button click hone par role ke hisaab se sahi modal khulta hai
  function handleGADrawingClick() {
    const role = (user?.role || '').toLowerCase().trim()
    const latestGA = gaDrawingTasks[0]

    if ((role === 'admin' || role === 'superadmin') && latestGA && latestGA.status === 'Submitted for Review') {
      setSelectedGATask(latestGA)
      setShowGAAdminReviewModal(true)
      return
    }

    if (role === 'followup') {
      if (latestGA && (latestGA.status === 'Approved by Admin' || latestGA.status === 'Shared with Client')) {
        setSelectedGATask(latestGA)
        setShowGAClientActionModal(true)
        return
      }
      alert('No GA Drawing pending your review right now.')
      return
    }

    // Backend (ya admin jab koi pending review na ho) → naya assign karo
    setShowGADrawingModal(true)
  }

  return (
    <div>
      {/* Header */}
      <div className="ed-header">
        <div>
          <div className="ed-header-meta">{enquiry.enquiry_id} · {enquiry.date}</div>
          <div className="ed-header-company">{enquiry.company_name}</div>
          <div className="ed-header-contact">{enquiry.contact_name}</div>
          <div className="ed-header-badges">
            <span className={`badge ${stageBadgeClass}`}>{enquiry.current_stage || '—'}</span>
            <span className={`badge ${statusBadgeClass}`}>{enquiry.status || '—'}</span>
          </div>
        </div>

        <div className="ed-header-actions">
          <button className="btn-action" onClick={() => setShowLogCallModal(true)}>
            <i className="fas fa-phone"></i> Log Call
          </button>
          <button className="btn-action" onClick={() => setShowAssignTeamModal(true)}>
            <i className="fas fa-user-friends"></i> Assign Team
          </button>
          <button className="btn-action" onClick={handleFlowchartClick}>
            <i className="fas fa-project-diagram"></i> Flowchart
          </button>
          <button className="btn-action" onClick={() => setShowQuotationModal(true)}>
            <i className="fas fa-file-invoice-dollar"></i> Quotation
          </button>
          <button className="btn-action" onClick={() => handleGADrawingClick()}>
            <i className="fas fa-drafting-compass"></i> GA Drawing
          </button>
          <button className="btn-action" onClick={() => setShowCloseModal(true)}>
            <i className="fas fa-flag"></i> Close
          </button>
          <button className="btn-action" onClick={handlePOClick}>
            <i className="fas fa-file-contract"></i>{' '}
            {(() => {
              const role = (user?.role || '').toLowerCase().trim()
              const latestPO = purchaseOrders[0]
              const isReassignedReviewer = latestPO && latestPO.reassigned_to === user?.name && latestPO.status === 'Uploaded'
              const isAdminPending = (role === 'admin' || role === 'superadmin') && latestPO && latestPO.status === 'Uploaded'
              return (isReassignedReviewer || isAdminPending) ? 'Review PO' : 'Upload PO'
            })()}
          </button>
        </div>
      </div>

      {/* Backend user ko flow-guiding card dikhta hai */}
      {(user?.role || '').toLowerCase() === 'backend' && (
        <NextFlowActionCard
          onOpenQuestionnaire={() => setShowSendQModal(true)}
          onOpenFlowchart={handleFlowchartClick}
          onOpenQuotation={() => setShowQuotationModal(true)}
        />
      )}

      {/* Client Info */}
      <div className="ed-card">
        <div className="ed-card-header">
          <span className="ed-card-title">👤 Client Info</span>
        </div>
        <div className="ed-card-body">
          <div className="ed-detail-grid">
            <DetailItem label="Company" value={enquiry.company_name} />
            <DetailItem label="Contact" value={enquiry.contact_name} />
            <DetailItem label="Mobile" value={`${enquiry.country_code || ''} ${enquiry.phone || ''}`} />
            <DetailItem label="Email" value={enquiry.email} />
            <DetailItem label="City" value={enquiry.city} />
            <DetailItem label="State" value={enquiry.state} />
            <DetailItem label="Country" value={enquiry.country} />
            <DetailItem label="Category" value={enquiry.customer_category} />
            <DetailItem label="Source" value={enquiry.source} />
            <DetailItem label="Project" value={enquiry.project_name} />
            <DetailItem label="Consultant Make" value={enquiry.consultant_make} />
            <DetailItem label="Approved Makes" value={enquiry.approved_makes} />
          </div>

          {enquiry.attachment_url && (
            <>
              <hr className="ed-divider" />
              <div className="ed-label">Attachment</div>
              <div className="ed-attachments">
                {enquiry.attachment_url.split(',').map((url, i) => (
                  <a key={i} href={url.trim()} target="_blank" rel="noreferrer" className="ed-file-link">
                    <i className="fas fa-paperclip"></i> View Attachment
                  </a>
                ))}
              </div>
            </>
          )}

          {enquiry.cc_emails && (
            <>
              <hr className="ed-divider" />
              <div className="ed-label">CC Emails</div>
              <div className="ed-cc-chips">
                {enquiry.cc_emails.split(',').map((em, i) => (
                  em.trim() && (
                    <a key={i} href={`mailto:${em.trim()}`} className="ed-cc-chip">
                      <i className="fas fa-envelope"></i> {em.trim()}
                    </a>
                  )
                ))}
              </div>
            </>
          )}

          {enquiry.products && (
            <>
              <hr className="ed-divider" />
              <div className="ed-label">Products</div>
              <div className="ed-products-text">{enquiry.products}</div>
            </>
          )}

          <hr className="ed-divider" />
          <div className="ed-detail-grid">
            <DetailItem label="Frontend" value={enquiry.assign_to_frontend} accent="sky" />
            <DetailItem label="Backend" value={enquiry.assign_to_backend} accent="teal" />
          </div>
        </div>
      </div>

      {/* Two Column: Work Sections + Timeline */}
      <div className="ed-two-col">

        <div className="ed-left-col">

          <EnquirySectionCard
            icon="📞" title="Call History" count={callHistory.length}
            headerAction={<button className="ed-plus-btn" onClick={() => setShowLogCallModal(true)}><i className="fas fa-plus"></i></button>}
            emptyIcon="fa-phone-slash"
            emptyText={callHistory.length === 0 ? "No calls logged." : undefined}
          >
            {callHistory.length > 0 && (
              <>
                <div className="ed-callhist-list">
                  {callHistory.slice(callHistoryPage * 4, callHistoryPage * 4 + 4).map((call, idx) => (
                    <div key={call.id} className="ed-callhist-item" style={{ animationDelay: `${idx * 60}ms` }}>
                      <div className={`ed-callhist-icon ${call.call_type === 'Incoming' ? 'incoming' : 'outgoing'}`}>
                        <i className={`fas ${call.call_type === 'Incoming' ? 'fa-phone-volume' : 'fa-phone'}`}></i>
                      </div>
                      <div className="ed-callhist-body">
                        <div className="ed-callhist-top">
                          <span className={`badge ${call.call_type === 'Incoming' ? 'b-sky' : 'b-teal'}`}>
                            {call.call_type}
                          </span>
                          <span className="ed-callhist-by"><i className="fas fa-user"></i> {call.logged_by}</span>
                        </div>
                        <div className="ed-callhist-notes">{call.notes}</div>
                        {(call.next_action || call.followup_date) && (
                          <div className="ed-callhist-meta">
                            {call.next_action && <span><i className="fas fa-arrow-right"></i> {call.next_action}</span>}
                            {call.followup_date && (
                              <span className={`ed-callhist-followup ${call.followup_date < todayStr ? 'overdue' : call.followup_date === todayStr ? 'due-today' : ''}`}>
                                <i className="fas fa-calendar-check"></i> Next follow-up: {call.followup_date}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="ed-callhist-side">
                        <div className="ed-callhist-date">{formatDateTime(call.date)}</div>
                        {call.duration && (
                          <div className="ed-callhist-duration"><i className="fas fa-clock"></i> {call.duration} min</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {callHistory.length > 4 && (
                  <div className="ed-callhist-pagination">
                    <span>{callHistoryPage * 4 + 1}–{Math.min(callHistoryPage * 4 + 4, callHistory.length)} of {callHistory.length}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="ed-callhist-page-btn"
                        disabled={callHistoryPage === 0}
                        onClick={() => setCallHistoryPage(p => p - 1)}
                      >
                        ← Prev
                      </button>
                      <button
                        className="ed-callhist-page-btn"
                        disabled={(callHistoryPage + 1) * 4 >= callHistory.length}
                        onClick={() => setCallHistoryPage(p => p + 1)}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </EnquirySectionCard>

          <EnquirySectionCard
            icon="📐" title="GA Drawing Tasks" count={gaDrawingTasks.length}
            headerAction={<button className="ed-plus-btn" onClick={() => handleGADrawingClick()}><i className="fas fa-plus"></i></button>}
            emptyIcon="fa-drafting-compass"
            emptyText={gaDrawingTasks.length === 0 ? "No GA Drawing tasks assigned yet." : undefined}
          >
            {gaDrawingTasks.length > 0 && (
              <div className="ed-call-list">
                {gaDrawingTasks.map(task => {
                  const requestFileUrls = (task.request_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
                  const designerFileUrls = (task.designer_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
                  const adminRefUrls = (task.admin_reference_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
                  const clientRefUrls = (task.client_reference_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
                  const userRole = (user?.role || '').toLowerCase().trim()
                  const canReviewNow = (userRole === 'admin' || userRole === 'superadmin') && task.status === 'Submitted for Review'
                  const canTakeAction = userRole === 'followup' && (task.status === 'Approved by Admin' || task.status === 'Shared with Client')
                  return (
                    <div key={task.id} className="ed-call-item">
                      <div className="ed-call-top">
                        <span className="badge b-gray">{task.version}</span>
                        <span className={`badge ${taskStatusClass(task.status)}`}>{task.status}</span>
                        {task.revision_count > 0 && (
                          <span className="badge b-amber">Revision: {task.revision_count}</span>
                        )}
                      </div>
                      <div className="ed-call-notes">
                        Designer: <strong>{task.assigned_to}</strong>
                        {task.assigned_by && <span style={{ color: 'var(--muted)' }}> · Assigned by: {task.assigned_by}</span>}
                      </div>
                      <div className="ed-call-notes" style={{ marginTop: 2, color: 'var(--muted)', fontSize: 11.5 }}>
                        <i className="far fa-calendar"></i> Assigned on: {formatDateTime(task.assigned_date)}
                        {task.designer_submission_date && <> · Submitted: {formatDateTime(task.designer_submission_date)}</>}
                      </div>
                      {task.request_notes && (
                        <div className="ed-call-notes" style={{ marginTop: 4 }}>{task.request_notes}</div>
                      )}
                      {requestFileUrls.length > 0 && (
                        <div className="ed-call-meta">
                          {requestFileUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <i className="fas fa-paperclip"></i> Ref File {requestFileUrls.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      )}
                      {designerFileUrls.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div className="dd-section-label"><i className="fas fa-file-alt"></i> Designer Submitted File</div>
                          <div className="ed-call-meta">
                            {designerFileUrls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer">
                                <i className="fas fa-file-alt"></i> View Submitted File {designerFileUrls.length > 1 ? i + 1 : ''}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {task.designer_notes && (() => {
                        const { label, answer, rest } = parseConfirmationNote(task.designer_notes)
                        return (
                          <div style={{ marginTop: 10 }}>
                            {label && (
                              <div className={`ed-confirm-badge ${answer === 'Yes' ? 'ed-confirm-yes' : 'ed-confirm-no'}`}>
                                {answer === 'Yes' ? '✅' : '❌'} {label}: <strong>{answer}</strong>
                              </div>
                            )}
                            {rest && (
                              <div className="ed-note-callout" style={{ marginTop: label ? 6 : 0 }}>
                                <span className="ed-note-label">Designer Remarks</span>
                                {rest}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {task.status === 'Client Approved' && task.assigned_date && task.client_approved_date && (() => {
                        const designerTat = hrsDiff(task.assigned_date, task.designer_submission_date)
                        const reviewTat = task.designer_submission_date ? hrsDiff(task.designer_submission_date, task.client_approved_date) : null
                        const totalTat = hrsDiff(task.assigned_date, task.client_approved_date)
                        const adminTat = task.designer_submission_date && task.admin_review_date
                          ? hrsDiff(task.designer_submission_date, task.admin_review_date) : null
                        return (
                          <div className="ed-tat-closed-box">
                            <div className="ed-tat-closed-title">
                              <i className="fas fa-check-circle"></i> TAT CLOSED — CLIENT APPROVED
                            </div>
                            <div className="ed-tat-closed-dates">
                              <div><span>ASSIGNED ON</span><strong>{formatDateTime(task.assigned_date)}</strong></div>
                              <div><span>SUBMITTED ON</span><strong>{formatDateTime(task.designer_submission_date)}</strong></div>
                              <div><span>CLIENT APPROVED ON</span><strong>{formatDateTime(task.client_approved_date)}</strong></div>
                            </div>
                            <div className="ed-tat-closed-metrics">
                              <div className="ed-tat-metric purple">
                                <div className="ed-tat-metric-val">{designerTat !== null ? fmtHrs(designerTat) : '—'}</div>
                                <div className="ed-tat-metric-lbl">Designer TAT</div>
                                <div className="ed-tat-metric-sub">Assign → Submit</div>
                              </div>
                              <div className="ed-tat-metric sky">
                                <div className="ed-tat-metric-val">{reviewTat !== null ? fmtHrs(reviewTat) : '—'}</div>
                                <div className="ed-tat-metric-lbl">Review TAT</div>
                                <div className="ed-tat-metric-sub">Submit → Client Approved</div>
                              </div>
                              <div className="ed-tat-metric green">
                                <div className="ed-tat-metric-val">{totalTat !== null ? fmtHrs(totalTat) : '—'}</div>
                                <div className="ed-tat-metric-lbl">Total TAT</div>
                                <div className="ed-tat-metric-sub">Assign → Client Approved</div>
                              </div>
                            </div>
                            {task.revision_count > 0 && (
                              <div className="ed-tat-revision-note">
                                <i className="fas fa-sync-alt"></i> {task.revision_count} revision(s) included in total TAT
                              </div>
                            )}
                            {adminTat !== null && (
                              <div className="ed-tat-admin-approval">
                                <div className="ed-tat-admin-lbl">
                                  <i className="fas fa-user-shield"></i> Admin Approval TAT (Submit → Admin Review)
                                </div>
                                <div className="ed-tat-admin-val">{fmtHrs(adminTat)}</div>
                                <div className="ed-tat-admin-target">Target: {adminApprovalTarget} hrs</div>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {task.admin_review_notes && (() => {
                        const { label, answer, rest } = parseConfirmationNote(task.admin_review_notes)
                        return (
                          <div style={{ marginTop: 10 }}>
                            {label && (
                              <div className={`ed-confirm-badge ${answer === 'Yes' ? 'ed-confirm-yes' : 'ed-confirm-no'}`}>
                                {answer === 'Yes' ? '✅' : '❌'} {label}: <strong>{answer}</strong>
                              </div>
                            )}
                            {rest && (
                              <div className="ed-note-callout ed-note-admin" style={{ marginTop: label ? 6 : 0 }}>
                                <span className="ed-note-label">Admin Remarks</span>
                                {rest}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                      {adminRefUrls.length > 0 && (
                        <div className="ed-call-meta">
                          {adminRefUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <i className="fas fa-paperclip"></i> Admin Ref File {adminRefUrls.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      )}
                      {task.client_feedback && (
                        <div className="ed-note-callout ed-note-client">
                          <span className="ed-note-label">Client Feedback</span>
                          {task.client_feedback}
                        </div>
                      )}
                      {clientRefUrls.length > 0 && (
                        <div className="ed-call-meta">
                          {clientRefUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <i className="fas fa-paperclip"></i> Client Ref File {clientRefUrls.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      )}
                      {canReviewNow && (
                        <button
                          className="ed-review-now-btn"
                          onClick={() => { setSelectedGATask(task); setShowGAAdminReviewModal(true) }}
                        >
                          <i className="fas fa-search"></i> Review Now
                        </button>
                      )}
                      {canTakeAction && (
                        <button
                          className="ed-review-now-btn"
                          onClick={() => { setSelectedGATask(task); setShowGAClientActionModal(true) }}
                        >
                          <i className="fas fa-tasks"></i> Take Action
                        </button>
                      )}
                      <div className="ed-call-loggedby">
                        <i className="fas fa-calendar"></i> {formatDateTime(task.assigned_date)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </EnquirySectionCard>

          <EnquirySectionCard
            icon="📋" title="Questionnaire" count={questionnaires.length}
            headerAction={
              <>
                <button className="ed-mini-btn" onClick={() => setShowSendQModal(true)}>
                  <i className="fas fa-paper-plane"></i> Send
                </button>
                <button className="ed-mini-btn" onClick={handleReceivedClick}>
                  <i className="fas fa-check"></i> Received
                </button>
              </>
            }
            emptyIcon="fa-file-alt"
            emptyText={questionnaires.length === 0 ? "No questionnaire rounds yet." : undefined}
          >
            {questionnaires.length > 0 && (
              <div className="ed-call-list">
                {questionnaires.map(qn => (
                  <div key={qn.id} className="ed-call-item">
                    <div className="ed-call-top">
                      <span className={`badge ${qn.status === 'Received' ? 'b-emerald' : 'b-amber'}`}>
                        {qn.status}
                      </span>
                      <span className="ed-call-date">{formatDateTime(qn.sent_date)}</span>
                    </div>
                    <div className="ed-call-notes"><strong>Q:</strong> {qn.question_asked}</div>
                    {qn.status === 'Received' && (
                      <div className="ed-call-notes" style={{ marginTop: 6, background: 'var(--green-bg)', padding: '8px 10px', borderRadius: 8 }}>
                        <strong style={{ color: 'var(--green)' }}>A:</strong>{' '}
                        {qn.answer_file_url && (
                          <a href={qn.answer_file_url} target="_blank" rel="noreferrer">
                            <i className="fas fa-file-alt"></i> View Answer File
                          </a>
                        )}
                        {qn.answer_notes && <div style={{ marginTop: 4 }}>{qn.answer_notes}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </EnquirySectionCard>

          <EnquirySectionCard
            icon="📁" title="Flowchart Tasks" count={flowchartTasks.length}
            headerAction={<button className="ed-plus-btn" onClick={handleFlowchartClick}><i className="fas fa-plus"></i></button>}
            emptyIcon="fa-sitemap"
            emptyText={flowchartTasks.length === 0 ? "No flowchart tasks created yet." : undefined}
          >
            {flowchartTasks.length > 0 && (
              <div className="ed-call-list">
                {flowchartTasks.map((task, taskIndex) => {
                  const fileUrls = (task.designer_file_url || task.request_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
                  const clientRefUrls = (task.client_reference_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
                  return (
                    <div key={task.id} className="ed-call-item">
                      <div className="ed-call-top">
                        <span className="badge b-gray">{task.version}</span>
                        <span className={`badge ${taskStatusClass(task.status)}`}>{task.status}</span>
                      </div>
                      {task.designer_notes && (
                        <div className="ed-call-notes">{task.designer_notes}</div>
                      )}
                      {fileUrls.length > 0 && (
                        <div className="ed-call-meta">
                          {fileUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <i className="fas fa-file-alt"></i> File {fileUrls.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      )}
                      {clientRefUrls.length > 0 && (
                        <div className="ed-call-meta">
                          {clientRefUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <i className="fas fa-paperclip"></i> Ref File {clientRefUrls.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      )}
                      {task.client_feedback && (
                        <div className="ed-call-notes" style={{ marginTop: 4, color: 'var(--sky)' }}>
                          <strong>Client:</strong> {task.client_feedback}
                        </div>
                      )}
                      {taskIndex === 0 && task.client_shared_date && (
                      <div style={{
                        marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid rgba(190,18,60,.2)',
                        padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700
                      }}>
                        <i className="fas fa-calendar-day"></i> Next Follow-up: {formatDateISO(addBusinessDaysExcludingSunday(new Date(task.client_shared_date), 6))}
                      </div>
                    )}
                      <div className="ed-call-loggedby">
                        <i className="fas fa-calendar"></i> {formatDateTime(task.client_shared_date || task.assigned_date)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </EnquirySectionCard>

          <EnquirySectionCard
            icon="💰" title="Quotation Versions" count={quotations.length}
            headerAction={<button className="ed-plus-btn" onClick={() => setShowQuotationModal(true)}><i className="fas fa-plus"></i></button>}
            emptyIcon="fa-file-invoice-dollar"
            emptyText={quotations.length === 0 ? "No quotations sent yet." : undefined}
          >
            {quotations.length > 0 && (
              <div className="ed-call-list">
                {quotations.map((qt, qtIndex) => {
                  const fileUrls = (qt.file_url || '').split(',').map(u => u.trim()).filter(Boolean)
                  return (
                    <div key={qt.id} className="ed-call-item">
                      <div className="ed-call-top">
                        <span className="badge b-gray">{qt.version}</span>
                        <span className={`badge ${taskStatusClass(qt.status)}`}>{qt.status}</span>
                      </div>
                      {qt.amount && (
                        <div className="ed-call-notes">
                          Amount: <strong>₹{Number(qt.amount).toLocaleString('en-IN')}</strong>
                        </div>
                      )}
                      {qt.notes && (
                        <div className="ed-call-notes" style={{ marginTop: 4 }}>{qt.notes}</div>
                      )}
                      {fileUrls.length > 0 && (
                        <div className="ed-call-meta">
                          {fileUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <i className="fas fa-file-pdf"></i> File {fileUrls.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      )}
                      {qtIndex === 0 && qt.shared_date && (
                      <div style={{
                        marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid rgba(190,18,60,.2)',
                        padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700
                      }}>
                        <i className="fas fa-calendar-day"></i> Next Follow-up: {formatDateISO(addBusinessDaysExcludingSunday(new Date(qt.shared_date), 6))} (6 days after quote)
                      </div>
                    )}
                      <div className="ed-call-loggedby">
                        <i className="fas fa-calendar"></i> {formatDateTime(qt.shared_date)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </EnquirySectionCard>

          <EnquirySectionCard
            icon="📄" title="Purchase Orders" count={purchaseOrders.length}
            emptyIcon="fa-file-contract"
            emptyText={purchaseOrders.length === 0 ? "No Purchase Orders yet." : undefined}
            emptySubtext={purchaseOrders.length === 0 ? "Mark enquiry as Won first." : undefined}
          >
            {purchaseOrders.length > 0 && (
              <div className="ed-call-list">
                {purchaseOrders.map(po => {
                  const fileUrls = (po.file_url || '').split(',').map(u => u.trim()).filter(Boolean)
                  return (
                    <div key={po.id} className="ed-call-item">
                      <div className="ed-call-top">
                        <span className="badge b-gray">{po.version}</span>
                        <span className={`badge ${taskStatusClass(po.status)}`}>{po.status}</span>
                      </div>

                      <div className="ed-detail-grid" style={{ marginBottom: 10 }}>
                        <DetailItem label="Final Order Value" value={po.final_order_value ? `₹${Number(po.final_order_value).toLocaleString('en-IN')}` : null} />
                        <DetailItem label="GST (%)" value={po.gst} />
                        <DetailItem label="Total Cost (incl. GST)" value={po.total_cost ? `₹${Number(po.total_cost).toLocaleString('en-IN')}` : null} accent="sky" />
                        <DetailItem label="Payment Terms" value={po.payment_terms} />
                        <DetailItem label="Delivery Period" value={po.delivery_period} />
                        <DetailItem label="Warranty Period" value={po.warranty_period} />
                        <DetailItem label="Packing" value={po.packing} />
                        <DetailItem label="Freight" value={po.freight} />
                        <DetailItem label="Insurance" value={po.insurance} />
                      </div>

                      {po.notes && (
                        <div className="ed-call-notes">{po.notes}</div>
                      )}

                      {po.admin_review_notes && (
                        <div className="ed-note-callout ed-note-admin">
                          <span className="ed-note-label">Admin Remarks</span>
                          {po.admin_review_notes}
                        </div>
                      )}

                      {po.reassigned_to && (
                        <div className="ed-call-notes">
                          <i className="fas fa-share"></i> Reassigned to: <strong>{po.reassigned_to}</strong>
                        </div>
                      )}

                      {fileUrls.length > 0 && (
                        <div className="ed-call-meta">
                          {fileUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <i className="fas fa-file-pdf"></i> View PO {fileUrls.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="ed-call-loggedby">
                        <i className="fas fa-user"></i> Submitted by: {po.submitted_by} · {formatDateTime(po.upload_date)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </EnquirySectionCard>

          <EnquirySectionCard
            icon="📋" title="Work Orders" count={workOrders.length}
            headerAction={<button className="ed-plus-btn" onClick={handleWOClick}><i className="fas fa-plus"></i></button>}
            emptyIcon="fa-clipboard-list"
            emptyText={workOrders.length === 0 ? "No Work Orders yet." : undefined}
            emptySubtext={workOrders.length === 0 ? "Assign after PO uploaded." : undefined}
          >
            {workOrders.length > 0 && (
              <div className="ed-call-list">
                {workOrders.map(wo => {
                  const fileUrls = (wo.request_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
                  const additionalUrls = (wo.additional_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
                  const canReview = (user?.role === 'admin' || user?.role === 'superadmin') && wo.status === 'Submitted for Review'
                  return (
                    <div key={wo.id} className="ed-call-item">
                      <div className="ed-call-top">
                        <span className="badge b-gray">{wo.version}</span>
                        <span className={`badge ${taskStatusClass(wo.status)}`}>{wo.status}</span>
                      </div>
                      <div className="ed-call-notes">
                        Designer: <strong>{wo.assigned_to}</strong>
                      </div>
                      {wo.instructions && (
                        <div className="ed-call-notes" style={{ marginTop: 4 }}>{wo.instructions}</div>
                      )}
                      {fileUrls.length > 0 && (
                        <div className="ed-call-meta">
                          {fileUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <i className="fas fa-paperclip"></i> File {fileUrls.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      )}

                      {wo.excel_file_url && (
                        <a href={wo.excel_file_url} target="_blank" rel="noreferrer" className="modal-view-file-btn" style={{ marginTop: 10, marginBottom: additionalUrls.length ? 8 : 0 }}>
                          <i className="fas fa-file-excel"></i> View Excel File
                        </a>
                      )}

                      {additionalUrls.length > 0 && (
                        <div className="ed-call-meta">
                          {additionalUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <i className="fas fa-file"></i> Uploaded File {additionalUrls.length > 1 ? i + 1 : ''}
                            </a>
                          ))}
                        </div>
                      )}

                      {wo.admin_review_notes && (wo.status === 'Rejected' || wo.status === 'Approved') && (
                        <div className={`ed-note-callout ${wo.status === 'Rejected' ? 'ed-note-admin' : 'ed-note-success'}`}>
                          <span className="ed-note-label">{wo.status === 'Rejected' ? 'Rejection Reason' : 'Admin Remarks'}</span>
                          {wo.admin_review_notes}
                        </div>
                      )}

                      <div className="ed-call-loggedby">
                        <i className="fas fa-calendar"></i> {formatDateTime(wo.assigned_date)}
                      </div>

                      {canReview && (
                        <div className="ed-review-btns">
                          <button
                            className="btn-approve-sm"
                            onClick={() => { setSelectedWOTask(wo); setWoDecision('approve'); setShowWOAdminReviewModal(true) }}
                          >
                            <i className="fas fa-check"></i> Approve WO
                          </button>
                          <button
                            className="btn-reject-sm"
                            onClick={() => { setSelectedWOTask(wo); setWoDecision('reject'); setShowWOAdminReviewModal(true) }}
                          >
                            <i className="fas fa-times"></i> Reject WO
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </EnquirySectionCard>

          <EnquirySectionCard
            icon="🏆" title="Closure Details"
            emptyIcon="fa-flag"
            emptyText={(enquiry.status === 'Won' || enquiry.status === 'Lost') ? undefined : "No closure data yet."}
            emptySubtext={(enquiry.status === 'Won' || enquiry.status === 'Lost') ? undefined : "Will appear when enquiry is marked Won or Lost."}
          >
            {(enquiry.status === 'Won' || enquiry.status === 'Lost') ? (
              <div>
                {enquiry.status === 'Won' && (
                  <div className="ed-detail-grid">
                    <DetailItem label="Final Order Value" value={enquiry.final_order_value ? `₹${Number(enquiry.final_order_value).toLocaleString('en-IN')}` : null} />
                    <DetailItem label="Payment Terms" value={enquiry.payment_terms} />
                    <DetailItem label="Delivery Period" value={enquiry.delivery_period} />
                    <DetailItem label="Warranty Period" value={enquiry.warranty_period} />
                    <DetailItem label="Packing" value={enquiry.packing} />
                    <DetailItem label="Freight" value={enquiry.freight} />
                    <DetailItem label="Insurance" value={enquiry.insurance} />
                    <DetailItem label="GST" value={enquiry.gst} />
                    <DetailItem
                      label="Total Cost"
                      value={enquiry.total_cost ? `₹${Number(enquiry.total_cost).toLocaleString('en-IN')}` : null}
                      accent="sky"
                    />
                  </div>
                )}
                {enquiry.status === 'Lost' && (
                  <div className="ed-detail-grid">
                    <DetailItem label="Reason of Lost" value={enquiry.reason_of_lost} accent="sky" />
                  </div>
                )}
                {enquiry.closure_remarks && (
                  <>
                    <hr className="ed-divider" />
                    <div className="ed-label">Closure Remarks</div>
                    <div className="ed-products-text">{enquiry.closure_remarks}</div>
                  </>
                )}
              </div>
            ) : null}
          </EnquirySectionCard>

        </div>

        <div className="ed-right-col">
          <div className="ed-card">
            <div className="ed-card-header ed-section-header">
              <span className="ed-card-title">📋 Status Timeline</span>
              <span className="ed-activity-badge">Activity Log (Auto)</span>
            </div>
            <div className="ed-card-body">
              {stageLogs.length === 0 ? (
                <div className="ed-empty-mini">
                  <i className="fas fa-history"></i>
                  <p>No stage history yet</p>
                </div>
              ) : (
                <div className="ed-timeline">
                  {stageLogs.map((log) => {
                    const s = (log.stage_name || '').toLowerCase()
                    const dotClass = s.includes('won') ? 'won' : s.includes('lost') ? 'lost' : s.includes('revision') ? 'revision' : ''
                    return (
                      <div className="ed-tl-item" key={log.id}>
                        <div className={`ed-tl-dot ${dotClass}`}></div>
                        <div className="ed-tl-stage">{log.stage_name}</div>
                        <div className="ed-tl-date">{formatDateTime(log.date_entered)}</div>
                        {log.logged_by && (
                          <div className="ed-tl-user"><i className="fas fa-user"></i> By: {log.logged_by}</div>
                        )}
                        {log.remarks && <div className="ed-tl-remark">{log.remarks}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {showAssignTeamModal && (
        <AssignTeamModal
          enquiry={enquiry}
          onClose={() => setShowAssignTeamModal(false)}
          onSaved={loadDetail}
        />
      )}

      {showLogCallModal && (
        <LogCallModal
          enquiry={enquiry}
          onClose={() => setShowLogCallModal(false)}
          onSaved={() => { setCallHistoryPage(0); loadDetail() }}
        />
      )}

      {showFlowchartModal && (
        <FlowchartModal
          enquiry={enquiry}
          existingTasksCount={flowchartTasks.length}
          isRevision={flowchartIsRevision}
          onClose={() => setShowFlowchartModal(false)}
          onSaved={loadDetail}
        />
      )}

      {showFlowchartDecisionModal && flowchartTasks[0] && (
        <FlowchartDecisionModal
          enquiry={enquiry}
          latestTask={flowchartTasks[0]}
          onClose={() => setShowFlowchartDecisionModal(false)}
          onSaved={loadDetail}
        />
      )}

      {showQuotationModal && (
        <QuotationModal
          enquiry={enquiry}
          existingQuotationsCount={quotations.length}
          onClose={() => setShowQuotationModal(false)}
          onSaved={loadDetail}
        />
      )}

      {showGADrawingModal && (
        <GADrawingModal
          enquiry={enquiry}
          existingTasksCount={gaDrawingTasks.length}
          onClose={() => setShowGADrawingModal(false)}
          onSaved={loadDetail}
        />
      )}

      {showGAAdminReviewModal && selectedGATask && (
        <GADrawingAdminReviewModal
          enquiry={enquiry}
          latestTask={selectedGATask}
          onClose={() => { setShowGAAdminReviewModal(false); setSelectedGATask(null) }}
          onSaved={loadDetail}
        />
      )}

      {showGAClientActionModal && selectedGATask && (
        <GADrawingClientActionModal
          enquiry={enquiry}
          latestTask={selectedGATask}
          onClose={() => { setShowGAClientActionModal(false); setSelectedGATask(null) }}
          onSaved={loadDetail}
        />
      )}

      {showSendQModal && (
        <SendQuestionnaireModal
          enquiry={enquiry}
          onClose={() => setShowSendQModal(false)}
          onSaved={loadDetail}
        />
      )}

      {showReceiveQModal && pendingQuestion && (
        <ReceiveQuestionnaireModal
          enquiry={enquiry}
          pendingQuestion={pendingQuestion}
          onClose={() => setShowReceiveQModal(false)}
          onSaved={loadDetail}
        />
      )}

      {showCloseModal && (
        <CloseEnquiryModal
          enquiry={enquiry}
          onClose={() => setShowCloseModal(false)}
          onSaved={loadDetail}
        />
      )}

      {showPOModal && (
        <PurchaseOrderModal
          enquiry={enquiry}
          existingPOCount={purchaseOrders.length}
          isRevision={poIsRevision}
          onClose={() => setShowPOModal(false)}
          onSaved={loadDetail}
        />
      )}

      {showPOReviewModal && purchaseOrders[0] && (
        <PurchaseOrderReviewModal
          enquiry={enquiry}
          latestPO={purchaseOrders[0]}
          isAuthorizedReview={poReviewMode === 'authorized'}
          onClose={() => setShowPOReviewModal(false)}
          onSaved={loadDetail}
          onApprove={() => setShowApprovePOModal(true)}
        />
      )}

      {showApprovePOModal && purchaseOrders[0] && (
        <ApprovePOAssignWorkOrderModal
          enquiry={enquiry}
          latestPO={purchaseOrders[0]}
          existingWOCount={workOrders.length}
          onClose={() => setShowApprovePOModal(false)}
          onSaved={loadDetail}
        />
      )}

      {showWOModal && (
        <WorkOrderModal
          enquiry={enquiry}
          existingTasksCount={workOrders.length}
          onClose={() => setShowWOModal(false)}
          onSaved={loadDetail}
        />
      )}

      {showWOAdminReviewModal && selectedWOTask && (
        <WorkOrderAdminReviewModal
          enquiry={enquiry}
          task={selectedWOTask}
          decision={woDecision}
          onClose={() => { setShowWOAdminReviewModal(false); setSelectedWOTask(null) }}
          onSaved={loadDetail}
        />
      )}
    </div>
  )
}

function DetailItem({ label, value, accent }) {
  return (
    <div className="ed-detail-item">
      <div className="ed-label">{label}</div>
      <div className={`ed-value ${accent ? 'ed-accent-' + accent : ''}`}>{value || '—'}</div>
    </div>
  )
}