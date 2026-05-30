/**
 * DevAdminPage.jsx — Developer console. Public route (/dev), no auth required.
 * Only functional when backend DEV_MODE=true.
 */
import { useState, useEffect, useCallback } from 'react'
import './DevAdminPage.css'

const API = '/api/v1/dev'

const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(err)
  }
  if (res.status === 204) return null
  return res.json()
}

const TABS = [
  { id: 'overview',  label: '📊 Overview' },
  { id: 'users',     label: '👥 Users' },
  { id: 'sessions',  label: '💬 Sessions' },
  { id: 'reset',     label: '🗑 Reset' },
  { id: 'log',       label: '📋 Log' },
]

export default function DevAdminPage() {
  const [activeTab, setActiveTab]     = useState('overview')
  const [orgs, setOrgs]               = useState([])
  const [selectedOrgId, setSelectedOrgId] = useState(null)
  const [stats, setStats]             = useState(null)
  const [sessions, setSessions]       = useState([])
  const [users, setUsers]             = useState([])
  const [loading, setLoading]         = useState(false)
  const [log, setLog]                 = useState([])

  const addLog = (msg, type = 'info') =>
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 49)])

  const loadOrgs = useCallback(async () => {
    try {
      const data = await apiFetch('/orgs')
      setOrgs(data.orgs || [])
      if (data.orgs?.length > 0 && !selectedOrgId) setSelectedOrgId(data.orgs[0].id)
    } catch (e) {
      addLog(`Could not reach dev API: ${e.message}. Is backend running with DEV_MODE=true?`, 'error')
    }
  }, [selectedOrgId])

  const loadStats = useCallback(async () => {
    try {
      const params = selectedOrgId ? `?org_id=${selectedOrgId}` : ''
      const data = await apiFetch(`/db-stats${params}`)
      setStats(data.table_counts)
      addLog('Stats refreshed', 'info')
    } catch (e) {
      addLog(`Stats error: ${e.message}`, 'error')
    }
  }, [selectedOrgId])

  const loadSessions = useCallback(async () => {
    try {
      const params = selectedOrgId ? `?org_id=${selectedOrgId}` : ''
      const data = await apiFetch(`/chat-sessions${params}`)
      setSessions(data.sessions || [])
      addLog(`Loaded ${data.sessions?.length || 0} sessions`, 'info')
    } catch (e) {
      addLog(`Sessions error: ${e.message}`, 'error')
    }
  }, [selectedOrgId])

  const loadUsers = useCallback(async () => {
    try {
      const params = selectedOrgId ? `?org_id=${selectedOrgId}` : ''
      const data = await apiFetch(`/users${params}`)
      setUsers(data.users || [])
      addLog(`Loaded ${data.users?.length || 0} users`, 'info')
    } catch (e) {
      addLog(`Users error: ${e.message}`, 'error')
    }
  }, [selectedOrgId])

  useEffect(() => { loadOrgs() }, [])

  useEffect(() => {
    if (activeTab === 'overview') loadStats()
    if (activeTab === 'sessions') loadSessions()
    if (activeTab === 'users')    loadUsers()
  }, [activeTab, selectedOrgId])

  const handleTabChange = (tab) => setActiveTab(tab)

  const handleReset = async (type, label) => {
    if (!selectedOrgId) return addLog('Select an org first', 'error')
    if (!window.confirm(`⚠️ This will permanently delete ${label}. Are you sure?`)) return
    setLoading(true)
    try {
      await apiFetch(`/reset/${type}?org_id=${selectedOrgId}`, { method: 'DELETE' })
      addLog(`✅ ${label} reset for org ${selectedOrgId}`, 'success')
      await loadStats()
    } catch (e) {
      addLog(`❌ Reset failed: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleLoginAs = async (userId, userName) => {
    try {
      const data = await apiFetch(`/token/${userId}`, { method: 'POST' })
      localStorage.setItem('auth_token', data.token)
      addLog(`✅ Logged in as ${userName} (${data.role})`, 'success')
      window.location.href = data.role === 'platform_admin' ? '/platform' : '/dashboard'
    } catch (e) {
      addLog(`❌ Login as failed: ${e.message}`, 'error')
    }
  }

  const selectedOrgName = orgs.find(o => o.id === selectedOrgId)?.name || 'All Orgs'

  return (
    <div className="dev-admin-page">
      <div className="dev-admin-header">
        <div>
          <h1 className="dev-admin-title">
            🛠 Dev Console
            <span className="dev-badge">DEV MODE</span>
          </h1>
          <p className="dev-admin-sub">
            Public route — no login required. Backend must have <code>DEV_MODE=true</code>.
          </p>
        </div>

        <div className="dev-org-selector">
          <label className="dev-label">Org context</label>
          <select
            className="dev-select"
            value={selectedOrgId || ''}
            onChange={e => setSelectedOrgId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All orgs (global)</option>
            {orgs.map(o => (
              <option key={o.id} value={o.id}>{o.name} (id:{o.id})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="dev-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`dev-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => handleTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
        <a href="/login" className="dev-tab dev-tab--link">🔐 Login →</a>
      </div>

      <div className="dev-content">

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div>
            <div className="dev-section-header">
              DB row counts — <strong>{selectedOrgName}</strong>
              <button className="dev-btn dev-btn--sm" onClick={loadStats}>↺ Refresh</button>
            </div>
            {stats ? (
              <div className="dev-stats-grid">
                {Object.entries(stats).map(([table, count]) => (
                  <div key={table} className="dev-stat-card">
                    <div className="dev-stat-table">{table}</div>
                    <div className="dev-stat-count">{count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dev-loading">Loading stats…</div>
            )}

            <div className="dev-guide">
              <h3>🗺 Quick start</h3>
              <ol>
                <li>Select or create an org using the dropdown above</li>
                <li>Go to <strong>Users</strong> tab → create an admin user for that org</li>
                <li>Click <strong>Login as</strong> to enter the app as that user</li>
                <li>Use <strong>Reset</strong> tab to wipe data for a clean test run</li>
              </ol>
              <h3>🔑 Role reference</h3>
              <table className="dev-table">
                <thead>
                  <tr><th>Role</th><th>Dashboard</th><th>Scope</th></tr>
                </thead>
                <tbody>
                  <tr><td><code>admin</code></td><td>HR Director — org-wide</td><td>All departments</td></tr>
                  <tr><td><code>recruiter</code></td><td>Recruiter — today view</td><td>Own positions</td></tr>
                  <tr><td><code>hiring_manager</code></td><td>Hiring Manager — request hires, approve JDs</td><td>Assigned positions</td></tr>
                  <tr><td><code>dept_admin</code></td><td>Dept Head — full dept analytics + approvals</td><td>Department only (dept_id scoped)</td></tr>
                  <tr><td><code>platform_admin</code></td><td>SaaS Owner — /platform dashboard</td><td>All orgs (no org scoping)</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Users ── */}
        {activeTab === 'users' && (
          <div>
            <div className="dev-two-col">
              <div>
                <div className="dev-section-header">
                  Users — <strong>{selectedOrgName}</strong>
                  <button className="dev-btn dev-btn--sm" onClick={loadUsers}>↺ Refresh</button>
                </div>
                <table className="dev-table">
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Org</th><th>Active</th><th></th></tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>{u.id}</td>
                        <td>{u.name}</td>
                        <td><code style={{ fontSize: 11 }}>{u.email}</code></td>
                        <td><span className="dev-badge-sm">{u.role}</span></td>
                        <td style={{ fontSize: 11 }}>{u.org_name}</td>
                        <td>{u.is_active ? '✅' : '❌'}</td>
                        <td>
                          <button
                            className="dev-btn dev-btn--sm dev-btn--primary"
                            onClick={() => handleLoginAs(u.id, u.name)}
                            title="Generate token and enter app as this user"
                          >
                            Login as →
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={7} className="dev-empty-cell">No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <CreateUserPanel orgs={orgs} onCreated={() => { loadUsers(); loadStats() }} addLog={addLog} />
            </div>
          </div>
        )}

        {/* ── Sessions ── */}
        {activeTab === 'sessions' && (
          <div>
            <div className="dev-section-header">
              Chat sessions — <strong>{selectedOrgName}</strong>
              <button className="dev-btn dev-btn--sm" onClick={loadSessions}>↺ Refresh</button>
            </div>
            <table className="dev-table">
              <thead>
                <tr><th>ID</th><th>Org</th><th>Title</th><th>Stage</th><th>Status</th><th>Created</th></tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} style={{ opacity: s.status === 'deleted' ? 0.4 : 1 }}>
                    <td><code style={{ fontSize: 10 }}>{String(s.id).slice(0, 8)}…</code></td>
                    <td style={{ fontSize: 11 }}>{s.org_name || selectedOrgName}</td>
                    <td>{s.title || '(untitled)'}</td>
                    <td><span className="dev-badge-sm">{s.workflow_stage}</span></td>
                    <td>
                      <span className={`dev-badge-sm ${s.status === 'deleted' ? 'deleted' : 'active'}`}>
                        {s.status || 'active'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11 }}>{s.created_at ? new Date(s.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan={6} className="dev-empty-cell">No sessions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Reset ── */}
        {activeTab === 'reset' && (
          <div>
            {!selectedOrgId && (
              <div className="dev-warning-banner">
                ⚠️ Select an org from the dropdown above before resetting data.
              </div>
            )}
            <div className="dev-section-header">
              Danger zone — <strong>{selectedOrgName}</strong>
            </div>
            <div className="dev-reset-grid">
              <ResetCard
                title="Chat Sessions" icon="💬"
                desc="Delete all JD chat sessions and messages."
                onClick={() => handleReset('chat-sessions', 'all chat sessions')}
                loading={loading} disabled={!selectedOrgId}
              />
              <ResetCard
                title="Positions" icon="💼"
                desc="Delete all positions, applications, pipeline events."
                onClick={() => handleReset('positions', 'all positions')}
                loading={loading} disabled={!selectedOrgId}
              />
              <ResetCard
                title="Notifications" icon="🔔"
                desc="Clear all in-app notifications."
                onClick={() => handleReset('notifications', 'all notifications')}
                loading={loading} disabled={!selectedOrgId}
              />
              <ResetCard
                title="Reset All" icon="☢️" danger
                desc="Nuclear: deletes everything except org, users, and departments."
                onClick={() => handleReset('all', 'ALL business data')}
                loading={loading} disabled={!selectedOrgId}
              />
            </div>
          </div>
        )}

        {/* ── Log ── */}
        {activeTab === 'log' && (
          <div>
            <div className="dev-section-header">
              Action log (this session)
              <button className="dev-btn dev-btn--sm" onClick={() => setLog([])}>Clear</button>
            </div>
            <div className="dev-log">
              {log.length === 0 && (
                <div style={{ color: 'var(--color-text-muted)', padding: 16 }}>No actions yet.</div>
              )}
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

// ── Create User Panel ──────────────────────────────────────────────────────────

function CreateUserPanel({ orgs, onCreated, addLog }) {
  const [form, setForm] = useState({
    name: '', email: '', password: 'test1234',
    role: 'hr', org_id: '', org_name: '',
    useNewOrg: false,
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        org_id: form.useNewOrg ? null : (form.org_id ? Number(form.org_id) : null),
        org_name: form.useNewOrg ? form.org_name : null,
      }
      const data = await apiFetch('/create-user', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      addLog(`✅ Created user id=${data.user_id} in org ${data.org_id}`, 'success')
      setForm(f => ({ ...f, name: '', email: '' }))
      onCreated()
    } catch (e) {
      addLog(`❌ Create user failed: ${e.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dev-create-panel">
      <div className="dev-section-header">Create user</div>
      <form onSubmit={handleSubmit} className="dev-form">
        <label className="dev-label">Name</label>
        <input className="dev-input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Jane Smith" />

        <label className="dev-label">Email</label>
        <input className="dev-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="jane@company.com" />

        <label className="dev-label">Password</label>
        <input className="dev-input" value={form.password} onChange={e => set('password', e.target.value)} required />

        <label className="dev-label">Role</label>
        <select className="dev-select" value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="org_head">org_head — Organization Owner</option>
          <option value="dept_admin">dept_admin — Department Admin</option>
          <option value="hr">hr — HR / Recruiter</option>
          <option value="team_lead">team_lead — Team Lead</option>
          <option value="platform_admin">platform_admin — SaaS Owner (no org)</option>
        </select>

        <label className="dev-label">Org</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="radio" checked={!form.useNewOrg} onChange={() => set('useNewOrg', false)} />
            Existing
          </label>
          <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="radio" checked={form.useNewOrg} onChange={() => set('useNewOrg', true)} />
            Create new
          </label>
        </div>
        {form.useNewOrg ? (
          <input className="dev-input" value={form.org_name} onChange={e => set('org_name', e.target.value)} required placeholder="New Org Name" />
        ) : (
          <select className="dev-select" value={form.org_id} onChange={e => set('org_id', e.target.value)} required>
            <option value="">Select org…</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}

        <button className="dev-btn dev-btn--primary" type="submit" disabled={saving} style={{ marginTop: 8 }}>
          {saving ? 'Creating…' : '+ Create User'}
        </button>
      </form>
    </div>
  )
}

// ── Reset Card ────────────────────────────────────────────────────────────────

function ResetCard({ title, desc, icon, danger, onClick, loading, disabled }) {
  return (
    <div className={`dev-reset-card ${danger ? 'danger' : ''} ${disabled ? 'disabled' : ''}`}>
      <div className="dev-reset-icon">{icon}</div>
      <h3 className="dev-reset-title">{title}</h3>
      <p className="dev-reset-desc">{desc}</p>
      <button
        className={`dev-btn ${danger ? 'dev-btn--danger' : 'dev-btn--default'}`}
        onClick={onClick}
        disabled={loading || disabled}
      >
        {loading ? 'Processing…' : 'Reset'}
      </button>
    </div>
  )
}
