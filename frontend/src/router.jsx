import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
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
import { ChatProvider } from './context/ChatContext'

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

const SettingsPage         = lazy(() => import('./components/Settings/SettingsPage'))
const DashboardPage        = lazy(() => import('./components/Dashboard/DashboardPage'))
const ApplyPage            = lazy(() => import('./components/Apply/ApplyPage'))
const PanelPage            = lazy(() => import('./components/Panel/PanelPage'))
const CareerPage           = lazy(() => import('./components/Careers/CareerPage'))
const CareersIndexPage     = lazy(() => import('./components/Careers/CareersIndexPage'))
const DeleteMyDataPage     = lazy(() => import('./components/GDPR/DeleteMyDataPage'))
const CandidateStatusPage  = lazy(() => import('./components/Status/CandidateStatusPage'))
const CandidateLogin = lazy(() => import('./pages/CandidatePortal/CandidateLogin'))
const CandidateDashboard = lazy(() => import('./pages/CandidatePortal/CandidateDashboard'))
const PositionsListPage    = lazy(() => import('./components/Positions/PositionsListPage'))

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

// ── Org Guard (Tenant isolation) ─────────────────────────────────────────────

function OrgGuard() {
  const { user, loading } = useAuth()
  if (loading) return null
  // Platform admins (SaaS owners) should not access tenant-specific workspaces
  if (user?.role === 'platform_admin') return <Navigate to="/platform" replace />
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
  const location = useLocation()
  const isChatPage = location.pathname.startsWith('/chat')

  return (
    <ChatProvider>
      <div className="app-layout">
        <Sidebar />
        {/* Hide global top bar on chat page to maximize vertical space */}
        {!isChatPage && (
          <div className="app-topbar">
            <NotificationBell />
          </div>
        )}
        <main className={`app-main ${isChatPage ? 'app-main--full' : ''}`}>
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
        element: <OrgGuard />,
        children: [
          {
            element: <AppLayout />,
            children: [
              // Chat — hr, org_head, and dept_admin only; team_lead enters via /hire-requests/new
              {
                element: <RoleGuard roles={['hr', 'org_head', 'dept_admin']} />,
                children: [
                  { path: '/chat', element: <ChatPage /> },
                  { path: '/chat/:sessionId', element: <ChatPage /> },
                ],
              },

              // Analytics — admin tiers only; recruiters/team leads see no per-recruiter data
              {
                element: <RoleGuard roles={['org_head', 'dept_admin']} />,
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
              {
                element: <RoleGuard roles={['org_head', 'dept_admin', 'hr']} />,
                children: [
                  { path: '/talent-pool', element: <TalentPoolPage /> },
                ],
              },
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
  { path: '/apply/:token', element: <Suspense fallback={PageLoading}><ApplyPage /></Suspense> },
  { path: '/panel/:token', element: <Suspense fallback={PageLoading}><PanelPage /></Suspense> },
  { path: '/careers', element: <Suspense fallback={PageLoading}><CareersIndexPage /></Suspense> },
  { path: '/careers/:orgSlug', element: <Suspense fallback={PageLoading}><CareerPage /></Suspense> },
  { path: '/careers/:orgSlug/positions/:positionId', element: <Suspense fallback={PageLoading}><CareerPage /></Suspense> },
  { path: '/delete-my-data', element: <Suspense fallback={PageLoading}><DeleteMyDataPage /></Suspense> },
  { path: '/privacy', element: <Suspense fallback={PageLoading}><DeleteMyDataPage /></Suspense> },
  { path: '/status/:token', element: <Suspense fallback={PageLoading}><CandidateStatusPage /></Suspense> },
  { path: '/candidate/login', element: <Suspense fallback={PageLoading}><CandidateLogin /></Suspense> },
  { path: '/candidate/dashboard', element: <Suspense fallback={PageLoading}><CandidateDashboard /></Suspense> },

  // Catch-all
  { path: '*', element: <Navigate to="/login" replace /> },
])
