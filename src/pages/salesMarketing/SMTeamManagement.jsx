import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useSMAuth } from '../../context/SMAuthContext'
import { logActivity } from '../../lib/activityLog'
import AddSMUserModal from '../../components/AddSMUserModal'
import EditSMUserModal from '../../components/EditSMUserModal'
import './SMTeamManagement.css'

const ROLE_COLORS = {
  Admin: '#be123c',
  Sales: '#4a5c40',
  BackOffice: '#b8860b',
  Marketing: '#4f46e5',
}

export default function SMTeamManagement() {
  const { smUser } = useSMAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('sm_users').select('*').order('name')
    setUsers(data || [])
    setLoading(false)
  }

  const filteredUsers = users.filter(u => {
    const s = search.toLowerCase().trim()
    if (!s) return true
    return (u.name || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s) ||
      (u.role || '').toLowerCase().includes(s)
  })

  async function toggleStatus(user) {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active'
    setBusyId(user.user_id)
    const { error } = await supabase.from('sm_users').update({ status: newStatus }).eq('user_id', user.user_id)
    setBusyId(null)
    if (error) { alert('Error updating status: ' + error.message); return }

    logActivity({
      userId: smUser?.userId, userName: smUser?.name, role: smUser?.role,
      action: newStatus === 'Active' ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', module: 'Team',
      details: `${user.name} marked ${newStatus}`,
    })

    loadUsers()
  }

  return (
    <div className="fade-in">
      <div className="stm-header">
        <div>
          <h1 className="stm-title">Team Management <span className="stm-count">({users.length})</span></h1>
          <div className="stm-subtitle">Manage Sales &amp; Marketing team members and their access</div>
        </div>
        <button className="stm-add-btn" onClick={() => setShowAdd(true)}>
          <i className="fas fa-user-plus"></i> Add Member
        </button>
      </div>

      <div className="stm-search-bar">
        <i className="fas fa-search"></i>
        <input placeholder="Search name, email, role…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="stm-empty"><i className="fas fa-spinner fa-spin"></i> Loading…</div>
      ) : filteredUsers.length === 0 ? (
        <div className="stm-empty">
          <div className="stm-empty-icon">👥</div>
          <p>No team members found</p>
        </div>
      ) : (
        <div className="stm-grid">
          {filteredUsers.map((u, idx) => {
            const roleColor = ROLE_COLORS[u.role] || '#4a5c40'
            const isActive = u.status === 'Active'
            return (
              <div className="stm-card" key={u.user_id} style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className="stm-card-top">
                  <div className="stm-avatar" style={{ background: `linear-gradient(135deg, ${roleColor}, ${roleColor}cc)` }}>
                    {(u.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="stm-name-block">
                    <div className="stm-name">{u.name}</div>
                    <div className="stm-email">{u.email}</div>
                  </div>
                  <span className="stm-role-badge" style={{ background: `${roleColor}18`, color: roleColor }}>{u.role}</span>
                </div>

                {u.designation && <div className="stm-designation"><i className="fas fa-id-badge"></i> {u.designation}</div>}

                <div className="stm-divider"></div>

                <div className="stm-info-row">
                  <span className="stm-phone"><i className="fas fa-phone"></i> {u.phone || '—'}</span>
                  <span className={`stm-status-badge ${isActive ? 'active' : 'inactive'}`}>
                    <span className="stm-status-dot"></span> {u.status}
                  </span>
                </div>

                <div className="stm-actions">
                  {isActive ? (
                    <button className="stm-btn danger" disabled={busyId === u.user_id} onClick={() => toggleStatus(u)}>
                      {busyId === u.user_id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-user-slash"></i>} Deactivate
                    </button>
                  ) : (
                    <button className="stm-btn success" disabled={busyId === u.user_id} onClick={() => toggleStatus(u)}>
                      {busyId === u.user_id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-user-check"></i>} Activate
                    </button>
                  )}
                  <button className="stm-btn ghost" onClick={() => setEditingUser(u)}>
                    <i className="fas fa-pen"></i> Edit
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <AddSMUserModal onClose={() => setShowAdd(false)} onSaved={loadUsers} />
      )}
      {editingUser && (
        <EditSMUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={loadUsers} />
      )}
    </div>
  )
}
