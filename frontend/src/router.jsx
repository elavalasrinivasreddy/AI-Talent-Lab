import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './components/Auth/LoginPage'
import RegisterPage from './components/Auth/RegisterPage'
import Sidebar from './components/Sidebar/Sidebar'

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
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

// ── Placeholder pages (to be built in later steps) ──

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
          { path: '/chat', element: <PlaceholderPage title="Chat" icon="💬" /> },
          { path: '/dashboard', element: <PlaceholderPage title="Dashboard" icon="📊" /> },
          { path: '/positions', element: <PlaceholderPage title="Positions" icon="💼" /> },
          { path: '/positions/:id', element: <PlaceholderPage title="Position Detail" icon="📋" /> },
          { path: '/talent-pool', element: <PlaceholderPage title="Talent Pool" icon="👥" /> },
          { path: '/interviews', element: <PlaceholderPage title="Interviews" icon="🎯" /> },
          { path: '/settings', element: <PlaceholderPage title="Settings" icon="⚙️" /> },
        ],
      },
    ],
  },

  // Public pages (no auth)
  { path: '/apply/:token', element: <PlaceholderPage title="Apply" icon="📝" /> },
  { path: '/panel/:token', element: <PlaceholderPage title="Panel Feedback" icon="📝" /> },
  { path: '/careers/:slug', element: <PlaceholderPage title="Career Page" icon="🏢" /> },

  // Catch-all
  { path: '*', element: <Navigate to="/login" replace /> },
])
