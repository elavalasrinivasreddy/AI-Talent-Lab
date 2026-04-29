import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import SidebarSessions from './SidebarSessions'
import '../../styles/layout.css'

const NAV_ITEMS = [
  { section: 'Main', items: [
    { to: '/chat', icon: '💬', label: 'Chat' },
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  ]},
  { section: 'Hiring', items: [
    { to: '/positions', icon: '💼', label: 'Positions' },
    { to: '/talent-pool', icon: '👥', label: 'Talent Pool' },
    { to: '/interviews', icon: '🎯', label: 'Interviews' },
  ]},
  { section: 'System', items: [
    { to: '/settings', icon: '⚙️', label: 'Settings' },
  ]},
]

export default function Sidebar() {
  const { user, org, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
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
            ))}
          </div>
        ))}

        <SidebarSessions />
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="sidebar-user" title="Your Account" style={{ padding: '8px', flex: 1, marginRight: '4px' }}>
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name" style={{ maxWidth: '120px' }}>{user?.name || 'User'}</div>
              <div className="sidebar-user-role" style={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{org?.name || 'Organization'}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="btn btn-ghost" 
            title="Logout"
            style={{ padding: '8px', color: 'var(--color-danger)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
