import { useNavigate, useLocation } from 'react-router-dom'
import casilicaLogo from '../assets/casilica-logo.jpeg'
import './Sidebar.css'

const NAV_ITEMS = [
  { section: 'Main', items: [
    { key: 'dashboard',  label: 'Dashboard',      icon: 'fa-chart-pie',   path: '/dashboard',  roles: ['superadmin','admin','followup','frontend','backend','design'] },
    { key: 'enquiries',  label: 'All Enquiries',  icon: 'fa-inbox',       path: '/enquiries',  roles: ['superadmin','admin','followup','frontend','backend'], badge: true },
    { key: 'new',        label: 'New Enquiry',    icon: 'fa-plus-circle', path: '/enquiries/new', roles: ['superadmin','admin','followup','frontend'] },
  ]},
  { section: 'Work Queue', items: [
    { key: 'followups',  label: 'Follow-ups',     icon: 'fa-bell',             path: '/followups',  roles: ['superadmin','admin','followup'], badge: true },
    { key: 'flowcharts', label: 'Flowcharts',     icon: 'fa-project-diagram',  path: '/flowcharts', roles: ['superadmin','admin','followup','backend'], badge: true, badgeColor: 'amber' },
    { key: 'quotations', label: 'Quotations',     icon: 'fa-file-invoice-dollar', path: '/quotations', roles: ['superadmin','admin','followup','backend'] },
    { key: 'drawings',   label: 'GA Drawings',    icon: 'fa-drafting-compass', path: '/drawings',   roles: ['superadmin','admin','design'], badge: true, badgeColor: 'amber' },
    { key: 'poapprovals',label: 'PO Approvals',   icon: 'fa-file-contract',    path: '/po-approvals', roles: ['superadmin','admin'], badge: true, badgeColor: 'amber' },
    { key: 'workorders', label: 'Work Orders',    icon: 'fa-clipboard-list',   path: '/work-orders', roles: ['superadmin','admin'], badge: true, badgeColor: 'amber' },
    { key: 'orderconversion', label: 'Order Conversion', icon: 'fa-chart-line', path: '/order-conversion', roles: ['superadmin','admin'] },
  ]},
  { section: 'System', items: [
    { key: 'users', label: 'User Management', icon: 'fa-users', path: '/users', roles: ['superadmin','admin'] },
  ]},
  { section: 'Reports', items: [
    { key: 'tat',        label: 'TAT Reports',        icon: 'fa-chart-line',   path: '/tat',         roles: ['superadmin','admin'] },
    { key: 'teamperf',   label: 'Team Performance',   icon: 'fa-users-cog',    path: '/team-performance', roles: ['superadmin','admin'] },
    { key: 'reportcard', label: 'Report Card',        icon: 'fa-id-card',      path: '/report-card', roles: ['superadmin','admin','followup','frontend','backend','design'] },
  ]},
]

export default function Sidebar({ user, isOpen, isCollapsed, onClose, onToggleCollapse, badges = {} }) {
  const navigate = useNavigate()
  const location = useLocation()

  function handleNavClick(path) {
    navigate(path)
    onClose() // mobile pe sidebar close karo click ke baad
  }

  function handleSignOut() {
    localStorage.removeItem('crm_user')
    navigate('/login')
  }

  const initials = (user?.name || '?').charAt(0).toUpperCase()

  return (
    <>
      <div className={`sb-overlay ${isOpen ? 'show' : ''}`} onClick={onClose}></div>

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sb-logo">
          <img
            src={casilicaLogo}
            alt="Casilica Logo"
          />
        </div>

        <nav className="sb-nav">
          {NAV_ITEMS.map((group) => {
            const visibleItems = group.items.filter(item => item.roles.includes(user?.role))
            if (!visibleItems.length) return null

            return (
              <div key={group.section}>
                <div className="sb-section">{group.section}</div>
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.path
                  const badgeCount = badges[item.key] || 0
                  return (
                    <button
                      key={item.key}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleNavClick(item.path)}
                    >
                      <i className={`fas ${item.icon}`}></i>
                      {item.label}
                      {item.badge && badgeCount > 0 && (
                        <span className={`nav-badge ${item.badgeColor || ''}`}>{badgeCount}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="sb-footer">
          <div className="user-chip">
            <div className="user-av">{initials}</div>
            <div>
              <div className="user-name">{user?.name || '—'}</div>
              <span className={`role-badge role-${user?.role}`}>{user?.role}</span>
            </div>
          </div>
          <button className="btn-signout" onClick={handleSignOut}>
            <i className="fas fa-sign-out-alt"></i> Sign Out
          </button>
        </div>
      </aside>

      {/* Desktop collapse/expand toggle button */}
      <button className="sb-toggle-btn" onClick={onToggleCollapse} title="Toggle sidebar">
        <i className="fas fa-chevron-left"></i>
      </button>
    </>
  )
}