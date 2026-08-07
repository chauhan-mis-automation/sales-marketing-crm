// import { useState } from 'react'
// import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
// import Login from './pages/Login'
// import Launcher from './pages/Launcher'
// import SMLogin from './pages/SMLogin'
// import SMDashboardLayout from './components/SMDashboardLayout'
// import SMDashboard from './pages/salesMarketing/SMDashboard'
// import SMComingSoon from './pages/salesMarketing/SMComingSoon'
// import SMAllContacts from './pages/salesMarketing/SMAllContacts'
// import SMMyContacts from './pages/salesMarketing/SMMyContacts'
// import SMUnassignedContacts from './pages/salesMarketing/SMUnassignedContacts'
// import { useSMAuth } from './context/SMAuthContext'
// import Dashboard from './pages/Dashboard'
// import Sidebar from './components/Sidebar'
// import Topbar from './components/Topbar'
// import { useAuth } from './context/AuthContext'
// import NewEnquiry from './pages/NewEnquiry'
// import AllEnquiries from './pages/AllEnquiries'
// import EnquiryDetail from './pages/EnquiryDetail'
// import UserManagement from './pages/UserManagement'
// import FollowupsQueue from './pages/queues/FollowupsQueue'
// import FlowchartsQueue from './pages/queues/FlowchartsQueue'
// import QuotationsQueue from './pages/queues/QuotationsQueue'
// import DrawingsQueue from './pages/queues/DrawingsQueue'
// import POApprovalsQueue from './pages/queues/POApprovalsQueue'
// import WorkOrdersQueue from './pages/queues/WorkOrdersQueue'
// import TATReport from './pages/TATReport'
// import OrderConversion from './pages/OrderConversion'
// import TeamPerformance from './pages/TeamPerformance'
// import ReportCard from './pages/ReportCard'
// import { useQueueBadges } from './lib/useQueueBadges'
// import NotificationPopup from './components/NotificationPopup'

// const PAGE_TITLES = {
//   '/dashboard': '📊 Dashboard',
//   '/enquiries': '📋 All Enquiries',
//   '/enquiries/new': '➕ New Enquiry',
//   '/followups': '🔔 Follow-ups',
//   '/flowcharts': '🗂 Flowcharts',
//   '/quotations': '💰 Quotations',
//   '/drawings': '📐 GA Drawings',
//   '/po-approvals': '📄 PO Approvals',
//   '/work-orders': '📋 Work Orders',
//   '/order-conversion': '📈 Order Conversion',
//   '/users': '👥 User Management',
//   '/tat': '📊 TAT Reports',
//   '/team-performance': '👥 Team Performance',
//   '/report-card': '📇 Report Card',
// }

// function DashboardLayout({ user, children }) {
//   const [mobileOpen, setMobileOpen] = useState(false)
//   const [collapsed, setCollapsed] = useState(false)
//   const location = useLocation()
//   const { badges } = useQueueBadges(user)
//   let title = PAGE_TITLES[location.pathname] || 'Dashboard'
//   if (location.pathname.startsWith('/enquiries/') && location.pathname !== '/enquiries/new') {
//     title = '🔍 Enquiry Detail'
//   }

//   return (
//     <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
//       <Sidebar
//         user={user}
//         isOpen={mobileOpen}
//         isCollapsed={collapsed}
//         onClose={() => setMobileOpen(false)}
//         onToggleCollapse={() => setCollapsed(!collapsed)}
//         badges={badges}
//       />
//       <main className="main-content" style={{ marginLeft: collapsed ? 0 : 252, transition: 'margin-left 0.28s' }}>
//         <Topbar title={title} onMobileToggle={() => setMobileOpen(true)} />
//         <div style={{ padding: 20 }}>
//           {children || <Dashboard user={user} />}
//         </div>
//       </main>
//       <NotificationPopup />
//     </div>
//   )
// }

