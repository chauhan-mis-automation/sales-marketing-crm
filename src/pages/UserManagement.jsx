import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import AddUserModal from '../components/AddUserModal'
import EditUserModal from '../components/EditUserModal'
import ResetPasswordModal from '../components/ResetPasswordModal'
import './UserManagement.css'

const ROLE_INFO = [
  { role: 'superadmin', desc: ['✅ All enquiries', '✅ User management', '✅ Full actions'] },
  { role: 'admin', desc: ['✅ All enquiries', '❌ User management', '✅ Full actions + approve'] },
  { role: 'followup', desc: ['✅ All enquiries', '❌ User management', '✅ Follow-up actions'] },
  { role: 'frontend', desc: ['✅ Own enquiries only', '❌ User management', '✅ Full actions on own'] },
  { role: 'backend', desc: ['✅ Assigned enquiries', '❌ User management', '✅ Flowchart / Quotation actions'] },
  { role: 'design', desc: ['✅ Assigned tasks only', '❌ Enquiry management', '✅ Submit designs'] },
]

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('id', { ascending: true })

    if (!error && data) setUsers(data)
    setLoading(false)
  }

  async function toggleActive(u) {
    const newActive = !u.active
    const label = newActive ? 'activate' : 'deactivate'
    if (!window.confirm(`Are you sure you want to ${label} "${u.username}"?`)) return

    const { error } = await supabase
      .from('users')
      .update({ active: newActive })
      .eq('id', u.id)

    if (error) {
      alert('Error updating user: ' + error.message)
      return
    }
    loadUsers()
  }

  const activeCount = users.filter(u => u.active).length

  const filteredUsers = users.filter(u => {
    const s = search.toLowerCase().trim()
    if (!s) return true
    return (u.username || '').toLowerCase().includes(s) ||
      (u.name || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s) ||
      (u.role || '').toLowerCase().includes(s)
  })

  return (
    <div className="um-wrap">
      <div className="um-toolbar">
        <p className="um-subtitle">Manage system users and access roles</p>
        <button className="btn-um-primary" onClick={() => setShowAddModal(true)}>
          <i className="fas fa-user-plus"></i> Add User
        </button>
      </div>

      <div className="um-card">
        <div className="um-card-header">
          <div className="um-card-header-left">
            <div className="um-header-icon">👥</div>
            <div>
              <div className="um-header-title">System Users</div>
              <div className="um-header-sub">Manage access &amp; roles</div>
            </div>
          </div>
          <span className="um-count-badge">{activeCount} active / {users.length} total</span>
        </div>

        <div className="um-search-bar">
          <i className="fas fa-search"></i>
          <input placeholder="Search username, name, email, role…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="um-empty">Loading…</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="um-empty">{users.length === 0 ? 'No users found' : 'No matches found'}</td></tr>
              ) : (
                filteredUsers.map(u => {
                const isCurrentUser = u.username === currentUser?.username
                const initial = (u.name || u.username || '?').charAt(0).toUpperCase()
                return (
                    <tr key={u.id} className={!u.active ? 'um-row-inactive' : ''}>
                    <td data-label="Username">
                        <div className="um-user-cell">
                        <div className={`um-avatar um-av-${u.role}`}>{initial}</div>
                        <div>
                            <div className="um-username">{u.username}</div>
                            {isCurrentUser && <span className="um-you-tag">YOU</span>}
                        </div>
                        </div>
                    </td>
                    <td className="um-name-cell" data-label="Name">{u.name}</td>
                    <td data-label="Role">
                        <span className={`um-role-badge um-role-${u.role}`}>{u.role}</span>
                    </td>
                    <td className="um-email-cell" data-label="Email">{u.email || '—'}</td>
                    <td data-label="Status">
                        <span className={`um-status-badge ${u.active ? 'active' : 'inactive'}`}>
                        <span className="um-status-dot"></span>
                        {u.active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td className="um-actions-cell" data-label="Actions">
                        {isCurrentUser ? (
                        <span className="um-dash">—</span>
                        ) : (
                        <>
                            <button className="um-action-btn um-reset" onClick={() => setResetTarget(u)}>
                            <i className="fas fa-key"></i> Reset Pwd
                            </button>
                            <button className="um-action-btn um-edit" onClick={() => setEditTarget(u)}>
                            <i className="fas fa-edit"></i> Edit
                            </button>
                            <button
                            className={`um-action-btn ${u.active ? 'um-deactivate' : 'um-activate'}`}
                            onClick={() => toggleActive(u)}
                            >
                            <i className={`fas ${u.active ? 'fa-ban' : 'fa-check'}`}></i> {u.active ? 'Deactivate' : 'Activate'}
                            </button>
                        </>
                        )}
                    </td>
                    </tr>
                )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="um-card um-roles-card">
        <div className="um-card-header">
          <div className="um-header-title">🔑 Role Permissions</div>
        </div>
        <div className="um-roles-grid">
          {ROLE_INFO.map(r => (
            <div key={r.role} className="um-role-info-box">
              <span className={`um-role-badge um-role-${r.role}`}>{r.role}</span>
              <div className="um-role-desc">
                {r.desc.map((d, i) => <div key={i}>{d}</div>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSaved={loadUsers}
        />
      )}

      {editTarget && (
        <EditUserModal
          targetUser={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={loadUsers}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          targetUser={resetTarget}
          onClose={() => setResetTarget(null)}
          onSaved={loadUsers}
        />
      )}
    </div>
  )
}