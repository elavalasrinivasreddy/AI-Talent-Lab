import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { useAuth } from './context/AuthContext'

// ── Static imports (small / always needed on first render) ──────────────────
import LoginPage from './components/Auth/LoginPage'
import RegisterPage from './components/Auth/RegisterPage'
import MagicLinkExchange from './components/Auth/MagicLinkExchange'
import ForgotPasswordPage from './components/Auth/ForgotPasswordPage'
import ResetPasswordPage from './components/Auth/ResetPasswordPage'
import SetPasswordPage from './components/Auth/SetPasswordPage'
import Sidebar from './components/Sidebar/Sidebar'
import NotificationBell from './components/common/NotificationBell'
import SettingsPage from './components/Settings/SettingsPage'
import { ChatProvider } from './context/ChatContext'
import DashboardPage from './components/Dashboard/DashboardPage'
import ApplyPage from './components/Apply/ApplyPage'
import PanelPage from './components/Panel/PanelPage'
import CareerPage from './components/Careers/CareerPage'
import DeleteMyDataPage from './components/GDPR/DeleteMyDataPage'
import CandidateStatusPage from './components/Status/CandidateStatusPage'
import PositionsListPage from './components/Positions/PositionsListPage'

// ── Lazy imports (heavy pages — code-split into separate chunks) ─────────────
const ChatPage             = lazy(() => import('./components/Chat/ChatPage'))
const PositionDetailPage   = lazy(() => import('./components/Positions/PositionDetailPage'))
const CandidateDetailPage  = lazy(() => import('./components/Candidates/CandidateDetailPage'))
const AnalyticsPage        = lazy(() => import('./components/Analytics/AnalyticsPage'))
const TalentPoolPage       = lazy(() => import('./components/TalentPool/TalentPoolPage'))
const HireRequestListPage  = lazy(() => import('./components/HireRequests/HireRequestListPage'))
const HireRequestForm      = lazy(() => import('./components/HireRequests/HireRequestForm'))
const HireRequestDetailPage = lazy(() => import('./components/HireRequests/HireRequestDetailPage'))
const InterviewsListPage   = lazy(() => import('./components/Interviews/InterviewsListPage'))
const DevAdminPage         = lazy(() => import('./components/DevAdmin/DevAdminPage'))
const PlatformPage         = lazy(() => import('./components/Platform/PlatformPage'))

// ── Shared fallback ──────────────────────────────────────────────────────────
const PageLoading = <div className="page-loading">Loading…</div>

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
    return <Navigate to={user?.role === 'platform_admin' ? '/platform' : '/dashboard'} replace />
  }
  return <Outlet />
}

// ── Role Guard (role allowlist within authenticated zone) ────────────────────

function RoleGuard({ roles }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!roles.includes(user?.role)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// ── Dev Guard (platform_admin only) ─────────────────────────────────────────

function DevGuard() {
  const { isAuthenticated, loading, user } = useAuth()
  if (loading) return null
  // Dev console is accessible without login, but if logged in as a non-platform_admin
  // org user, redirect away to avoid confusion. Unauthenticated access is allowed
  // so developers can create first users without a session.
  if (isAuthenticated && user?.role !== 'platform_admin') {
    return <Navigate to="/dashboard" replace />
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
          <Suspense fallback={PageLoading}>
            <Outlet />
          </Suspense>
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
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password/:token', element: <ResetPasswordPage /> },
      { path: '/set-password/:token', element: <SetPasswordPage /> },
    ],
  },

  // Magic-link exchange — always accessible, even when logged in (re-login flow)
  { path: '/auth/verify', element: <MagicLinkExchange /> },

  // Protected routes
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // Chat — hr and org_head only; team_lead enters via /hire-requests/new
          {
            element: <RoleGuard roles={['hr', 'org_head']} />,
            children: [
              { path: '/chat', element: <ChatPage /> },
              { path: '/chat/:sessionId', element: <ChatPage /> },
            ],
          },

          // Analytics — admin tiers only; recruiters/team leads see no per-recruiter data
          {
            element: <RoleGuard roles={['org_head', 'dept_admin', 'platform_admin']} />,
            children: [
              { path: '/analytics', element: <AnalyticsPage /> },
            ],
          },

          // Positions
          { path: '/positions', element: <PositionsListPage /> },
          { path: '/positions/:id', element: <PositionDetailPage /> },
          { path: '/positions/:id/:tab', element: <PositionDetailPage /> },

          // Candidates
          { path: '/candidates/:id', element: <CandidateDetailPage /> },

          // Other pages
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/talent-pool', element: <TalentPoolPage /> },
          { path: '/interviews', element: <InterviewsListPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/settings/:tab', element: <SettingsPage /> },

          // Hire requests
          { path: '/hire-requests', element: <HireRequestListPage /> },
          { path: '/hire-requests/new', element: <HireRequestForm mode="create" /> },
          { path: '/hire-requests/:id', element: <HireRequestDetailPage /> },
          { path: '/hire-requests/:id/edit', element: <HireRequestForm mode="edit" /> },
        ],
      },
    ],
  },

  // Platform admin — no sidebar layout, role-checked inside the component
  {
    element: <AuthGuard />,
    children: [
      {
        path: '/platform',
        element: (
          <Suspense fallback={PageLoading}>
            <PlatformPage />
          </Suspense>
        ),
      },
    ],
  },

  // Dev console — unauthenticated allowed, but org-role users are redirected away
  {
    element: <DevGuard />,
    children: [
      {
        path: '/dev',
        element: (
          <Suspense fallback={PageLoading}>
            <DevAdminPage />
          </Suspense>
        ),
      },
    ],
  },
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
