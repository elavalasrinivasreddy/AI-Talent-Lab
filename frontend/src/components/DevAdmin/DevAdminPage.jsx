/**
 * DevAdminPage.jsx — Developer tools for testing & DB management
 * Route: /dev-admin (only accessible in dev mode)
 */
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import './DevAdminPage.css'

const API_BASE = '/api/v1'

export default function DevAdminPage() {
  const { user, org, token } = useAuth()
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [log, setLog] = useState([])

  // Authenticated fetch helper
  const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`HTTP ${res.status}: ${err}`)
    }
    if (res.status === 204) return null
    return res.json()
  }

  useEffect(() => { if (token) loadStats() }, [token])

  const addLog = (msg, type = 'info') => {
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 49)])
  }

  const loadStats = async () => {
    try {
      const data = await apiFetch('/dev/db-stats')
      setStats(data.table_counts)
      addLog('Stats loaded', 'info')
    } catch (e) {
      addLog(`Error loading stats: ${e.message}`, 'error')
    }
  }

  const loadSessions = async () => {
    try {
      const data = await apiFetch('/dev/chat-sessions')
      setSessions(data.sessions || [])
      addLog(`Loaded ${data.sessions?.length || 0} sessions`, 'info')
    } catch (e) {
      addLog(`Error: ${e.message}`, 'error')
    }
  }

  const loadUsers = async () => {
    try {
      const data = await apiFetch('/dev/users')
      setUsers(data.users || [])
      addLog(`Loaded ${data.users?.length || 0} users`, 'info')
    } catch (e) {
      addLog(`Error: ${e.message}`, 'error')
    }
  }

  const handleReset = async (type, label) => {
    if (!confirm(`⚠️ This will delete ${label}. Are you sure?`)) return
    setLoading(true)
    try {
      await apiFetch(`/dev/reset/${type}`, { method: 'DELETE' })
      addLog(`✅ ${label} reset successfully`, 'success')
      await loadStats()
    } catch (e) {
      addLog(`❌ Reset failed: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = async (tab) => {
    setActiveTab(tab)
    if (tab === 'sessions') await loadSessions()
    if (tab === 'users') await loadUsers()
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'sessions', label: '💬 Sessions' },
    { id: 'users', label: '👥 Users' },
    { id: 'reset', label: '🗑 Reset' },
    { id: 'log', label: '📋 Log' },
  ]

  return (
    <div className="dev-admin-page">
      <div className="dev-admin-header">
        <div>
          <h1 className="dev-admin-title">
            🛠 Developer Admin
            <span className="dev-badge">DEV MODE</span>
          </h1>
          <p className="dev-admin-sub">Testing console — manage DB, inspect state, reset data</p>
        </div>
        <div className="dev-info-chips">
          <span className="dev-chip">Org: <strong>{org?.name}</strong></span>
          <span className="dev-chip">User: <strong>{user?.name}</strong></span>
          <span className="dev-chip role">Role: <strong>{user?.role}</strong></span>
        </div>
      </div>

      <div className="dev-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`dev-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => handleTabChange(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="dev-content">

        {activeTab === 'overview' && (
          <div>
            <div className="dev-section-header">
              Database row counts for <strong>{org?.name}</strong>
              <button className="dev-btn dev-btn--sm" onClick={loadStats}>↺ Refresh</button>
            </div>
            {stats ? (
              <div className="dev-stats-grid">
                {Object.entries(stats).map(([table, count]) => (
                  <div key={table} className="dev-stat-card">
                    <div className="dev-stat-table">{table}</div>
                    <div className="dev-stat-count">{typeof count === 'number' ? count : count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dev-loading">Loading...</div>
            )}

            <div className="dev-guide">
              <h3>🗺 How to test</h3>
              <ol>
                <li><strong>Register</strong> at <code>/register</code> — creates admin + default data</li>
                <li><strong>Create departments</strong> at Settings → Departments</li>
                <li><strong>Add users</strong> at Settings → Team (different roles)</li>
                <li><strong>Start a position</strong> via ✨ New Hire → chat</li>
                <li><strong>Reset data</strong> using the Reset tab for a clean slate</li>
              </ol>
              <h3>🔑 Role-based views</h3>
              <table className="dev-table">
                <thead><tr><th>Role</th><th>Dashboard</th><th>Positions Visible</th></tr></thead>
                <tbody>
                  <tr><td><code>admin</code></td><td>Director — org-wide</td><td>All</td></tr>
                  <tr><td><code>hiring_manager</code></td><td>Manager — dept only</td><td>Dept only</td></tr>
                  <tr><td><code>recruiter</code></td><td>Recruiter — assigned</td><td>Assigned only</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div>
            <div className="dev-section-header">
              All chat sessions (including deleted)
              <button className="dev-btn dev-btn--sm" onClick={loadSessions}>↺ Refresh</button>
            </div>
            <table className="dev-table">
              <thead>
                <tr><th>ID</th><th>Title</th><th>Stage</th><th>Status</th><th>Created</th></tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} style={{ opacity: s.status === 'deleted' ? 0.4 : 1 }}>
                    <td><code style={{ fontSize: 11 }}>{s.id?.slice(0, 8)}…</code></td>
                    <td>{s.title}</td>
                    <td><span className="dev-badge-sm">{s.workflow_stage}</span></td>
                    <td><span className={`dev-badge-sm ${s.status === 'deleted' ? 'deleted' : 'active'}`}>{s.status || 'active'}</span></td>
                    <td style={{ fontSize: 11 }}>{s.created_at ? new Date(s.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {sessions.length === 0 && <tr><td colSpan={5} className="dev-empty-cell">No sessions</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <div className="dev-section-header">
              All users in {org?.name}
              <button className="dev-btn dev-btn--sm" onClick={loadUsers}>↺ Refresh</button>
            </div>
            <table className="dev-table">
              <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Dept</th><th>Active</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.name}</td>
                    <td><code style={{ fontSize: 11 }}>{u.email}</code></td>
                    <td><span className="dev-badge-sm">{u.role}</span></td>
                    <td>{u.department_id || '—'}</td>
                    <td>{u.is_active ? '✅' : '❌'}</td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={6} className="dev-empty-cell">No users</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'reset' && (
          <div>
            <div className="dev-section-header">⚠️ Immediate & irreversible operations</div>
            <div className="dev-reset-grid">
              <ResetCard title="Chat Sessions" desc="Delete all JD chat sessions and messages." icon="💬" onClick={() => handleReset('chat-sessions', 'all chat sessions')} loading={loading} />
              <ResetCard title="Positions" desc="Delete all positions, applications, pipeline events." icon="💼" onClick={() => handleReset('positions', 'all positions')} loading={loading} />
              <ResetCard title="Notifications" desc="Clear all in-app notifications." icon="🔔" onClick={() => handleReset('notifications', 'all notifications')} loading={loading} />
              <ResetCard title="🔴 Reset All" desc="Nuclear: deletes everything except org/users/departments." icon="☢️" danger onClick={() => handleReset('all', 'ALL business data')} loading={loading} />
            </div>
          </div>
        )}

        {activeTab === 'log' && (
          <div>
            <div className="dev-section-header">
              Action log (this session)
              <button className="dev-btn dev-btn--sm" onClick={() => setLog([])}>Clear</button>
            </div>
            <div className="dev-log">
              {log.length === 0 && <div style={{ color: 'var(--color-text-muted)', padding: 16 }}>No actions yet</div>}
              {log.map((entry, i) => (
                <div key={i} className={`dev-log-entry ${entry.type}`}>
                  <span className="dev-log-time">{entry.time}</span>
                  <span className="dev-log-msg">{entry.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ResetCard({ title, desc, icon, danger, onClick, loading }) {
  return (
    <div className={`dev-reset-card ${danger ? 'danger' : ''}`}>
      <div className="dev-reset-icon">{icon}</div>
      <h3 className="dev-reset-title">{title}</h3>
      <p className="dev-reset-desc">{desc}</p>
      <button className={`dev-btn ${danger ? 'dev-btn--danger' : 'dev-btn--default'}`} onClick={onClick} disabled={loading}>
        {loading ? 'Processing…' : danger ? '⚠️ Reset All' : `Reset`}
      </button>
    </div>
  )
}
