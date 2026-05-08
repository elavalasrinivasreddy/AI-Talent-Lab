import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import SidebarSessions from './SidebarSessions'
import '../../styles/layout.css'

const NAV_ITEMS = [
  { section: 'Main', items: [
    { to: '/chat', icon: '✨', label: 'New Hire' },
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  ]},
  { section: 'Hiring', items: [
    { to: '/positions', icon: '💼', label: 'Positions' },
    { to: '/talent-pool', icon: '🗃', label: 'Talent Pool' },
    { to: '/interviews', icon: '🎙', label: 'Interviews' },
  ]},
  { section: 'System', items: [
    { to: '/settings', icon: '⚙️', label: 'Settings' },
    { to: '/dev-admin', icon: '🛠', label: 'Dev Tools' },
  ]},
]

export default function Sidebar() {
  const { user, org, logout } = useAuth()
  const navigate = useNavigate()
  const { messages, workflowStage, resetChat } = useChat()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleNewHire = () => {
    // Only reset if current session is drafted/complete or empty
    // Or if user explicitly wants to start fresh
    if (workflowStage === 'complete' || messages.length === 0) {
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

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo">AI <span>Talent</span> Lab</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((section) => (
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
                  {item.label}
                </NavLink>
              )
            ))}
            {section.section === 'System' && <SidebarSessions />}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
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
