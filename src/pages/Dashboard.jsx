import StandardDashboard from './dashboards/StandardDashboard'
import BackendDashboard from './dashboards/BackendDashboard'
import FrontendDashboard from './dashboards/FrontendDashboard'
import DesignerDashboard from './dashboards/DesignerDashboard'

export default function Dashboard({ user }) {
  const role = (user?.role || '').toLowerCase().trim()

  if (role === 'backend') return <BackendDashboard user={user} />
  if (role === 'frontend') return <FrontendDashboard user={user} />
  if (role === 'design') return <DesignerDashboard user={user} />

  // admin, superadmin, followup — sab standard dashboard dekhte hain
  return <StandardDashboard user={user} />
}