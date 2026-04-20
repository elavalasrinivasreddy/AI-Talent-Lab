import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
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
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={handleLogout} title="Click to logout">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-role">{org?.name || 'Organization'}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
