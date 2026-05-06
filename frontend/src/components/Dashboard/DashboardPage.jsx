/**
 * DashboardPage.jsx — Premium role-adaptive hiring dashboard
 * Route: /dashboard
 *
 * Roles:
 *   admin      → Director view: org-wide stats, conversion rates, dept breakdown, top positions
 *   hiring_mgr → Manager view: dept stats, pipeline health, team workload
 *   recruiter  → Recruiter view: my positions, pending actions, productivity metrics
 */
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { dashboardApi } from '../../utils/api'
import StatusBadge from '../common/StatusBadge'
import './DashboardPage.css'

export default function DashboardPage() {
  const { user, org } = useAuth()
  const navigate = useNavigate()
  const role = user?.role || 'recruiter'

  const [stats, setStats] = useState(null)
  const [positions, setPositions] = useState([])
  const [funnel, setFunnel] = useState(null)
  const [activity, setActivity] = useState([])
  const [period, setPeriod] = useState('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [period])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [s, p, f, a] = await Promise.allSettled([
        dashboardApi.getStats(period),
        dashboardApi.getPositions(),
        dashboardApi.getFunnel(),
        dashboardApi.getActivity(null, 20),
      ])
      if (s.status === 'fulfilled') setStats(s.value)
      if (p.status === 'fulfilled') setPositions(Array.isArray(p.value) ? p.value : p.value?.positions || [])
      if (f.status === 'fulfilled') setFunnel(f.value)
      if (a.status === 'fulfilled') setActivity(Array.isArray(a.value) ? a.value : a.value?.events || [])
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }

  const greeting = getGreeting()
  const roleBadge = { admin: 'Director', hiring_manager: 'Manager', recruiter: 'Recruiter' }[role] || role

  return (
    <div className="dash">
      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">
            Good {greeting}, {user?.name?.split(' ')[0] || 'there'}
            <span className="dash-role-pill">{roleBadge}</span>
          </h1>
          <p className="dash-subtitle">
            {role === 'admin'
              ? `${org?.name || 'Organization'} hiring overview`
              : role === 'hiring_manager'
                ? 'Your department pipeline'
                : 'Your assigned positions'}
          </p>
        </div>
        <div className="dash-period-switcher">
          {['today', 'week', 'month'].map(p => (
            <button key={p} className={`dash-period-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats Strip ── */}
      {loading ? <StatsSkeleton count={role === 'admin' ? 6 : 4} /> : <StatsStrip stats={stats} role={role} period={period} />}

      {/* ── Main Grid ── */}
      <div className="dash-grid">
        {/* Left Column */}
        <div className="dash-col-main">
          {/* Funnel Visualization */}
          {funnel && <FunnelViz funnel={funnel} role={role} />}

          {/* Positions Table */}
          <PositionsSection positions={positions} role={role} loading={loading} navigate={navigate} />
        </div>

        {/* Right Column */}
        <div className="dash-col-side">
          {/* Pipeline Health (admin/manager only) */}
          {(role === 'admin' || role === 'hiring_manager') && stats && (
            <PipelineHealth stats={stats} />
          )}

          {/* Activity Feed */}
          <ActivityFeed activity={activity} loading={loading} />

          {/* Recruiter Quick Actions */}
          {role === 'recruiter' && <QuickActions navigate={navigate} />}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

// ── Stats Strip ─────────────────────────────────────────────────────────────

function StatsStrip({ stats, role, period }) {
  if (!stats) return null

  const cards = [
    { key: 'positions', label: 'Open Positions', value: stats.active_positions ?? 0, icon: '💼', gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', roles: ['admin', 'hiring_manager', 'recruiter'] },
    { key: 'candidates', label: 'Total Candidates', value: stats.total_candidates ?? 0, icon: '👥', gradient: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)', roles: ['admin', 'hiring_manager'] },
    { key: 'applied', label: 'Applications', value: stats.applied_this_period ?? 0, icon: '📋', gradient: 'linear-gradient(135deg, #a78bfa 0%, #c4b5fd 100%)', roles: ['admin', 'hiring_manager', 'recruiter'] },
    { key: 'interviews', label: 'Interviews', value: stats.interviews_this_period ?? 0, icon: '🎯', gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', roles: ['admin', 'hiring_manager', 'recruiter'] },
    { key: 'offers', label: 'Offers', value: stats.offers_this_period ?? 0, icon: '🎉', gradient: 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)', roles: ['admin', 'hiring_manager'] },
    { key: 'time', label: 'Avg. Time to Hire', value: stats.avg_time_to_hire ? `${stats.avg_time_to_hire}d` : '—', icon: '⏱', gradient: 'linear-gradient(135deg, #fb923c 0%, #fdba74 100%)', roles: ['admin'] },
  ].filter(c => c.roles.includes(role))

  return (
    <div className="dash-stats">
      {cards.map(c => (
        <div key={c.key} className="dash-stat-card">
          <div className="dash-stat-icon-wrap" style={{ background: c.gradient }}>
            <span className="dash-stat-icon">{c.icon}</span>
          </div>
          <div className="dash-stat-info">
            <div className="dash-stat-value">{c.value}</div>
            <div className="dash-stat-label">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Funnel Visualization ────────────────────────────────────────────────────

function FunnelViz({ funnel, role }) {
  const stages = [
    { key: 'sourced', label: 'Sourced', color: '#6366f1', emoji: '🔍' },
    { key: 'emailed', label: 'Outreach', color: '#8b5cf6', emoji: '📧' },
    { key: 'applied', label: 'Applied', color: '#0ea5e9', emoji: '📋' },
    { key: 'screening', label: 'Screening', color: '#f59e0b', emoji: '🔎' },
    { key: 'interview', label: 'Interview', color: '#fb923c', emoji: '🎙' },
    { key: 'selected', label: 'Selected', color: '#22c55e', emoji: '✅' },
  ]
  const maxVal = Math.max(...stages.map(s => funnel[s.key] || 0), 1)

  // Calculate conversion rates between stages
  const conversions = stages.slice(1).map((s, i) => {
    const prev = funnel[stages[i].key] || 0
    const curr = funnel[s.key] || 0
    return prev > 0 ? Math.round((curr / prev) * 100) : 0
  })

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3 className="dash-card-title">Hiring Funnel</h3>
        <span className="dash-card-badge">
          {role === 'admin' ? 'Org-wide' : 'Department'}
        </span>
      </div>
      <div className="funnel-viz">
        {stages.map((s, idx) => {
          const val = funnel[s.key] || 0
          const pct = (val / maxVal) * 100
          return (
            <React.Fragment key={s.key}>
              <div className="funnel-stage">
                <div className="funnel-stage-label">
                  <span className="funnel-emoji">{s.emoji}</span>
                  <span>{s.label}</span>
                </div>
                <div className="funnel-bar-track">
                  <div className="funnel-bar-fill" style={{ width: `${Math.max(pct, 2)}%`, background: s.color }} />
                </div>
                <span className="funnel-count" style={{ color: s.color }}>{val}</span>
              </div>
              {idx < stages.length - 1 && conversions[idx] !== undefined && (
                <div className="funnel-conversion">
                  <span className="funnel-conv-arrow">↓</span>
                  <span className="funnel-conv-pct">{conversions[idx]}%</span>
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ── Pipeline Health (donut-style metric) ────────────────────────────────────

function PipelineHealth({ stats }) {
  const total = stats.total_candidates || 0
  const active = stats.active_positions || 0
  const applied = stats.applied_this_period || 0
  const ratio = active > 0 ? Math.round(total / active) : 0

  return (
    <div className="dash-card dash-card--compact">
      <h3 className="dash-card-title" style={{ marginBottom: 'var(--space-3)' }}>Pipeline Health</h3>
      <div className="health-metrics">
        <div className="health-metric">
          <div className="health-metric-value">{ratio}</div>
          <div className="health-metric-label">Candidates per position</div>
        </div>
        <div className="health-metric">
          <div className="health-metric-value">{applied}</div>
          <div className="health-metric-label">Applications this period</div>
        </div>
        <div className="health-metric">
          <div className="health-metric-value">{active}</div>
          <div className="health-metric-label">Active positions</div>
        </div>
      </div>
    </div>
  )
}

// ── Positions Section ───────────────────────────────────────────────────────

function PositionsSection({ positions, role, loading, navigate }) {
  const label = role === 'admin' ? 'All Open Positions' : role === 'hiring_manager' ? 'Department Positions' : 'My Positions'

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3 className="dash-card-title">{label}</h3>
        <Link to="/positions" className="dash-card-link">View all →</Link>
      </div>
      {loading ? (
        <div className="skeleton-block" style={{ height: 180, borderRadius: 10 }} />
      ) : positions.length === 0 ? (
        <div className="dash-empty">
          <span className="dash-empty-icon">💼</span>
          <p className="dash-empty-title">No open positions yet</p>
          <p className="dash-empty-desc">
            {role === 'recruiter' ? 'No positions assigned to you' : 'Create your first position to start hiring'}
          </p>
          {role !== 'recruiter' && (
            <Link to="/chat" className="dash-empty-cta">✨ Create position</Link>
          )}
        </div>
      ) : (
        <div className="dash-positions-table">
          <div className="dash-pos-header-row">
            <span>Position</span>
            <span>Department</span>
            <span>Status</span>
            <span>Candidates</span>
          </div>
          {positions.slice(0, 8).map(p => (
            <Link key={p.id} to={`/positions/${p.id}`} className="dash-pos-row">
              <span className="dash-pos-name">{p.role_name}</span>
              <span className="dash-pos-dept">{p.department_name || '—'}</span>
              <StatusBadge status={p.status} type="position" size="xs" />
              <span className="dash-pos-count">{p.total_candidates || 0}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Activity Feed ───────────────────────────────────────────────────────────

function ActivityFeed({ activity, loading }) {
  return (
    <div className="dash-card dash-card--feed">
      <h3 className="dash-card-title" style={{ padding: 'var(--space-4) var(--space-4) var(--space-2)' }}>Activity Feed</h3>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-3)' }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton-block" style={{ height: 44, borderRadius: 8 }} />)}
        </div>
      ) : activity.length === 0 ? (
        <div className="dash-empty" style={{ padding: 'var(--space-6)' }}>
          <span className="dash-empty-icon">📋</span>
          <p className="dash-empty-title">No recent activity</p>
          <p className="dash-empty-desc">Events appear as candidates move through the pipeline</p>
        </div>
      ) : (
        <div className="dash-activity-list">
          {activity.slice(0, 12).map(evt => (
            <div key={evt.id} className="dash-activity-row">
              <span className="dash-activity-dot" />
              <div className="dash-activity-body">
                <p className="dash-activity-text">{formatEvent(evt)}</p>
                <span className="dash-activity-time">{timeAgo(evt.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Quick Actions (recruiter) ───────────────────────────────────────────────

function QuickActions({ navigate }) {
  const actions = [
    { icon: '✨', label: 'New Hire', to: '/chat' },
    { icon: '🗃', label: 'Talent Pool', to: '/talent-pool' },
    { icon: '🎙', label: 'Interviews', to: '/interviews' },
    { icon: '⚙️', label: 'Settings', to: '/settings' },
  ]

  return (
    <div className="dash-card dash-card--compact">
      <h3 className="dash-card-title" style={{ marginBottom: 'var(--space-3)' }}>Quick Actions</h3>
      <div className="dash-quick-grid">
        {actions.map(a => (
          <button key={a.to} className="dash-quick-btn" onClick={() => navigate(a.to)}>
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Skeletons ───────────────────────────────────────────────────────────────

function StatsSkeleton({ count = 4 }) {
  return (
    <div className="dash-stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-block" style={{ height: 88, borderRadius: 14 }} />
      ))}
    </div>
  )
}

// ── Format helpers ──────────────────────────────────────────────────────────

function formatEvent(evt) {
  const c = evt.candidate_name || 'Candidate'
  const p = evt.position_title || 'position'
  const t = evt.event_type
  if (t === 'applied') return `${c} applied for ${p}`
  if (t === 'sourced') return `New candidate sourced for ${p}`
  if (t === 'status_changed') return `${c} moved to ${evt.event_data?.new_status || 'next stage'}`
  if (t === 'interview_scheduled') return `Interview scheduled for ${c}`
  if (t === 'selected') return `${c} selected for ${p}`
  return t.replace(/_/g, ' ')
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