// function ProtectedRoute({ user, allowedRoles, children }) {
//   if (!user) return <Navigate to="/login" />
//   if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/dashboard" />
//   return <DashboardLayout user={user}>{children}</DashboardLayout>
// }

// function SMProtectedRoute({ smUser, title, children }) {
//   if (!smUser) return <Navigate to="/sales-marketing/login" />
//   return <SMDashboardLayout title={title}>{children}</SMDashboardLayout>
// }

// export default function App() {
//   const { user } = useAuth()
//   const { smUser } = useSMAuth()

//   return (
//     <BrowserRouter>
//       <Routes>
//         <Route path="/login" element={<Login />} />
//         <Route path="/dashboard" element={user ? <DashboardLayout user={user} /> : <Navigate to="/login" />} />
//         <Route path="/" element={<Launcher />} />
//         <Route path="/sales-marketing/login" element={<SMLogin />} />
//         <Route path="/sales-marketing" element={<SMProtectedRoute smUser={smUser} title="Dashboard"><SMDashboard /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/leads" element={<SMProtectedRoute smUser={smUser} title="All Contacts"><SMAllContacts /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/my-leads" element={<SMProtectedRoute smUser={smUser} title="My Contacts"><SMMyContacts /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/unassigned" element={<SMProtectedRoute smUser={smUser} title="Unassigned"><SMUnassignedContacts /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/projects" element={<SMProtectedRoute smUser={smUser} title="All Projects"><SMAllProjects /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/calendar" element={<SMProtectedRoute smUser={smUser} title="Calendar"><SMComingSoon title="Calendar" icon="fa-calendar-alt" /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/followups" element={<SMProtectedRoute smUser={smUser} title="Follow-ups"><SMComingSoon title="Follow-ups" icon="fa-redo" /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/interactions" element={<SMProtectedRoute smUser={smUser} title="Interactions"><SMComingSoon title="Interactions" icon="fa-phone-alt" /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/sales" element={<SMProtectedRoute smUser={smUser} title="Sales Records"><SMComingSoon title="Sales Records" icon="fa-coins" /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/kpi" element={<SMProtectedRoute smUser={smUser} title="KPI & Reports"><SMComingSoon title="KPI & Reports" icon="fa-chart-line" /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/marketing-kpi" element={<SMProtectedRoute smUser={smUser} title="Marketing KPI"><SMComingSoon title="Marketing KPI" icon="fa-bullhorn" /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/expenses" element={<SMProtectedRoute smUser={smUser} title="Expense Report"><SMComingSoon title="Expense Report" icon="fa-receipt" /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/visiting-cards" element={<SMProtectedRoute smUser={smUser} title="Visiting Cards"><SMComingSoon title="Visiting Cards" icon="fa-address-card" /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/team" element={<SMProtectedRoute smUser={smUser} title="Team Management"><SMComingSoon title="Team Management" icon="fa-building" /></SMProtectedRoute>} />
//         <Route path="/sales-marketing/activity-log" element={<SMProtectedRoute smUser={smUser} title="Activity Log"><SMComingSoon title="Activity Log" icon="fa-clipboard-list" /></SMProtectedRoute>} />
//         <Route
//           path="/enquiries/new"
//           element={user ? <DashboardLayout user={user}><NewEnquiry /></DashboardLayout> : <Navigate to="/login" />}
//         />
//         <Route
//           path="/enquiries"
//           element={user ? <DashboardLayout user={user}><AllEnquiries /></DashboardLayout> : <Navigate to="/login" />}
//         />
//         <Route
//           path="/enquiries/:enquiryId"
//           element={user ? <DashboardLayout user={user}><EnquiryDetail /></DashboardLayout> : <Navigate to="/login" />}
//         />
//         <Route
//           path="/users"
//           element={
//             <ProtectedRoute user={user} allowedRoles={['admin', 'superadmin']}>
//               <UserManagement />
//             </ProtectedRoute>
//           }
//         />
//         <Route
//           path="/followups"
//           element={
//             <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin', 'followup']}>
//               <FollowupsQueue />
//             </ProtectedRoute>
//           }
//         />
//         <Route
//           path="/flowcharts"
//           element={
//             <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin', 'followup', 'backend']}>
//               <FlowchartsQueue />
//             </ProtectedRoute>
//           }
//         />
//         <Route
//           path="/quotations"
//           element={
//             <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin', 'followup', 'backend']}>
//               <QuotationsQueue />
//             </ProtectedRoute>
//           }
//         />
//         <Route
//           path="/drawings"
//           element={
//             <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin', 'design']}>
//               <DrawingsQueue />
//             </ProtectedRoute>
//           }
//         />
//         <Route
//           path="/po-approvals"
//           element={
//             <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin']}>
//               <POApprovalsQueue />
//             </ProtectedRoute>
//           }
//         />
//         <Route
//           path="/work-orders"
//           element={
//             <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin']}>
//               <WorkOrdersQueue />
//             </ProtectedRoute>
//           }
//         />
//         <Route
//           path="/tat"
//           element={
//             <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin']}>
//               <TATReport />
//             </ProtectedRoute>
//           }
//         />
//         <Route
//           path="/order-conversion"
//           element={
//             <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin']}>
//               <OrderConversion />
//             </ProtectedRoute>
//           }
//         />
//         <Route
//           path="/team-performance"
//           element={
//             <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin']}>
//               <TeamPerformance />
//             </ProtectedRoute>
//           }
//         />
//         <Route
//           path="/report-card"
//           element={
//             <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin', 'followup', 'frontend', 'backend', 'design']}>
//               <ReportCard />
//             </ProtectedRoute>
//           }
//         />
//       </Routes>
//     </BrowserRouter>
//   )
// }

