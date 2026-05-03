/**
 * DashboardPage.jsx — Main recruiter dashboard
 * Route: /dashboard
 * Per docs/pages/03_dashboard.md
 */
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi, positionsApi } from '../../utils/api'
import { PIPELINE_STAGES, POSITION_STATUSES, PIPELINE_EVENT_ICONS } from '../../utils/constants'
import StatusBadge from '../common/StatusBadge'
import './DashboardPage.css'

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [positions, setPositions] = useState([])
  const [funnel, setFunnel] = useState(null)
  const [activity, setActivity] = useState([])
  const [period, setPeriod] = useState('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [period])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [statsData, posData, funnelData, actData] = await Promise.allSettled([
        dashboardApi.getStats(period),
        dashboardApi.getPositions(),
        dashboardApi.getFunnel(),
        dashboardApi.getActivity(null, 20),
      ])
      if (statsData.status === 'fulfilled') setStats(statsData.value)
      if (posData.status === 'fulfilled') {
        setPositions(Array.isArray(posData.value) ? posData.value : posData.value?.positions || [])
      }
      if (funnelData.status === 'fulfilled') setFunnel(funnelData.value)
      if (actData.status === 'fulfilled') {
        setActivity(Array.isArray(actData.value) ? actData.value : actData.value?.events || [])
      }
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dashboard-page">
      {/* ── Top Row ── */}
      <div className="dashboard-top">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-sub">Your hiring overview</p>
        </div>
        <div className="dashboard-period-tabs">
          {['today', 'week', 'month'].map(p => (
            <button
              key={p}
              className={`period-tab ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats Cards ── */}
      {loading ? <StatsSkeleton /> : <StatsRow stats={stats} />}

      {/* ── Main Grid: Funnel + Open Positions + Activity ── */}
      <div className="dashboard-grid">
        {/* Left: Funnel + Positions */}
        <div className="dashboard-left">
          {funnel && <FunnelChart funnel={funnel} />}
          <div className="dashboard-positions-section">
            <div className="section-header">
              <h2 className="section-title">Open Positions</h2>
              <Link to="/positions" className="section-link">View all →</Link>
            </div>
            {loading ? (
              <div className="skeleton-block" style={{ height: 200, borderRadius: 12 }} />
            ) : positions.length === 0 ? (
              <div className="dashboard-empty">
                <span>💼</span>
                <p>No open positions yet.</p>
                <Link to="/chat" className="dashboard-create-link">+ Create position</Link>
              </div>
            ) : (
              <div className="positions-mini-list">
                {positions.slice(0, 6).map(p => (
                  <Link key={p.id} to={`/positions/${p.id}`} className="positions-mini-row">
                    <div className="positions-mini-info">
                      <span className="positions-mini-name">{p.role_name}</span>
                      <StatusBadge status={p.status} type="position" size="xs" />
                    </div>
                    <div className="positions-mini-counts">
                      <span title="Total candidates">👥 {p.total_candidates || 0}</span>
                      <span title="Applied">📝 {p.applied_count || 0}</span>
                      <span title="Interview">🎯 {p.interview_count || 0}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Activity Feed */}
        <div className="dashboard-right">
          <div className="section-header">
            <h2 className="section-title">Activity Feed</h2>
          </div>
          {loading ? (
            <ActivitySkeleton />
          ) : activity.length === 0 ? (
            <div className="dashboard-empty">
              <span>📋</span>
              <p>No recent activity yet.</p>
            </div>
          ) : (
            <div className="activity-feed">
              {activity.map(evt => (
                <ActivityItem key={evt.id} event={evt} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatsRow({ stats }) {
  if (!stats) return null
  
  const trends = stats.trends || {}
  
  const cards = [
    { label: 'Active Positions', value: stats.active_positions ?? '—', icon: '💼', color: '#6366f1' },
    { 
      label: 'Total Candidates', 
      value: stats.total_candidates ?? '—', 
      icon: '👥', 
      color: '#38bdf8',
      trend: trends.candidates 
    },
    { label: 'Applications', value: stats.applied_this_period ?? '—', icon: '📝', color: '#a78bfa' },
    { label: 'Interviews', value: stats.interviews_this_period ?? '—', icon: '🎯', color: '#f59e0b' },
    { label: 'Offers Extended', value: stats.offers_this_period ?? '—', icon: '✅', color: '#22c55e' },
    { label: 'Time to Hire', value: stats.avg_time_to_hire ? `${stats.avg_time_to_hire}d` : '—', icon: '⏱', color: '#fb923c' },
  ]
  
  return (
    <div className="stats-row">
      {cards.map(c => (
        <div key={c.label} className="stat-card">
          <div className="stat-icon" style={{ color: c.color }}>{c.icon}</div>
          <div className="stat-value">{c.value}</div>
          <div className="stat-label">{c.label}</div>
          {c.trend && (
            <div className={`stat-trend ${c.trend.trend}`}>
              <span className="trend-arrow">{c.trend.trend === 'up' ? '↑' : '↓'}</span>
              <span className="trend-value">{Math.abs(c.trend.diff)}</span>
              <span className="trend-period">since last {stats.period}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function FunnelChart({ funnel }) {
  const stages = [
    { key: 'sourced', label: 'Sourced' },
    { key: 'emailed', label: 'Emailed' },
    { key: 'applied', label: 'Applied' },
    { key: 'screening', label: 'Screening' },
    { key: 'interview', label: 'Interview' },
    { key: 'selected', label: 'Selected' },
  ]
  const maxVal = Math.max(...stages.map(s => funnel[s.key] || 0), 1)

  return (
    <div className="funnel-section">
      <h2 className="section-title">Hiring Funnel</h2>
      <div className="funnel-bars">
        {stages.map(s => {
          const val = funnel[s.key] || 0
          const pct = (val / maxVal) * 100
          const style = PIPELINE_STAGES[s.key] || { color: '#6366f1' }
          return (
            <div key={s.key} className="funnel-bar-row">
              <span className="funnel-label">{s.label}</span>
              <div className="funnel-bar-bg">
                <div
                  className="funnel-bar-fill"
                  style={{ width: `${pct}%`, background: style.color }}
                />
              </div>
              <span className="funnel-val">{val}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActivityItem({ event }) {
  const icon = PIPELINE_EVENT_ICONS[event.event_type] || '📌'
  const time = new Date(event.created_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  const label = formatEventLabel(event)

  return (
    <div className="activity-item">
      <span className="activity-icon">{icon}</span>
      <div className="activity-body">
        <p className="activity-label">{label}</p>
        <span className="activity-time">{time}</span>
      </div>
    </div>
  )
}

function formatEventLabel(event) {
  const type = event.event_type
  const candidate = event.candidate_name
  const position = event.position_title
  const user = event.user_name

  if (type === 'status_changed') {
    const data = event.event_data || {}
    return `${candidate || 'Candidate'} moved to ${data.new_status || '—'} for ${position || 'position'}`
  }
  if (type === 'applied') return `${candidate || 'Candidate'} applied for ${position || 'position'}`
  if (type === 'sourced') return `New candidate sourced for ${position || 'position'}`
  if (type === 'interview_scheduled') return `Interview scheduled for ${candidate || 'candidate'}`
  if (type === 'selected') return `${candidate || 'Candidate'} marked as selected`
  if (type === 'search_completed') return `Candidate search completed for ${position || 'position'}`
  if (type === 'jd_generated') return `JD generated for ${position || 'position'}`
  if (type === 'interview_kit_generated') return `Interview kit generated for ${position || 'position'}`
  return type.replace(/_/g, ' ')
}

function StatsSkeleton() {
  return (
    <div className="stats-row">
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="skeleton-block" style={{ height: 100, borderRadius: 14 }} />
      ))}
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} className="skeleton-block" style={{ height: 52, borderRadius: 10 }} />
      ))}
    </div>
  )
}
