import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import SubmitDesignWorkModal from '../../components/SubmitDesignWorkModal'
import WorkOrderFormModal from '../../components/WorkOrderFormModal'
import './DesignerDashboard.css'

function isPending(status) {
  return status === 'Requested'
}
function isRejected(status) {
  return status === 'Rejected' || status === 'Rejected by Admin' || status === 'Client Revision Requested'
}

function formatDateTime(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function DesignerDashboard({ user }) {
  const navigate = useNavigate()
  const [gaDrawingTasks, setGaDrawingTasks] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [enquiryMap, setEnquiryMap] = useState({})
  const [enquiryDetailsMap, setEnquiryDetailsMap] = useState({})
  const [projectMap, setProjectMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState({})

  const [submitModalTask, setSubmitModalTask] = useState(null)
  const [submitModalIsResubmission, setSubmitModalIsResubmission] = useState(false)

  useEffect(() => {
    loadData()
  }, [user?.name])

  async function loadData() {
    setLoading(true)

    const { data: gaData } = await supabase
      .from('ga_drawing_tasks')
      .select('*')
      .eq('assigned_to', user.name)
      .order('assigned_date', { ascending: false })

    const { data: woData } = await supabase
      .from('work_orders')
      .select('*')
      .eq('assigned_to', user.name)
      .order('assigned_date', { ascending: false })

    const { data: enqData } = await supabase
      .from('enquiries')
      .select('enquiry_id, company_name, project_name, city, state, country')

    const map = {}
    const detailsMap = {}
    const projMap = {}
    ;(enqData || []).forEach(e => {
      map[e.enquiry_id] = e.company_name
      detailsMap[e.enquiry_id] = e
      projMap[e.enquiry_id] = e.project_name
    })

    setGaDrawingTasks(gaData || [])
    setWorkOrders(woData || [])
    setEnquiryMap(map)
    setEnquiryDetailsMap(detailsMap)
    setProjectMap(projMap)
    setLoading(false)
  }

  function toggleExpand(id) {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function openSubmitModal(task, isResubmission) {
    setSubmitModalTask(task)
    setSubmitModalIsResubmission(isResubmission)
  }

  const q = search.trim().toLowerCase()
  function matchesSearch(task) {
    if (!q) return true
    const company = (enquiryMap[task.enquiry_id] || '').toLowerCase()
    return task.enquiry_id.toLowerCase().includes(q) || company.includes(q)
  }

  const gaFiltered = gaDrawingTasks.filter(matchesSearch)
  const woFiltered = workOrders.filter(matchesSearch)

  const pendingTasks = [
    ...gaFiltered.filter(t => isPending(t.status)).map(t => ({ ...t, _type: 'ga' })),
    ...woFiltered.filter(t => isPending(t.status)).map(t => ({ ...t, _type: 'wo' })),
  ]
  const gaDoneTasks = gaFiltered.filter(t => !isPending(t.status) && !isRejected(t.status)).map(t => ({ ...t, _type: 'ga' }))
  const woDoneTasks = woFiltered.filter(t => !isPending(t.status) && !isRejected(t.status)).map(t => ({ ...t, _type: 'wo' }))
  const revisionTasks = [
    ...gaFiltered.filter(t => isRejected(t.status)).map(t => ({ ...t, _type: 'ga' })),
    ...woFiltered.filter(t => isRejected(t.status)).map(t => ({ ...t, _type: 'wo' })),
  ]

  if (loading) {
    return (
      <div className="dd-loading">
        <i className="fas fa-spinner fa-spin"></i> Loading dashboard…
      </div>
    )
  }

  return (
    <div className="dd-wrap">
      <p className="dd-subtitle">Track your assignments and performance history here.</p>

      <div className="dd-tabs">
        <button className={`dd-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          <i className="fas fa-list"></i> Active Queue
        </button>
        <button className={`dd-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <i className="fas fa-history"></i> Work History
        </button>
      </div>

      <div className="dd-search">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Search by Enquiry ID or Company Name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {tab === 'active' ? (
        <>
          <div className="dd-summary-grid">
            <div className="dd-summary-card c-rose">
              <div className="dd-summary-top">
                <span>🏆 Pending</span>
                <span className="dd-summary-badge">{pendingTasks.length}</span>
              </div>
              <div className="dd-summary-sub">Awaiting your action</div>
            </div>
            <div className="dd-summary-card c-teal">
              <div className="dd-summary-top">
                <span>📐 GA Drawing</span>
                <span className="dd-summary-badge">{gaDoneTasks.length}</span>
              </div>
              <div className="dd-summary-sub">Submitted / Approved</div>
            </div>
            <div className="dd-summary-card c-sky">
              <div className="dd-summary-top">
                <span>📋 Work Order</span>
                <span className="dd-summary-badge">{woDoneTasks.length}</span>
              </div>
              <div className="dd-summary-sub">Submitted / Done</div>
            </div>
            <div className="dd-summary-card c-amber">
              <div className="dd-summary-top">
                <span>🔄 Needs Revision</span>
                <span className="dd-summary-badge">{revisionTasks.length}</span>
              </div>
              <div className="dd-summary-sub">Rejected — please revise</div>
            </div>
          </div>

          <div className="dd-columns">
            <TaskColumn
              accent="rose"
              tasks={pendingTasks}
              emptyText="No pending tasks! 🎉"
              enquiryMap={enquiryMap}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              navigate={navigate}
              variant="pending"
              onSubmitClick={openSubmitModal}
            />
            <TaskColumn
              accent="teal"
              tasks={gaDoneTasks}
              emptyText="No GA Drawing tasks yet."
              enquiryMap={enquiryMap}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              navigate={navigate}
              variant="done"
              onSubmitClick={openSubmitModal}
            />
            <TaskColumn
              accent="sky"
              tasks={woDoneTasks}
              emptyText="No Work Order tasks yet."
              enquiryMap={enquiryMap}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              navigate={navigate}
              variant="done"
              onSubmitClick={openSubmitModal}
            />
            <TaskColumn
              accent="amber"
              tasks={revisionTasks}
              emptyText="Nothing needs revision. 🎉"
              enquiryMap={enquiryMap}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              navigate={navigate}
              variant="revision"
              onSubmitClick={openSubmitModal}
            />
          </div>
        </>
      ) : (
        <WorkHistoryTab
          gaTasks={gaFiltered}
          woTasks={woFiltered}
          enquiryMap={enquiryMap}
          projectMap={projectMap}
          navigate={navigate}
        />
      )}

      {submitModalTask && submitModalTask._type === 'ga' && (
        <SubmitDesignWorkModal
          task={submitModalTask}
          companyName={enquiryMap[submitModalTask.enquiry_id] || '—'}
          isResubmission={submitModalIsResubmission}
          onClose={() => setSubmitModalTask(null)}
          onSaved={loadData}
        />
      )}

      {submitModalTask && submitModalTask._type === 'wo' && (
        <WorkOrderFormModal
          task={submitModalTask}
          enquiryInfo={enquiryDetailsMap[submitModalTask.enquiry_id]}
          initialData={submitModalTask.form_data || null}
          isResubmission={submitModalIsResubmission}
          onClose={() => setSubmitModalTask(null)}
          onSaved={loadData}
        />
      )}
    </div>
  )
}

function TaskColumn({ accent, tasks, emptyText, enquiryMap, expandedIds, toggleExpand, navigate, variant, onSubmitClick }) {
  return (
    <div className={`dd-col dd-col-${accent}`}>
      <div className="dd-col-scroll">
        {tasks.length === 0 ? (
          <div className="dd-col-empty">
            <i className="fas fa-check-circle"></i>
            <p>{emptyText}</p>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={`${task._type}-${task.id}`}
              task={task}
              companyName={enquiryMap[task.enquiry_id] || '—'}
              isExpanded={!!expandedIds[`${task._type}-${task.id}`]}
              onToggle={() => toggleExpand(`${task._type}-${task.id}`)}
              onOpenEnquiry={() => navigate(`/enquiries/${task.enquiry_id}`)}
              onSubmitClick={onSubmitClick}
              variant={variant}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TaskCard({ task, companyName, isExpanded, onToggle, onOpenEnquiry, onSubmitClick, variant }) {
  const typeLabel = task._type === 'ga' ? 'GA Drawing' : 'Work Order'
  const typeIcon = task._type === 'ga' ? 'fa-drafting-compass' : 'fa-clipboard-list'
  const requestFiles = (task.request_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
  const designerFiles = (task.designer_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
  const adminRefFiles = (task.admin_reference_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
  const clientRefFiles = (task.client_reference_file_url || '').split(',').map(u => u.trim()).filter(Boolean)
  const woAdditionalFiles = (task.additional_file_url || '').split(',').map(u => u.trim()).filter(Boolean)

  return (
    <div className="dd-card">
      <div className="dd-card-top">
        <span className="dd-card-type"><i className={`fas ${typeIcon}`}></i> {typeLabel} {task.version}</span>
        <span className="dd-status-badge">{task.status}</span>
      </div>

      <div className="dd-card-enq" onClick={onOpenEnquiry}>{task.enquiry_id}</div>
      <div className="dd-card-company"><i className="fas fa-building"></i> {companyName}</div>
      <div className="dd-card-date"><i className="fas fa-clock"></i> Assigned: {formatDateTime(task.assigned_date)}</div>

      <button className="dd-toggle-btn" onClick={onToggle}>
        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i> Tap to {isExpanded ? 'hide' : 'view requirements'}
      </button>

      {isExpanded && (
        <div className="dd-card-details">

          {variant === 'pending' && (
            <>
              <div className="dd-req-box">
                <div className="dd-req-label">Requirements</div>
                <div>{task.request_notes || task.instructions || '—'}</div>
                {(task.assigned_by || task.authorized_by) && (
                  <div className="dd-req-assignedby"><i className="fas fa-user"></i> Assigned by: {task.assigned_by || task.authorized_by}</div>
                )}
              </div>
              <div className="dd-pending-actions">
                {requestFiles.length > 0 && (
                  <a href={requestFiles[0]} target="_blank" rel="noreferrer" className="dd-file-chip">
                    <i className="fas fa-paperclip"></i> Ref File
                  </a>
                )}
                <button className="dd-submit-btn" onClick={() => onSubmitClick(task, false)}>
                  <i className={`fas ${task._type === 'wo' ? 'fa-edit' : 'fa-upload'}`}></i>{' '}
                  {task._type === 'wo' ? 'Fill Form' : 'Submit Work'}
                </button>
              </div>
            </>
          )}

          {variant !== 'pending' && (task.request_notes || task.instructions) && (
            <div className="dd-req-notes">{task.request_notes || task.instructions}</div>
          )}

          {variant !== 'pending' && requestFiles.length > 0 && (
            <div className="dd-file-row">
              {requestFiles.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="dd-file-chip">
                  <i className="fas fa-paperclip"></i> Ref File {requestFiles.length > 1 ? i + 1 : ''}
                </a>
              ))}
            </div>
          )}

          {variant === 'revision' && (
            <>
              <div className="dd-rejection-box">
                <div className="dd-rejection-title">
                  <i className="fas fa-times-circle"></i> {task.status === 'Client Revision Requested' ? 'CLIENT REVISION REASON' : 'REJECTION REASON'}
                </div>
                <div>{task.status === 'Client Revision Requested' ? (task.client_feedback || '—') : (task.admin_review_notes || '—')}</div>
              </div>
              {clientRefFiles.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="dd-section-label"><i className="fas fa-paperclip"></i> Client Reference File(s) — Review Before Resubmitting</div>
                  <div className="dd-file-row">
                    {clientRefFiles.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="dd-file-chip primary">
                        <i className="fas fa-file"></i> View Client Ref File {clientRefFiles.length > 1 ? i + 1 : ''}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {adminRefFiles.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="dd-section-label"><i className="fas fa-paperclip"></i> Admin Reference File(s) — Review Before Resubmitting</div>
                  <div className="dd-file-row">
                    {adminRefFiles.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="dd-file-chip primary">
                        <i className="fas fa-file"></i> View Admin Ref File
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {requestFiles.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="dd-section-label"><i className="fas fa-history"></i> Original Assignment Files</div>
                  <div className="dd-file-row">
                    {requestFiles.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="dd-file-chip">
                        <i className="fas fa-paperclip"></i> Original File {requestFiles.length > 1 ? i + 1 : ''}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {task._type === 'wo' && woAdditionalFiles.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="dd-section-label"><i className="fas fa-paperclip"></i> Your Previously Uploaded File(s)</div>
                  <div className="dd-file-row">
                    {woAdditionalFiles.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="dd-file-chip">
                        <i className="fas fa-file"></i> File {woAdditionalFiles.length > 1 ? i + 1 : ''}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <button className="dd-resubmit-btn" onClick={() => onSubmitClick(task, true)}>
                <i className="fas fa-edit"></i> {task._type === 'wo' ? 'Fill Form (Resubmit)' : 'Resubmit'}
              </button>
            </>
          )}

          {variant === 'done' && designerFiles.length > 0 && (
            <div className="dd-submitted-box">
              <div className="dd-submitted-title">
                <i className="fas fa-check-circle"></i> Submitted on {formatDateTime(task.designer_submission_date)}
              </div>
              <div>Status: {task.status}</div>
              {designerFiles.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="dd-file-chip primary" style={{ marginTop: 8 }}>
                  <i className="fas fa-file"></i> View Submitted File
                </a>
              ))}
            </div>
          )}

          {variant === 'done' && task._type === 'wo' && (
            <div className="dd-submitted-box">
              <div className="dd-submitted-title">
                <i className="fas fa-check-circle"></i> {task.designer_submission_date ? `Submitted on ${formatDateTime(task.designer_submission_date)}` : 'Form Submitted'}
              </div>
              <div>Status: {task.status}</div>
              {task.excel_file_url && (
                <a href={task.excel_file_url} target="_blank" rel="noreferrer" className="dd-file-chip primary" style={{ marginTop: 8 }}>
                  <i className="fas fa-file-excel"></i> View Submitted Excel
                </a>
              )}
              {woAdditionalFiles.length > 0 && (
                <div className="dd-file-row" style={{ marginTop: 8, marginBottom: 0 }}>
                  {woAdditionalFiles.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="dd-file-chip">
                      <i className="fas fa-paperclip"></i> File {woAdditionalFiles.length > 1 ? i + 1 : ''}
                    </a>
                  ))}
                </div>
              )}
              <button className="dd-edit-btn" onClick={() => onSubmitClick(task, false)}>
                <i className="fas fa-edit"></i> Edit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function historyStatusClass(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('reject')) return 'hist-badge-rose'
  if (s.includes('approved')) return 'hist-badge-green'
  if (s.includes('submitted for review')) return 'hist-badge-amber'
  if (s.includes('shared')) return 'hist-badge-sky'
  if (s === 'requested') return 'hist-badge-gray'
  return 'hist-badge-gray'
}

function formatDateOnly(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function WorkHistoryTab({ gaTasks, woTasks, enquiryMap, projectMap, navigate }) {
  const all = [
    ...gaTasks.map(t => ({ ...t, _type: 'ga' })),
    ...woTasks.map(t => ({ ...t, _type: 'wo' })),
  ].sort((a, b) => new Date(b.assigned_date) - new Date(a.assigned_date))

  if (all.length === 0) {
    return (
      <div className="dd-col-empty" style={{ marginTop: 20 }}>
        <i className="fas fa-history"></i>
        <p>No work history yet.</p>
      </div>
    )
  }

  const totalAssigned = all.length
  const totalRejections = all.reduce((sum, t) => sum + (t.revision_count || 0), 0)
  const totalApproved = all.filter(t => (t.status || '').toLowerCase().includes('approved')).length
  const totalRejectedNow = all.filter(t => (t.status || '').toLowerCase().includes('reject')).length

  return (
    <div>
      <div className="dd-hist-summary">
        <div className="dd-hist-summary-card">
          <div className="dd-hist-summary-val">{totalAssigned}</div>
          <div className="dd-hist-summary-lbl">Total Assigned</div>
        </div>
        <div className="dd-hist-summary-card">
          <div className="dd-hist-summary-val" style={{ color: 'var(--green)' }}>{totalApproved}</div>
          <div className="dd-hist-summary-lbl">Approved</div>
        </div>
        <div className="dd-hist-summary-card">
          <div className="dd-hist-summary-val" style={{ color: 'var(--rose)' }}>{totalRejectedNow}</div>
          <div className="dd-hist-summary-lbl">Currently Rejected</div>
        </div>
        <div className="dd-hist-summary-card">
          <div className="dd-hist-summary-val" style={{ color: 'var(--amber)' }}>{totalRejections}</div>
          <div className="dd-hist-summary-lbl">Total Revisions</div>
        </div>
      </div>

      <div className="dd-history-table-wrap">
        <table className="dd-history-table">
          <thead>
            <tr>
              <th>Assign Date</th>
              <th>Project Name</th>
              <th>Enquiry ID</th>
              <th>Type</th>
              <th>Vers.</th>
              <th>Submission Date</th>
              <th>Rejections</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {all.map(task => {
              const projectName = projectMap?.[task.enquiry_id] || '—'
              const revisions = task.revision_count || 0
              return (
                <tr key={`${task._type}-${task.id}`} onClick={() => navigate(`/enquiries/${task.enquiry_id}`)}>
                  <td className="dd-hist-mono">{formatDateOnly(task.assigned_date)}</td>
                  <td className="dd-hist-project">{projectName}</td>
                  <td className="dd-hist-mono dd-hist-enqid">{task.enquiry_id}</td>
                  <td>
                    <span className={`dd-hist-type-badge ${task._type === 'wo' ? 'type-wo' : 'type-ga'}`}>
                      {task._type === 'wo' ? 'Work Order' : 'GA Drawing'}
                    </span>
                  </td>
                  <td className="dd-hist-mono">{task.version}</td>
                  <td className="dd-hist-mono">
                    {task.designer_submission_date ? (
                      <span className="dd-hist-submitted"><i className="fas fa-check-circle"></i> {formatDateOnly(task.designer_submission_date)}</span>
                    ) : (
                      <span className="dd-hist-pending">Pending</span>
                    )}
                  </td>
                  <td>
                    {revisions > 0 ? (
                      <span className="dd-hist-badge hist-badge-rose"><i className="fas fa-exclamation-circle"></i> {revisions} Rejected</span>
                    ) : (
                      <span className="dd-hist-badge hist-badge-gray-outline">0 Rejections</span>
                    )}
                  </td>
                  <td>
                    <span className={`dd-hist-badge ${historyStatusClass(task.status)}`}>{task.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}