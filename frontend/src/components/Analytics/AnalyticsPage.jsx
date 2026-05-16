/**
 * AnalyticsPage.jsx – Hiring analytics deep-dive
 * Route: /analytics
 * Covers: pipeline velocity, source breakdown, funnel conversion, time-to-hire
 */
import { useState, useEffect } from 'react'
import { dashboardApi } from '../../utils/api'
import './AnalyticsPage.css'

const PERIODS = [
  { value: 'week',    label: 'Last 7 days' },
  { value: 'month',   label: 'Last 30 days' },
  { value: 'quarter', label: 'Last Quarter' },
  { value: 'year',    label: 'Last Year' },
]

const STAGE_COLORS = {
  sourced:   '#6366f1',
  emailed:   '#8b5cf6',
  applied:   '#0ea5e9',
  screening: '#f59e0b',
  interview: '#fb923c',
  selected:  '#22c55e',
  rejected:  '#ef4444',
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    dashboardApi.getAnalytics(period)
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [period])

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">Hiring Analytics</h1>
          <p className="analytics-subtitle">Pipeline performance, source efficiency, and velocity trends</p>
        </div>
        <div className="analytics-period-switcher">
          {PERIODS.map(p => (
            <button
              key={p.value}
              className={`analytics-period-btn ${period === p.value ? 'active' : ''}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="analytics-error">⚠️ {error}</div>
      )}

      {loading ? (
        <AnalyticsSkeleton />
      ) : data && (
        <>
          {/* KPI Cards */}
          <KPIStrip data={data} />

          <div className="analytics-grid">
            {/* Funnel */}
            <FunnelCard funnel={data.funnel || {}} />

            {/* Source Breakdown */}
            <SourceCard sources={data.sources || []} />

            {/* Velocity Chart */}
            <VelocityCard velocity={data.velocity || []} />

            {/* Top Positions */}
            {data.top_positions?.length > 0 && (
              <TopPositionsCard positions={data.top_positions} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

function KPIStrip({ data }) {
  const kpis = [
    { label: 'Total Applications', value: data.total_applications ?? '—', icon: '📋', color: '#6366f1' },
    { label: 'Avg. Time to Hire', value: data.avg_time_to_hire ? `${Math.round(data.avg_time_to_hire)}d` : '—', icon: '⏱', color: '#f59e0b' },
    { label: 'Selected', value: data.total_selected ?? '—', icon: '✅', color: '#22c55e' },
    { label: 'Offer Accept Rate', value: data.offer_acceptance_rate ? `${data.offer_acceptance_rate}%` : '—', icon: '🎉', color: '#fb923c' },
  ]
  return (
    <div className="analytics-kpi-strip">
      {kpis.map(k => (
        <div key={k.label} className="analytics-kpi-card">
          <div className="analytics-kpi-icon" style={{ background: `${k.color}22`, color: k.color }}>{k.icon}</div>
          <div>
            <div className="analytics-kpi-value">{k.value}</div>
            <div className="analytics-kpi-label">{k.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Funnel Card ───────────────────────────────────────────────────────────────

function FunnelCard({ funnel }) {
  const stages = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected']
  const max = Math.max(...stages.map(s => funnel[s] || 0), 1)

  return (
    <div className="analytics-card analytics-card--funnel">
      <h3 className="analytics-card-title">Pipeline Funnel</h3>
      <div className="analytics-funnel">
        {stages.map((s, i) => {
          const val = funnel[s] || 0
          const pct = Math.max((val / max) * 100, 2)
          const conv = i > 0 && (funnel[stages[i - 1]] || 0) > 0
            ? Math.round((val / (funnel[stages[i - 1]] || 1)) * 100)
            : null
          return (
            <div key={s} className="analytics-funnel-row">
              <span className="analytics-funnel-label">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              <div className="analytics-funnel-bar-track">
                <div className="analytics-funnel-bar-fill" style={{ width: `${pct}%`, background: STAGE_COLORS[s] }} />
              </div>
              <span className="analytics-funnel-val" style={{ color: STAGE_COLORS[s] }}>{val}</span>
              {conv !== null && (
                <span className="analytics-funnel-conv">{conv}%</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Source Breakdown ──────────────────────────────────────────────────────────

function SourceCard({ sources }) {
  const total = sources.reduce((s, r) => s + (r.count || 0), 0) || 1
  const colors = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#fb923c', '#8b5cf6']
  return (
    <div className="analytics-card">
      <h3 className="analytics-card-title">Source Effectiveness</h3>
      {sources.length === 0 ? (
        <p className="analytics-empty">No source data yet</p>
      ) : (
        <div className="analytics-sources">
          {sources.map((s, i) => (
            <div key={s.source || i} className="analytics-source-row">
              <span className="analytics-source-dot" style={{ background: colors[i % colors.length] }} />
              <span className="analytics-source-name">{s.source || 'Unknown'}</span>
              <div className="analytics-source-bar-track">
                <div className="analytics-source-bar" style={{ width: `${(s.count / total) * 100}%`, background: colors[i % colors.length] }} />
              </div>
              <span className="analytics-source-count">{s.count}</span>
              <span className="analytics-source-pct">{Math.round((s.count / total) * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Velocity Chart (simplified bar chart) ────────────────────────────────────

function VelocityCard({ velocity }) {
  if (!velocity.length) return (
    <div className="analytics-card">
      <h3 className="analytics-card-title">Weekly Velocity</h3>
      <p className="analytics-empty">Not enough data yet</p>
    </div>
  )
  const maxVal = Math.max(...velocity.map(w => (w.sourced || 0) + (w.applied || 0)), 1)

  return (
    <div className="analytics-card analytics-card--velocity">
      <h3 className="analytics-card-title">Weekly Velocity</h3>
      <div className="analytics-velocity">
        {velocity.slice(-8).map((w, i) => {
          const sourced = w.sourced || 0
          const applied = w.applied || 0
          const hired = w.hired || 0
          return (
            <div key={i} className="analytics-velocity-col">
              <div className="analytics-velocity-bars">
                <div className="analytics-vbar analytics-vbar--sourced" style={{ height: `${(sourced / maxVal) * 100}%` }} title={`Sourced: ${sourced}`} />
                <div className="analytics-vbar analytics-vbar--applied" style={{ height: `${(applied / maxVal) * 100}%` }} title={`Applied: ${applied}`} />
                {hired > 0 && <div className="analytics-vbar analytics-vbar--hired" style={{ height: `${(hired / maxVal) * 100}%` }} title={`Hired: ${hired}`} />}
              </div>
              <span className="analytics-velocity-label">
                {w.week ? new Date(w.week).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : `W${i + 1}`}
              </span>
            </div>
          )
        })}
      </div>
      <div className="analytics-velocity-legend">
        <span><span style={{ background: '#6366f1' }} />Sourced</span>
        <span><span style={{ background: '#0ea5e9' }} />Applied</span>
        <span><span style={{ background: '#22c55e' }} />Hired</span>
      </div>
    </div>
  )
}

// ── Top Positions ─────────────────────────────────────────────────────────────

function TopPositionsCard({ positions }) {
  return (
    <div className="analytics-card">
      <h3 className="analytics-card-title">Top Active Positions</h3>
      <div className="analytics-positions-table">
        <div className="analytics-pos-header">
          <span>Role</span><span>Applications</span><span>In Interview</span><span>Avg Score</span>
        </div>
        {positions.map(p => (
          <div key={p.id} className="analytics-pos-row">
            <span className="analytics-pos-name">{p.role_name}</span>
            <span>{p.total_applications ?? '—'}</span>
            <span>{p.in_interview ?? '—'}</span>
            <span>{p.avg_score ? `${Math.round(p.avg_score)}%` : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton-block" style={{ height: 80, borderRadius: 12 }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton-block" style={{ height: 260, borderRadius: 12 }} />)}
      </div>
    </div>
  )
}
