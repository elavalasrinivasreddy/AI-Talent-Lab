import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './components/Auth/LoginPage'
import RegisterPage from './components/Auth/RegisterPage'
import Sidebar from './components/Sidebar/Sidebar'
import NotificationBell from './components/common/NotificationBell'
import SettingsPage from './components/Settings/SettingsPage'
import { ChatProvider } from './context/ChatContext'
import ChatPage from './components/Chat/ChatPage'
import PositionsListPage from './components/Positions/PositionsListPage'
import PositionDetailPage from './components/Positions/PositionDetailPage'
import CandidateDetailPage from './components/Candidates/CandidateDetailPage'
import ApplyPage from './components/Apply/ApplyPage'
import DashboardPage from './components/Dashboard/DashboardPage'
import PanelPage from './components/Panel/PanelPage'
import TalentPoolPage from './components/TalentPool/TalentPoolPage'
import CareerPage from './components/Careers/CareerPage'
import DevAdminPage from './components/DevAdmin/DevAdminPage'
import DeleteMyDataPage from './components/GDPR/DeleteMyDataPage'
import CandidateStatusPage from './components/Status/CandidateStatusPage'
import AnalyticsPage from './components/Analytics/AnalyticsPage'
import PlatformPage from './components/Platform/PlatformPage'

// ── Auth Guard ──────────────────────────────────

function AuthGuard() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

function PublicGuard() {
  const { isAuthenticated, loading, user } = useAuth()
  if (loading) return null
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'platform_admin' ? '/platform' : '/chat'} replace />
  }
  return <Outlet />
}

// ── Layouts ─────────────────────────────────────

function AppLayout() {
  return (
    <ChatProvider>
      <div className="app-layout">
        <Sidebar />
        {/* Global top bar with notification bell */}
        <div className="app-topbar">
          <NotificationBell />
        </div>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </ChatProvider>
  )
}

// ── Router ──────────────────────────────────────

export const router = createBrowserRouter([
  // Public routes
  {
    element: <PublicGuard />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },

  // Protected routes
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // Chat
          { path: '/chat', element: <ChatPage /> },
          { path: '/chat/:sessionId', element: <ChatPage /> },

          // Positions
          { path: '/positions', element: <PositionsListPage /> },
          { path: '/positions/:id', element: <PositionDetailPage /> },
          { path: '/positions/:id/:tab', element: <PositionDetailPage /> },

          // Candidates
          { path: '/candidates/:id', element: <CandidateDetailPage /> },

          // Other pages
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/talent-pool', element: <TalentPoolPage /> },
          { path: '/interviews', element: <Navigate to="/positions" replace /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/settings/:tab', element: <SettingsPage /> },
          { path: '/analytics', element: <AnalyticsPage /> },
        ],
      },
    ],
  },

  // Platform admin — no sidebar layout, role-checked inside the component
  {
    element: <AuthGuard />,
    children: [
      { path: '/platform', element: <PlatformPage /> },
    ],
  },

  // Public pages (no auth) — magic links, career page, dev console
  { path: '/dev', element: <DevAdminPage /> },
  { path: '/apply/:token', element: <ApplyPage /> },
  { path: '/panel/:token', element: <PanelPage /> },
  { path: '/careers/:orgSlug', element: <CareerPage /> },
  { path: '/careers/:orgSlug/:positionId', element: <CareerPage /> },
  { path: '/delete-my-data', element: <DeleteMyDataPage /> },
  { path: '/privacy', element: <DeleteMyDataPage /> },
  { path: '/status/:token', element: <CandidateStatusPage /> },

  // Catch-all
  { path: '*', element: <Navigate to="/login" replace /> },
])
