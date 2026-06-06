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
import './AnalyticsPage.css'

const PERIODS = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'quarter', label: 'Last Quarter' },
  { value: 'year', label: 'Last Year' },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('week')
  const [roiData, setRoiData] = useState(null)
  const [recruiterData, setRecruiterData] = useState(null)
  const [bottleneckData, setBottleneckData] = useState(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      dashboardApi.getAgentRoi(period),
      dashboardApi.getRecruiterPerformance(period),
      dashboardApi.getBottlenecks(period)
    ])
      .then(([roi, rec, bot]) => {
        setRoiData(roi)
        setRecruiterData(rec)
        setBottleneckData(bot)
        setError(null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [period])

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">Agent ROI Dashboard</h1>
          <p className="analytics-subtitle">Measure the impact and efficiency of AI vs Human operations</p>
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
      ) : (
        <>
          <AgentROIHero data={roiData} />

          <div className="analytics-grid">
            <DualFunnel aiFunnel={roiData?.ai_funnel} humanFunnel={roiData?.human_funnel} />
            <BottleneckRadar current={bottleneckData?.current} previous={bottleneckData?.previous} />
            <RecruiterLeaderboard data={recruiterData} />
          </div>
        </>
      )}
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="skeleton-block" style={{ height: 180, borderRadius: 14 }} />
      <div className="analytics-grid">
        <div className="skeleton-block" style={{ height: 400, borderRadius: 14 }} />
        <div className="skeleton-block" style={{ height: 400, borderRadius: 14 }} />
        <div className="skeleton-block" style={{ height: 400, borderRadius: 14, gridColumn: 'span 2' }} />
      </div>
    </div>
  )
}
