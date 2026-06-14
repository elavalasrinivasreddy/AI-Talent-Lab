/**
 * AnalyticsPage.jsx – Agent ROI Dashboard
 * Route: /analytics
 */
import { useState, useEffect } from 'react'
import { dashboardApi } from '../../utils/api'
import { AgentROIHero } from './AgentROIHero'
import { DualFunnel } from './DualFunnel'
import { BottleneckRadar } from './BottleneckRadar'
import { RecruiterLeaderboard } from './RecruiterLeaderboard'
import OpsTab from './OpsTab'
import ExploreTab from './explore/ExploreTab'
import './AnalyticsPage.css'

const PERIODS = [
  { value: 'week',    label: 'Last 7 days' },
  { value: 'month',   label: 'Last 30 days' },
  { value: 'quarter', label: 'Last Quarter' },
  { value: 'year',    label: 'Last Year' },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('week')
  const [tab, setTab] = useState('roi')
  const [kpiData, setKpiData] = useState(null)
  const [roiData, setRoiData] = useState(null)
  const [recruiterData, setRecruiterData] = useState(null)
  const [bottleneckData, setBottleneckData] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      dashboardApi.getAnalytics(period),
      dashboardApi.getAgentRoi(period),
      dashboardApi.getRecruiterPerformance(period),
      dashboardApi.getBottlenecks(period),
    ]).then(([analytics, roi, rec, bot]) => {
      if (analytics.status === 'fulfilled') setKpiData(analytics.value)
      if (roi.status      === 'fulfilled') setRoiData(roi.value)
      if (rec.status      === 'fulfilled') setRecruiterData(rec.value)
      if (bot.status      === 'fulfilled') setBottleneckData(bot.value)

      const allFailed = [analytics, roi, rec, bot].every(r => r.status === 'rejected')
      setError(allFailed ? 'Failed to load analytics data. Please refresh.' : null)
    }).finally(() => setLoading(false))
  }, [period])

  return (
    <div className={`analytics-page${tab === 'explore' ? ' analytics-page-wide' : ''}`}>
      <div className="analytics-header-container">
        <div className="analytics-header">
          <div>
            <h1 className="analytics-title">Analytics</h1>
            <p className="analytics-subtitle">
              {tab === 'roi'
                ? 'AI contribution, pipeline health, and team throughput'
                : tab === 'ops'
                ? 'Task health, LLM cost, and JD generation metrics'
                : 'Build your own charts — pick metrics, axes, and date ranges, then save dashboards'}
            </p>
          </div>
          {tab !== 'explore' && (
            <div className="analytics-header-right">
              <div className="analytics-period-switcher">
                {PERIODS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    className={`analytics-period-btn${period === p.value ? ' active' : ''}`}
                    onClick={() => setPeriod(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="analytics-page-tabs">
          <button
            type="button"
            className={`analytics-page-tab${tab === 'roi' ? ' active' : ''}`}
            onClick={() => setTab('roi')}
          >
            Agent ROI
          </button>
          <button
            type="button"
            className={`analytics-page-tab${tab === 'ops' ? ' active' : ''}`}
            onClick={() => setTab('ops')}
          >
            System Health
          </button>
          <button
            type="button"
            className={`analytics-page-tab${tab === 'explore' ? ' active' : ''}`}
            onClick={() => setTab('explore')}
          >
            Explore
          </button>
        </div>
      </div>

      {error && (
        <div className="analytics-error" role="alert">
          {error}
        </div>
      )}

      {tab === 'roi' ? (
        loading ? (
          <AnalyticsSkeleton />
        ) : (
          <>
            <AgentROIHero data={roiData} loading={loading} />
            {kpiData && <KpiStrip data={kpiData} />}
            <div className="analytics-grid">
              <DualFunnel
                aiFunnel={roiData?.ai_funnel}
                humanFunnel={roiData?.human_funnel}
              />
              <BottleneckRadar
                current={bottleneckData?.current}
                previous={bottleneckData?.previous}
              />
              <RecruiterLeaderboard data={recruiterData} />
            </div>
          </>
        )
      ) : tab === 'ops' ? (
        <OpsTab period={period} />
      ) : (
        <ExploreTab />
      )}
    </div>
  )
}

function KpiStrip({ data }) {
  const fmt = (v, suffix = '') => (v != null ? `${v}${suffix}` : '—')

  const kpis = [
    { label: 'Total Candidates',  value: fmt(data.total_candidates) },
    { label: 'Avg Time to Hire',  value: fmt(data.avg_time_to_hire, 'd') },
    { label: 'Offer Acceptance',  value: fmt(data.offer_acceptance_rate, '%') },
    { label: 'Active Positions',  value: fmt(data.active_positions) },
  ]

  return (
    <div className="analytics-kpi-strip">
      {kpis.map(k => (
        <div key={k.label} className="analytics-kpi-card">
          <span className="analytics-kpi-value">{k.value}</span>
          <span className="analytics-kpi-label">{k.label}</span>
        </div>
      ))}
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="skeleton-block" style={{ height: 200, borderRadius: 14 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton-block" style={{ height: 72, borderRadius: 10 }} />
        ))}
      </div>
      <div className="analytics-grid">
        <div className="skeleton-block" style={{ height: 400, borderRadius: 14, gridColumn: '1 / -1' }} />
        <div className="skeleton-block" style={{ height: 380, borderRadius: 14 }} />
        <div className="skeleton-block" style={{ height: 380, borderRadius: 14 }} />
      </div>
    </div>
  )
}
