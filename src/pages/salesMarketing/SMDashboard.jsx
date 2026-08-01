import { useSMAuth } from '../../context/SMAuthContext'
import SMAdminDashboard from './SMAdminDashboard'
import SMSalesDashboard from './SMSalesDashboard'
import SMBackOfficeDashboard from './SMBackOfficeDashboard'
import SMMarketingDashboard from './SMMarketingDashboard'

export default function SMDashboard() {
  const { smUser } = useSMAuth()

  switch (smUser?.role) {
    case 'Admin': return <SMAdminDashboard />
    case 'Sales': return <SMSalesDashboard />
    case 'BackOffice': return <SMBackOfficeDashboard />
    case 'Marketing': return <SMMarketingDashboard />
    default: return <SMAdminDashboard />
  }
}
