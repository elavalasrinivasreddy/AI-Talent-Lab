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

// ── Auth Guard ──────────────────────────────────

function AuthGuard() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

function PublicGuard() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (isAuthenticated) return <Navigate to="/chat" replace />
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

// ── Placeholder pages (phases not yet built) ────

function PlaceholderPage({ title, icon }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '60vh', gap: 'var(--space-4)',
      animation: 'fadeInUp 400ms ease both',
    }}>
      <span style={{ fontSize: '3rem' }}>{icon}</span>
      <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>{title}</h2>
      <p style={{ color: 'var(--color-text-secondary)' }}>Coming in the next build step</p>
    </div>
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

          // Other tabs (future steps)
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/talent-pool', element: <TalentPoolPage /> },
          { path: '/interviews', element: <PlaceholderPage title="Interviews" icon="🎙" /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/settings/:tab', element: <SettingsPage /> },
        ],
      },
    ],
  },

  // Public pages (no auth) — magic links, career page
  { path: '/apply/:token', element: <ApplyPage /> },
  { path: '/panel/:token', element: <PanelPage /> },
  { path: '/careers/:orgSlug', element: <CareerPage /> },
  { path: '/careers/:orgSlug/:positionId', element: <CareerPage /> },

  // Catch-all
  { path: '*', element: <Navigate to="/login" replace /> },
])
