import { useNavigate } from 'react-router-dom'
import { useSMAuth } from '../context/SMAuthContext'
import './SalesMarketingPlaceholder.css'

export default function SalesMarketingPlaceholder() {
  const navigate = useNavigate()
  const { smUser, smLogout } = useSMAuth()

  function handleSignOut() {
    smLogout()
    navigate('/sales-marketing/login')
  }

  return (
    <div className="smp-wrap">
      <div className="smp-icon"><i className="fas fa-bullhorn"></i></div>
      <h1>Sales &amp; Marketing CRM</h1>
      {smUser && (
        <p className="smp-welcome">Logged in as <strong>{smUser.name}</strong> ({smUser.role})</p>
      )}
      <p>This section is under construction — check back soon.</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="smp-back-btn" onClick={() => navigate('/')}>
          <i className="fas fa-arrow-left"></i> Back to Portal
        </button>
        <button className="smp-back-btn" onClick={handleSignOut}>
          <i className="fas fa-sign-out-alt"></i> Sign Out
        </button>
      </div>
    </div>
  )
}
