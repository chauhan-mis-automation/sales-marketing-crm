import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useSMAuth } from '../../context/SMAuthContext'
import TypewriterText from '../../components/TypewriterText'
import AddContactModal from '../../components/AddContactModal'
import ReassignedHistoryModal from '../../components/ReassignedHistoryModal'
import './SMDashboards.css'

export default function SMMarketingDashboard() {
  const { smUser } = useSMAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [myProjectsCount, setMyProjectsCount] = useState(0)
  const [reassignedCount, setReassignedCount] = useState(0)
  const [showReassignHistory, setShowReassignHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const today = new Date().toDateString()

  useEffect(() => {
    loadData()
  }, [smUser?.userId])

  async function loadData() {
    setLoading(true)
    const [{ data: leadRows }, { data: fupRows }, { count: projectCount }, { count: reassignCount }] = await Promise.all([
      supabase.from('sm_leads').select('*'),
      supabase.from('sm_followups').select('*').eq('sales_person_id', smUser?.userId).eq('status', 'Pending').order('follow_up_date', { ascending: true }),
      supabase.from('sm_projects').select('id', { count: 'exact', head: true }).eq('created_by_id', smUser?.userId),
      supabase.from('sm_activity_log').select('id', { count: 'exact', head: true }).eq('user_id', smUser?.userId).eq('action', 'ASSIGN_LEAD'),
    ])
    setLeads(leadRows || [])
    setFollowUps(fupRows || [])
    setMyProjectsCount(projectCount || 0)
    setReassignedCount(reassignCount || 0)
    setLoading(false)
  }

  const myLeads = useMemo(() => leads.filter(l => l.assigned_to === smUser?.name), [leads, smUser])
  const selfAdded = useMemo(() => leads.filter(l => l.created_by === smUser?.name).length, [leads, smUser])
  const todaysFollowUps = followUps.filter(f => new Date(f.follow_up_date).toDateString() === today)

  return (
    <div className="fade-in">
      <div className="smd-top-row">
        <div>
          <h1 className="smd-greeting"><TypewriterText text={`Welcome Back, ${smUser?.name}!`} /> 👋</h1>
          <p className="smd-date">{dateLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="smd-add-btn secondary" onClick={() => navigate('/sales-marketing/projects')}>
            <i className="fas fa-folder-plus"></i> Add Project
          </button>
          <button className="smd-add-btn" onClick={() => setShowAddModal(true)}>
            <i className="fas fa-plus"></i> Add New Contact
          </button>
        </div>
      </div>

      <div className="smd-schedule-banner" onClick={() => navigate('/sales-marketing/followups')}>
        <div className="smd-schedule-left">
          <div className="smd-schedule-icon"><i className="fas fa-calendar-alt"></i></div>
          <div>
            <div className="smd-schedule-title">Today's Schedule</div>
            <div className="smd-schedule-sub">Tap here to see all your calls and visits for today.</div>
          </div>
        </div>
        <button className="smd-schedule-btn">View Now →</button>
      </div>

      <div className="smd-stat-grid four">
        <div className="smd-stat-card">
          <div className="smd-stat-icon amber"><i className="fas fa-folder-open"></i></div>
          <div className="smd-stat-value">{loading ? '—' : myProjectsCount}</div>
          <div className="smd-stat-label">Total Projects</div>
        </div>
        <div className="smd-stat-card">
          <div className="smd-stat-icon rose"><i className="fas fa-bullseye"></i></div>
          <div className="smd-stat-value">{loading ? '—' : myLeads.length}</div>
          <div className="smd-stat-label">Assigned To Me</div>
        </div>
        <div className="smd-stat-card">
          <div className="smd-stat-icon indigo"><i className="fas fa-plus"></i></div>
          <div className="smd-stat-value">{loading ? '—' : selfAdded}</div>
          <div className="smd-stat-label">Self Added</div>
        </div>
        <div className="smd-stat-card" style={{ cursor: 'pointer' }} onClick={() => setShowReassignHistory(true)}>
          <div className="smd-stat-icon sky"><i className="fas fa-random"></i></div>
          <div className="smd-stat-value">{loading ? '—' : reassignedCount}</div>
          <div className="smd-stat-label">Reassigned By Me</div>
        </div>
      </div>

      {todaysFollowUps.length === 0 ? (
        <div className="smd-card smd-clear-today">
          <div className="smd-empty-emoji">🎉</div>
          <h3>All clear for today!</h3>
          <p>No pending calls or visits scheduled</p>
        </div>
      ) : (
        <div className="smd-followup-list">
          {todaysFollowUps.slice(0, 4).map(f => (
            <div key={f.followup_id} className="smd-followup-item">
              <div className={`smd-followup-icon ${f.type === 'Visit' ? 'visit' : 'call'}`}>
                <i className={`fas ${f.type === 'Visit' ? 'fa-map-marker-alt' : 'fa-phone'}`}></i>
              </div>
              <div className="smd-followup-info">
                <strong>{f.lead_name}</strong>
                <div className="smd-followup-sub">{f.type === 'Visit' ? 'Visit' : 'Phone Call'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddContactModal onClose={() => setShowAddModal(false)} onSaved={loadData} />
      )}
      {showReassignHistory && (
        <ReassignedHistoryModal userId={smUser?.userId} onClose={() => setShowReassignHistory(false)} />
      )}
    </div>
  )
}