import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Launcher from './pages/Launcher'
import SMLogin from './pages/SMLogin'
import SMDashboardLayout from './components/SMDashboardLayout'
import SMDashboard from './pages/salesMarketing/SMDashboard'
import SMComingSoon from './pages/salesMarketing/SMComingSoon'
import SMAllContacts from './pages/salesMarketing/SMAllContacts'
import SMAllProjects from './pages/salesMarketing/SMAllProjects'
import CalendarPage from './pages/CalendarPage'
import FollowUpsPage from './pages/FollowUpsPage'
import LogInteractionModal from './components/LogInteractionModal'
import SMExpenseReport from './pages/salesMarketing/SMExpenseReport'
import SMKPIReport from './pages/salesMarketing/SMKPIReport'
import SMMarketingKPIReport from './pages/salesMarketing/SMMarketingKPIReport'
import SMVisitingCards from './pages/salesMarketing/SMVisitingCards'
import SMTeamManagement from './pages/salesMarketing/SMTeamManagement'
import SMInteractions from './pages/salesMarketing/SMInteractions'
import SMActivityLog from './pages/salesMarketing/SMActivityLog'
import SMMyContacts from './pages/salesMarketing/SMMyContacts'
import SMUnassignedContacts from './pages/salesMarketing/SMUnassignedContacts'
import { useSMAuth } from './context/SMAuthContext'
import Dashboard from './pages/Dashboard'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import { useAuth } from './context/AuthContext'
import NewEnquiry from './pages/NewEnquiry'
import AllEnquiries from './pages/AllEnquiries'
import EnquiryDetail from './pages/EnquiryDetail'
import UserManagement from './pages/UserManagement'
import FollowupsQueue from './pages/queues/FollowupsQueue'
import FlowchartsQueue from './pages/queues/FlowchartsQueue'
import QuotationsQueue from './pages/queues/QuotationsQueue'
import DrawingsQueue from './pages/queues/DrawingsQueue'
import POApprovalsQueue from './pages/queues/POApprovalsQueue'
import WorkOrdersQueue from './pages/queues/WorkOrdersQueue'
import TATReport from './pages/TATReport'
import OrderConversion from './pages/OrderConversion'
import TeamPerformance from './pages/TeamPerformance'
import ReportCard from './pages/ReportCard'
import { useQueueBadges } from './lib/useQueueBadges'
import NotificationPopup from './components/NotificationPopup'

