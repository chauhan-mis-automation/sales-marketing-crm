import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSMAuth } from '../context/SMAuthContext'
import TypewriterText from '../components/TypewriterText'
import casilicaLogo from '../assets/casilica-logo.jpeg'
import './Launcher.css'

export default function Launcher() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { smUser } = useSMAuth()

  function openCasilicaCRM() {
    navigate(user ? '/dashboard' : '/login')
  }

  function openSalesMarketingCRM() {
    navigate(smUser ? '/sales-marketing' : '/sales-marketing/login')
  }

  return (
    <div className="lp-wrap">
      <div className="lp-blob one"></div>
      <div className="lp-blob two"></div>
      <div className="lp-blob three"></div>

      <div className="lp-card-outer">
        <div className="lp-logo-box">
          <img src={casilicaLogo} alt="Casilica Logo" />
        </div>

        <h1 className="lp-title">
          <TypewriterText text="Welcome to Dashboard Portal" speed={45} />
        </h1>
        <p className="lp-subtitle">Choose the dashboard you want to open from the options below.</p>

        <div className="lp-cards-grid">
          <div className="lp-option-card">
            <div className="lp-option-icon"><i className="fas fa-chart-pie"></i></div>
            <h2>Casilica CRM</h2>
            <p>If you want to go to the Casilica CRM &amp; Enquiry Management Dashboard, then click the button below.</p>
            <button className="lp-open-btn" onClick={openCasilicaCRM}>
              Open Dashboard <i className="fas fa-arrow-right"></i>
            </button>
          </div>

          <div className="lp-option-card">
            <div className="lp-option-icon accent"><i className="fas fa-bullhorn"></i></div>
            <h2>Sales &amp; Marketing CRM</h2>
            <p>If you want to see the Sales &amp; Marketing CRM Dashboard, then click the button below.</p>
            <button className="lp-open-btn" onClick={openSalesMarketingCRM}>
              Open Dashboard <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
