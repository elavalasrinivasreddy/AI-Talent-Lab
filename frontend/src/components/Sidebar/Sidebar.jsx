import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { hireRequestsApi } from '../../utils/api'
import SidebarSessions from './SidebarSessions'
import '../../styles/layout.css'

// Inline Lucide-style SVG icons (no external deps)
const SvgIcon = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const Icons = {
  sparkles:   <SvgIcon><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></SvgIcon>,
  dashboard:  <SvgIcon><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></SvgIcon>,
  briefcase:  <SvgIcon><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></SvgIcon>,
  users:      <SvgIcon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></SvgIcon>,
  trending:   <SvgIcon><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></SvgIcon>,
  settings:   <SvgIcon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></SvgIcon>,
  terminal:   <SvgIcon><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></SvgIcon>,
  inbox:      <SvgIcon><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></SvgIcon>,
  calendar:   <SvgIcon><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></SvgIcon>,
}

// roles: which roles can see this item. Omit = all roles.
const ALL_NAV = [
  { section: 'Main', items: [
    { to: '/chat',      icon: Icons.sparkles,  label: 'New Hire',   roles: ['org_head', 'dept_admin', 'hr'] },
    { to: '/dashboard', icon: Icons.dashboard, label: 'Dashboard' },
  ]},
  { section: 'Hiring', items: [
    { to: '/positions',     icon: Icons.briefcase, label: 'Positions', badge: 'positions_pending' },
    { to: '/interviews',    icon: Icons.calendar,  label: 'Interviews' },
    { to: '/hire-requests', icon: Icons.inbox,     label: 'Hire Requests', roles: ['dept_admin', 'hr', 'team_lead'], badge: 'hire_requests_pending' },
    { to: '/talent-pool',   icon: Icons.users,     label: 'Talent Pool',   roles: ['org_head', 'dept_admin', 'hr'] },
    { to: '/analytics',     icon: Icons.trending,  label: 'Analytics',     roles: ['org_head', 'dept_admin', 'hr'] },
  ]},
  { section: 'System', items: [
    { to: '/settings', icon: Icons.settings, label: 'Settings' },
    { to: '/dev',      icon: Icons.terminal, label: 'Dev Tools',   roles: ['platform_admin'] },
  ]},
]

function getNavForRole(role) {
  return ALL_NAV.map(section => ({
    ...section,
    items: section.items.filter(item => !item.roles || item.roles.includes(role)),
  })).filter(section => section.items.length > 0)
}

export default function Sidebar() {
  const { user, org, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { messages, workflowStage, resetChat } = useChat()

  // Sidebar badge counts. Currently only hire-requests pending count is
  // shown; refresh when the user navigates to or away from /hire-requests
  // (so picking up or filing reflects immediately) and once per minute.
  const [badges, setBadges] = useState({})

  useEffect(() => {
    const role = user?.role
    if (!role) return
    // team_lead doesn't need the org-wide pending count; their "Mine"
    // tab is the meaningful one and we don't have a count for that yet.
    if (!['dept_admin', 'hr', 'team_lead', 'org_head'].includes(role)) return

    let cancelled = false
    const refresh = async () => {
      try {
        const [hrData, posData] = await Promise.all([
          ['dept_admin', 'hr'].includes(role) ? hireRequestsApi.pendingCount() : Promise.resolve({ count: 0 }),
          ['team_lead', 'dept_admin', 'org_head'].includes(role) ? import('../../utils/api').then(m => m.positionsApi.pendingCount()) : Promise.resolve({ count: 0 })
        ])
        if (!cancelled) {
          setBadges(b => ({ 
            ...b, 
            hire_requests_pending: hrData?.count ?? 0,
            positions_pending: posData?.count ?? 0
          }))
        }
      } catch {
        // sidebar badge is best-effort
      }
    }
    refresh()
    const intervalId = setInterval(refresh, 60_000)
    return () => { cancelled = true; clearInterval(intervalId) }
  }, [user?.role, location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleNewHire = () => {
    // Only reset if current session is drafted/complete or empty (only greeting message)
    // Or if user explicitly wants to start fresh
    if (workflowStage === 'complete' || messages.length <= 1) {
      resetChat()
      navigate('/chat')
    } else {
      // Optional: Show a toast or confirm if they want to abandon current progress
      if (window.confirm("Abandon current JD generation and start a new one?")) {
        resetChat()
        navigate('/chat')
      }
    }
  }

  const role = user?.role || 'hr'
  const navItems = getNavForRole(role)

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="sidebar-logo">AI <span>Talent</span> Lab</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((section) => (
          <div key={section.section} className="sidebar-section">
            <div className="sidebar-section-label">{section.section}</div>
            {section.items.map((item) => (
              item.label === 'New Hire' ? (
                <button
                  key={item.to}
                  onClick={handleNewHire}
                  className="sidebar-link"
                  style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', padding: '12px 16px' }}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {item.label}
                </button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'active' : ''}`
                  }
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && badges[item.badge] > 0 && (
                    <span className="sidebar-badge">{badges[item.badge]}</span>
                  )}
                </NavLink>
              )
            ))}
            {section.section === 'System' && <SidebarSessions />}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ marginBottom: '12px', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--color-primary)', textTransform: 'capitalize' }}>
          Role: {role.replace('_', ' ')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-role" style={{ maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {org?.name || 'Organization'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-ghost"
            title="Logout"
            style={{ padding: '8px', color: 'var(--color-danger)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