const PAGE_TITLES = {
  '/dashboard': '📊 Dashboard',
  '/enquiries': '📋 All Enquiries',
  '/enquiries/new': '➕ New Enquiry',
  '/followups': '🔔 Follow-ups',
  '/flowcharts': '🗂 Flowcharts',
  '/quotations': '💰 Quotations',
  '/drawings': '📐 GA Drawings',
  '/po-approvals': '📄 PO Approvals',
  '/work-orders': '📋 Work Orders',
  '/order-conversion': '📈 Order Conversion',
  '/users': '👥 User Management',
  '/tat': '📊 TAT Reports',
  '/team-performance': '👥 Team Performance',
  '/report-card': '📇 Report Card',
}

function DashboardLayout({ user, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { badges } = useQueueBadges(user)
  let title = PAGE_TITLES[location.pathname] || 'Dashboard'
  if (location.pathname.startsWith('/enquiries/') && location.pathname !== '/enquiries/new') {
    title = '🔍 Enquiry Detail'
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        user={user}
        isOpen={mobileOpen}
        isCollapsed={collapsed}
        onClose={() => setMobileOpen(false)}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        badges={badges}
      />
      <main className="main-content" style={{ marginLeft: collapsed ? 0 : 252, transition: 'margin-left 0.28s' }}>
        <Topbar title={title} onMobileToggle={() => setMobileOpen(true)} />
        <div style={{ padding: 20 }}>
          {children || <Dashboard user={user} />}
        </div>
      </main>
      <NotificationPopup />
    </div>
  )
}

function ProtectedRoute({ user, allowedRoles, children }) {
  if (!user) return <Navigate to="/login" />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/dashboard" />
  return <DashboardLayout user={user}>{children}</DashboardLayout>
}

function SMProtectedRoute({ smUser, title, children }) {
  if (!smUser) return <Navigate to="/sales-marketing/login" />
  return <SMDashboardLayout title={title}>{children}</SMDashboardLayout>
}

export default function App() {
  const { user } = useAuth()
  const { smUser } = useSMAuth()
  const [activeFollowUp, setActiveFollowUp] = useState(null)
  const [smRefreshKey, setSmRefreshKey] = useState(0)

  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={user ? <DashboardLayout user={user} /> : <Navigate to="/login" />} />
        <Route path="/" element={<Launcher />} />
        <Route path="/sales-marketing/login" element={<SMLogin />} />
        <Route path="/sales-marketing" element={<SMProtectedRoute smUser={smUser} title="Dashboard"><SMDashboard /></SMProtectedRoute>} />
        <Route path="/sales-marketing/leads" element={<SMProtectedRoute smUser={smUser} title="All Contacts"><SMAllContacts /></SMProtectedRoute>} />
        <Route path="/sales-marketing/my-leads" element={<SMProtectedRoute smUser={smUser} title="My Contacts"><SMMyContacts /></SMProtectedRoute>} />
        <Route path="/sales-marketing/unassigned" element={<SMProtectedRoute smUser={smUser} title="Unassigned"><SMUnassignedContacts /></SMProtectedRoute>} />
        <Route path="/sales-marketing/projects" element={<SMProtectedRoute smUser={smUser} title="All Projects"><SMAllProjects /></SMProtectedRoute>} />
        <Route path="/sales-marketing/calendar" element={<SMProtectedRoute smUser={smUser} title="Calendar"><CalendarPage key={smRefreshKey} currentUser={{ name: smUser?.name, userID: smUser?.userId }} isAdmin={smUser?.role === 'Admin' || smUser?.role === 'BackOffice'} onUpdateFollowUp={setActiveFollowUp} /></SMProtectedRoute>} />
        <Route path="/sales-marketing/followups" element={<SMProtectedRoute smUser={smUser} title="Follow-ups"><FollowUpsPage key={smRefreshKey} currentUser={{ name: smUser?.name, userID: smUser?.userId }} isAdmin={smUser?.role === 'Admin'} onUpdateFollowUp={setActiveFollowUp} /></SMProtectedRoute>} />
        <Route path="/sales-marketing/interactions" element={<SMProtectedRoute smUser={smUser} title="Interactions"><SMInteractions /></SMProtectedRoute>} />
        <Route path="/sales-marketing/sales" element={<SMProtectedRoute smUser={smUser} title="Sales Records"><SMComingSoon title="Sales Records" icon="fa-coins" /></SMProtectedRoute>} />
        <Route path="/sales-marketing/kpi" element={<SMProtectedRoute smUser={smUser} title="KPI & Reports"><SMKPIReport /></SMProtectedRoute>} />
        <Route path="/sales-marketing/marketing-kpi" element={<SMProtectedRoute smUser={smUser} title={smUser?.role === 'Marketing' ? 'My KPI' : 'Marketing KPI'}><SMMarketingKPIReport /></SMProtectedRoute>} />
        <Route path="/sales-marketing/expenses" element={<SMProtectedRoute smUser={smUser} title="Expense Report"><SMExpenseReport /></SMProtectedRoute>} />
        <Route path="/sales-marketing/visiting-cards" element={<SMProtectedRoute smUser={smUser} title="Visiting Cards"><SMVisitingCards /></SMProtectedRoute>} />
        <Route path="/sales-marketing/team" element={<SMProtectedRoute smUser={smUser} title="Team Management"><SMTeamManagement /></SMProtectedRoute>} />
        <Route path="/sales-marketing/activity-log" element={<SMProtectedRoute smUser={smUser} title="Activity Log"><SMActivityLog /></SMProtectedRoute>} />
        <Route
          path="/enquiries/new"
          element={user ? <DashboardLayout user={user}><NewEnquiry /></DashboardLayout> : <Navigate to="/login" />}
        />
        <Route
          path="/enquiries"
          element={user ? <DashboardLayout user={user}><AllEnquiries /></DashboardLayout> : <Navigate to="/login" />}
        />
        <Route
          path="/enquiries/:enquiryId"
          element={user ? <DashboardLayout user={user}><EnquiryDetail /></DashboardLayout> : <Navigate to="/login" />}
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute user={user} allowedRoles={['admin', 'superadmin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/followups"
          element={
            <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin', 'followup']}>
              <FollowupsQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/flowcharts"
          element={
            <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin', 'followup', 'backend']}>
              <FlowchartsQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quotations"
          element={
            <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin', 'followup', 'backend']}>
              <QuotationsQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/drawings"
          element={
            <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin', 'design']}>
              <DrawingsQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/po-approvals"
          element={
            <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin']}>
              <POApprovalsQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/work-orders"
          element={
            <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin']}>
              <WorkOrdersQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tat"
          element={
            <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin']}>
              <TATReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-conversion"
          element={
            <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin']}>
              <OrderConversion />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team-performance"
          element={
            <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin']}>
              <TeamPerformance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/report-card"
          element={
            <ProtectedRoute user={user} allowedRoles={['superadmin', 'admin', 'followup', 'frontend', 'backend', 'design']}>
              <ReportCard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>

    {activeFollowUp && (
      <LogInteractionModal
        followUp={activeFollowUp}
        currentUser={{ name: smUser?.name, userID: smUser?.userId }}
        onClose={() => setActiveFollowUp(null)}
        onSaved={() => setSmRefreshKey(k => k + 1)}
      />
    )}
    </>
  )
}