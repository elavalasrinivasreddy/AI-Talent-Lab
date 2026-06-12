/**
 * PlatformPage.jsx – SaaS owner cross-org analytics dashboard.
 * Route: /platform  (no sidebar — standalone page)
 * Requires role: platform_admin
 */
import { useState, useEffect, useCallback, Fragment } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { timeAgo } from '../../utils/date'
import ProvidersTab from '../Settings/tabs/ProvidersTab'
import './PlatformPage.css'

const BASE = (import.meta.env.VITE_API_URL || '/api/v1') + '/platform'

async function platformFetch(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function PlatformPage() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (user?.role !== 'platform_admin') {
      navigate('/dashboard', { replace: true })
      return
    }
    loadAll()
  }, [user])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [s, o, a] = await Promise.allSettled([
        platformFetch('/stats', token),
        platformFetch('/orgs', token),
        platformFetch('/activity', token),
      ])
      if (s.status === 'fulfilled') setStats(s.value)
      if (o.status === 'fulfilled') setOrgs(o.value?.orgs || [])
      if (a.status === 'fulfilled') setActivity(a.value?.activity || [])
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  return (
    <div className="plat-page">
      {/* Header */}
      <header className="plat-header">
        <div className="plat-header-brand">
          <div className="plat-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div className="plat-brand-name">AI Talent Lab</div>
            <div className="plat-brand-sub">Platform Dashboard</div>
          </div>
        </div>
        <div className="plat-header-right">
          <span className="plat-admin-pill">Platform Admin</span>
          <button className="plat-logout-btn" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <div className="plat-body">
        {/* Tabs */}
        <nav className="plat-tabs">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'orgs', label: `Organisations (${orgs.length})` },
            { key: 'activity', label: 'Activity' },
            { key: 'providers', label: 'Providers & API Keys' },
          ].map(t => (
            <button
              key={t.key}
              className={`plat-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
          <button className="plat-refresh-btn" onClick={loadAll} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </nav>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="plat-section">
            {loading ? (
              <div className="plat-stats-grid">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="plat-stat-card plat-skel">
                    <div className="plat-skel-icon" />
                    <div><div className="plat-skel-val" /><div className="plat-skel-lbl" /></div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="plat-stats-grid">
                  <StatCard label="Total Organisations" value={stats?.total_orgs ?? '—'} icon="🏢" accent="#0D9488" />
                  <StatCard label="Total Users" value={stats?.total_users ?? '—'} icon="👥" accent="#0ea5e9" />
                  <StatCard label="Active Positions" value={stats?.active_positions ?? '—'} icon="💼" accent="#22c55e" />
                  <StatCard label="Total Candidates" value={stats?.total_candidates ?? '—'} icon="🔍" accent="#14B8A6" />
                  <StatCard label="Total Applications" value={stats?.total_applications ?? '—'} icon="📋" accent="#f59e0b" />
                  <StatCard label="JD Sessions" value={stats?.total_jd_sessions ?? '—'} icon="✨" accent="#fb923c" />
                </div>

                <div className="plat-growth-row">
                  <GrowthCard label="New Orgs (30d)" value={stats?.new_orgs_30d ?? '—'} icon="🚀" />
                  <GrowthCard label="New Users (30d)" value={stats?.new_users_30d ?? '—'} icon="👤" />
                  <GrowthCard label="New Positions (30d)" value={stats?.new_positions_30d ?? '—'} icon="📄" />
                  <GrowthCard label="Applications (7d)" value={stats?.applications_7d ?? '—'} icon="📥" />
                </div>

                {/* System health */}
                <div className="plat-card plat-health-card">
                  <h3 className="plat-card-title">🩺 System Health</h3>
                  <div className="plat-health-grid">
                    <HealthIndicator label="Database" status="healthy" />
                    <HealthIndicator label="Celery Workers" status={stats?.celery_healthy ? 'healthy' : 'degraded'} />
                    <HealthIndicator label="Redis" status={stats?.redis_healthy ? 'healthy' : 'degraded'} />
                    <HealthIndicator label="LLM Provider" status={stats?.llm_healthy ? 'healthy' : 'unknown'} />
                  </div>
                </div>
              </>
            )}

            {/* Top orgs by activity */}
            {orgs.length > 0 && (
              <div className="plat-card" style={{ marginTop: 24 }}>
                <h3 className="plat-card-title">Most Active Organisations</h3>
                <OrgTable orgs={[...orgs].sort((a, b) => (b.application_count - a.application_count)).slice(0, 5)} compact />
              </div>
            )}
          </div>
        )}

        {/* Orgs */}
        {tab === 'orgs' && (
          <div className="plat-section">
            {loading ? (
              <div className="plat-loading">Loading organisations…</div>
            ) : (
              <div className="plat-card">
                <OrgTable orgs={orgs} expandable token={token} />
              </div>
            )}
          </div>
        )}

        {/* Activity */}
        {tab === 'activity' && (
          <div className="plat-section">
            <div className="plat-card">
              <h3 className="plat-card-title">Recent Platform Activity</h3>
              {activity.length === 0 ? (
                <div className="plat-empty">No activity recorded yet.</div>
              ) : (
                <div className="plat-activity-list">
                  {activity.map((evt, i) => (
                    <div key={i} className="plat-activity-row">
                      <span className="plat-activity-dot" />
                      <div className="plat-activity-body">
                        <span className="plat-activity-org">{evt.org_name}</span>
                        <span className="plat-activity-text"> · {formatEvent(evt)}</span>
                      </div>
                      <span className="plat-activity-time">{timeAgo(evt.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Providers & API Keys */}
        {tab === 'providers' && (
          <div className="plat-section">
            <div className="plat-providers-wrapper">
              <ProvidersTab />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div className="plat-stat-card">
      <div className="plat-stat-icon" style={{ background: `${accent}22`, color: accent }}>{icon}</div>
      <div className="plat-stat-value">{value}</div>
      <div className="plat-stat-label">{label}</div>
    </div>
  )
}

function GrowthCard({ label, value, icon }) {
  return (
    <div className="plat-growth-card">
      <span className="plat-growth-icon">{icon}</span>
      <div className="plat-growth-value">{value}</div>
      <div className="plat-growth-label">{label}</div>
    </div>
  )
}

function OrgTable({ orgs, compact = false, expandable = false, token }) {
  const [expandedId, setExpandedId] = useState(null)
  const [detailCache, setDetailCache] = useState({})
  const [loadingId, setLoadingId] = useState(null)

  const toggleRow = useCallback(async (orgId) => {
    if (expandedId === orgId) { setExpandedId(null); return }
    setExpandedId(orgId)
    if (detailCache[orgId]) return
    setLoadingId(orgId)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/platform/orgs/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setDetailCache(prev => ({ ...prev, [orgId]: data.org }))
      }
    } finally {
      setLoadingId(null)
    }
  }, [expandedId, detailCache, token])

  const colCount = compact ? 4 : 8

  return (
    <table className="plat-table">
      <thead>
        <tr>
          <th>Organisation</th>
          {!compact && <th>Segment</th>}
          {!compact && <th>Size</th>}
          <th>Users</th>
          <th>Positions</th>
          <th>Active</th>
          <th>Applications</th>
          {!compact && <th>Joined</th>}
        </tr>
      </thead>
      <tbody>
        {orgs.map(org => (
          <Fragment key={org.id}>
            <tr
              className={`${expandable ? 'plat-org-row-clickable' : ''} ${expandedId === org.id ? 'plat-org-row-expanded' : ''}`}
              onClick={expandable ? () => toggleRow(org.id) : undefined}
            >
              <td>
                <div className="plat-org-name">{org.name}</div>
                <div className="plat-org-slug">/{org.slug}</div>
              </td>
              {!compact && <td>{org.segment || '—'}</td>}
              {!compact && <td>{org.size || '—'}</td>}
              <td>{org.user_count}</td>
              <td>{org.position_count}</td>
              <td>
                <span className={`plat-badge ${org.active_positions > 0 ? 'green' : 'dim'}`}>
                  {org.active_positions}
                </span>
              </td>
              <td>{org.application_count}</td>
              {!compact && <td>{org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}</td>}
            </tr>
            {expandable && expandedId === org.id && (
              <tr className="plat-org-detail-row">
                <td colSpan={colCount}>
                  {loadingId === org.id ? (
                    <div className="plat-detail-loading">Loading details…</div>
                  ) : detailCache[org.id] ? (
                    <OrgDetailPanel org={detailCache[org.id]} />
                  ) : (
                    <div className="plat-detail-loading">Failed to load details.</div>
                  )}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

function OrgDetailPanel({ org }) {
  return (
    <div className="plat-org-detail-panel">
      <div className="plat-detail-grid">
        {org.website && (
          <div className="plat-detail-item">
            <span className="plat-detail-label">Website</span>
            <a href={org.website} target="_blank" rel="noreferrer" className="plat-detail-link">{org.website}</a>
          </div>
        )}
        {org.headquarters && (
          <div className="plat-detail-item">
            <span className="plat-detail-label">HQ</span>
            <span>{org.headquarters}</span>
          </div>
        )}
        {org.hiring_contact_email && (
          <div className="plat-detail-item">
            <span className="plat-detail-label">Contact</span>
            <span>{org.hiring_contact_email}</span>
          </div>
        )}
        {org.linkedin_url && (
          <div className="plat-detail-item">
            <span className="plat-detail-label">LinkedIn</span>
            <a href={org.linkedin_url} target="_blank" rel="noreferrer" className="plat-detail-link">View profile</a>
          </div>
        )}
      </div>
      {org.about_us && (
        <div className="plat-detail-about">
          <span className="plat-detail-label">About</span>
          <p>{org.about_us}</p>
        </div>
      )}
    </div>
  )
}

function formatEvent(evt) {
  const pos = evt.position_title || 'a position'
  const cand = evt.candidate_name || 'a candidate'
  const t = evt.event_type
  if (t === 'applied') return `${cand} applied for ${pos}`
  if (t === 'sourced') return `New candidate sourced for ${pos}`
  if (t === 'selected') return `${cand} selected for ${pos}`
  if (t === 'interview_scheduled') return `Interview scheduled for ${cand}`
  if (t === 'status_changed') return `${cand} moved stage`
  return t.replace(/_/g, ' ')
}


function HealthIndicator({ label, status }) {
  const colors = {
    healthy: { dot: '#22c55e', bg: 'rgba(34,197,94,0.1)', text: 'Healthy' },
    degraded: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', text: 'Degraded' },
    down: { dot: '#ef4444', bg: 'rgba(239,68,68,0.1)', text: 'Down' },
    unknown: { dot: '#9ca3af', bg: 'rgba(156,163,175,0.1)', text: 'Unknown' },
  }
  const c = colors[status] || colors.unknown
  return (
    <div className="plat-health-item">
      <span className="plat-health-dot" style={{ background: c.dot }} />
      <span className="plat-health-label">{label}</span>
      <span className="plat-health-status" style={{ color: c.dot, background: c.bg }}>{c.text}</span>
    </div>
  )
}

