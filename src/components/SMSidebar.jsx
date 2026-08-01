import { useNavigate, useLocation } from 'react-router-dom'
import { useSMAuth } from '../context/SMAuthContext'
import casilicaLogo from '../assets/casilica-logo.jpeg'
import './SMSidebar.css'

const NAV_ITEMS = [
  { section: 'Overview', items: [
    { key: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie', path: '/sales-marketing', roles: ['Admin', 'Sales', 'BackOffice', 'Marketing'], color: '#0369a1' },
  ]},
  { section: 'Leads', items: [
    { key: 'leads', label: 'All Contacts', icon: 'fa-users', path: '/sales-marketing/leads', roles: ['Admin', 'BackOffice'], color: '#6d28d9' },
    { key: 'myLeads', label: 'My Contacts', icon: 'fa-bullseye', path: '/sales-marketing/my-leads', roles: ['Sales', 'Marketing'], color: '#6d28d9' },
    { key: 'unassigned', label: 'Unassigned', icon: 'fa-inbox', path: '/sales-marketing/unassigned', roles: ['Admin', 'BackOffice'], color: '#b45309' },
    { key: 'allProjects', label: 'All Projects', icon: 'fa-folder-open', path: '/sales-marketing/projects', roles: ['Admin', 'Marketing'], color: '#ca8a04' },
  ]},
  { section: 'Activities', items: [
    { key: 'calendar', label: 'Calendar', icon: 'fa-calendar-alt', path: '/sales-marketing/calendar', roles: ['Admin', 'Sales', 'BackOffice', 'Marketing'], color: '#0284c7' },
    { key: 'followups', label: 'Follow-ups', icon: 'fa-redo', path: '/sales-marketing/followups', roles: ['Admin', 'Sales', 'Marketing'], color: '#0d9488' },
    { key: 'interactions', label: 'Interactions', icon: 'fa-phone-alt', path: '/sales-marketing/interactions', roles: ['Admin', 'Sales', 'Marketing'], color: '#db2777' },
  ]},
  { section: 'Sales', items: [
    { key: 'sales', label: 'Sales Records', icon: 'fa-coins', path: '/sales-marketing/sales', roles: ['Admin', 'Sales', 'Marketing'], color: '#d97706' },
    { key: 'kpi', label: 'KPI & Reports', icon: 'fa-chart-line', path: '/sales-marketing/kpi', roles: ['Admin', 'Sales'], color: '#059669' },
    { key: 'marketingKpi', label: 'Marketing KPI', icon: 'fa-bullhorn', path: '/sales-marketing/marketing-kpi', roles: ['Admin', 'Marketing'], color: '#4f46e5' },
    { key: 'expenseReport', label: 'Expense Report', icon: 'fa-receipt', path: '/sales-marketing/expenses', roles: ['Admin', 'BackOffice', 'Sales', 'Marketing'], color: '#be123c' },
  ]},
  { section: 'Settings', items: [
    { key: 'visitingCards', label: 'Visiting Cards', icon: 'fa-address-card', path: '/sales-marketing/visiting-cards', roles: ['Admin', 'Sales', 'BackOffice'], color: '#0369a1' },
    { key: 'team', label: 'Team Management', icon: 'fa-building', path: '/sales-marketing/team', roles: ['Admin'], color: '#6d28d9' },
    { key: 'activityLog', label: 'Activity Log', icon: 'fa-clipboard-list', path: '/sales-marketing/activity-log', roles: ['Admin'], color: '#475569' },
  ]},
]

export default function SMSidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { smUser, smLogout } = useSMAuth()

  function handleNavClick(path) {
    navigate(path)
    onClose()
  }

  function handleSignOut() {
    smLogout()
    navigate('/sales-marketing/login')
  }

  const initials = (smUser?.name || '?').charAt(0).toUpperCase()

  return (
    <>
      <div className={`sms-overlay ${isOpen ? 'show' : ''}`} onClick={onClose}></div>

      <aside className={`sm-sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sms-brand">
          <img src={casilicaLogo} alt="Casilica" className="sms-brand-logo" />
          <div className="sms-brand-text">
            <div className="sms-brand-name">Sales &amp; Marketing</div>
            <div className="sms-brand-tag">PRO CRM</div>
          </div>
        </div>

        <nav className="sms-nav">
          {NAV_ITEMS.map((group) => {
            const visibleItems = group.items.filter(item => item.roles.includes(smUser?.role))
            if (!visibleItems.length) return null

            return (
              <div key={group.section}>
                <div className="sms-section">{group.section}</div>
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.path
                  const label = (item.key === 'marketingKpi' && smUser?.role === 'Marketing') ? 'My KPI' : item.label
                  return (
                    <button
                      key={item.key}
                      className={`sms-nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleNavClick(item.path)}
                      title={isCollapsed ? label : undefined}
                    >
                      <span className="sms-icon-badge" style={{ background: `${item.color}26`, color: item.color }}>
                        <i className={`fas ${item.icon}`}></i>
                      </span>
                      <span className="sms-nav-label">{label}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="sms-footer">
          <div className="sms-user-chip">
            <div className="sms-user-av">{initials}</div>
            <div className="sms-user-text">
              <div className="sms-user-name">{smUser?.name || '—'}</div>
              <span className="sms-role-badge">{smUser?.role}</span>
            </div>
          </div>
          <button className="sms-signout-btn" onClick={handleSignOut} title="Sign Out">
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </aside>

      <button
        className={`sms-collapse-btn ${isCollapsed ? 'collapsed' : ''}`}
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'left'}`}></i>
      </button>
    </>
  )
}
