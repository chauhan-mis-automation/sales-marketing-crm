import { useNavigate, useLocation } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import './Sidebar.css'

export default function Topbar({ title, onMobileToggle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isDashboard = location.pathname === '/dashboard'

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(240,244,241,.92)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid #d4e0d6', padding: '0 24px', height: 56,
      display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <button className="mobile-toggle" onClick={onMobileToggle}>
          <i className="fas fa-bars"></i>
        </button>
        <span style={{
          fontSize: 15, fontWeight: 700, color: '#1a2e1d', letterSpacing: '-.3px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
          {title}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button className="tb-ghost-btn" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i> <span className="tb-btn-label">Back</span>
        </button>
        <button className="tb-ghost-btn" onClick={() => window.location.reload()}>
          <i className="fas fa-sync-alt"></i> <span className="tb-btn-label">Refresh</span>
        </button>
        <NotificationBell />
        {isDashboard && (
          <button className="tb-primary-btn" onClick={() => navigate('/enquiries/new')}>
            <i className="fas fa-plus"></i> <span className="tb-btn-label">New Enquiry</span>
          </button>
        )}
      </div>
    </div>
  )
}