import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SMSidebar from './SMSidebar'
import SMNotificationPopup from './SMNotificationPopup'
import './SMDashboardLayout.css'

export default function SMDashboardLayout({ title, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="sm-shell">
      <SMSidebar
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isCollapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      <main className={`sm-main ${collapsed ? 'collapsed' : ''}`}>
        <div className="sm-topbar">
          <button className="sm-mobile-toggle" onClick={() => setMobileOpen(true)}>
            <i className="fas fa-bars"></i>
          </button>
          <span className="sm-topbar-title">{title}</span>
          <div className="sm-topbar-actions">
            <button className="sm-back-btn" onClick={() => navigate(-1)}>
              <i className="fas fa-arrow-left"></i> <span>Back</span>
            </button>
            <button className="sm-refresh-btn" onClick={() => window.location.reload()}>
              <i className="fas fa-sync-alt"></i> <span>Refresh</span>
            </button>
          </div>
        </div>
        <div className="sm-page-content">
          {children}
        </div>
      </main>

      <SMNotificationPopup />
    </div>
  )
}
