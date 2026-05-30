/**
 * Positions/StageHealthHeader.jsx — v3 stage health metrics
 * Shows for the currently active stage: stage name+count, ATS reminder,
 * avg time in stage (with warning), AI confidence, pass-through rate, saturation bar.
 * Per docs/design/pages/03_position_detail.md §6.
 */
import React from 'react'
import Chip from '../common/Chip'
import Icon from '../common/Icon'
import { PIPELINE_STAGES } from '../../utils/constants'

export default function StageHealthHeader({ stage, stageData, unavailable }) {
  const cfg = PIPELINE_STAGES[stage] || { label: stage, color: 'var(--color-text-muted, #94A3B8)' }

  if (unavailable) {
    return (
      <div className="pd-stage-health">
        <div className="pd-sh-warn-banner">
          <Icon name="alert-triangle" size={14} />
          Stage health unavailable — showing counts only
        </div>
      </div>
    )
  }

  if (!stageData) return null

  const avgTime = stageData.avg_time_in_stage_days
  const targetTime = stageData.target_time_in_stage_days
  const timeExceeded = avgTime != null && targetTime != null && avgTime > targetTime

  const confidence = stageData.ai_confidence_mean
  const confLabel = confidence >= 0.8 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low'
  const confVariant = confidence >= 0.8 ? 'success' : confidence >= 0.5 ? 'warning' : 'danger'

  const passThrough = stageData.pass_through_30d
  const passLabel = passThrough != null
    ? `${Math.round(passThrough * 100)}%`
    : '—'
  const passHealth = passThrough != null
    ? (passThrough >= 0.4 ? 'healthy' : passThrough >= 0.2 ? 'slow' : 'bottleneck')
    : null

  const saturation = stageData.saturation || 0

  return (
    <div className="pd-stage-health">
      <div className="pd-sh-title-row">
        <span className="pd-sh-dot" style={{ background: cfg.color }} />
        <span className="pd-sh-name">{cfg.label}</span>
        <span className="pd-sh-count">{stageData.count} candidate{stageData.count !== 1 ? 's' : ''}</span>
        <Chip variant="primary" size="xs">2-step ATS: embedding → LLM analysis</Chip>
      </div>

      <div className="pd-sh-metrics">
        {/* Avg time in stage */}
        <div className={`pd-sh-metric ${timeExceeded ? 'warn' : ''}`}>
          <Icon name="clock" size={13} />
          <span className="pd-sh-metric-label">Avg time</span>
          <span className="pd-sh-metric-value">
            {avgTime != null ? `${avgTime}d` : '—'}
          </span>
          {targetTime != null && (
            <span className="pd-sh-metric-target">
              target ≤ {targetTime}d
            </span>
          )}
        </div>

        {/* AI confidence */}
        {confidence != null && (
          <div className="pd-sh-metric">
            <Icon name="cpu" size={13} />
            <span className="pd-sh-metric-label">AI confidence</span>
            <Chip variant={confVariant} size="xs">{confLabel} · {confidence.toFixed(2)}</Chip>
          </div>
        )}

        {/* Pass-through rate */}
        <div className="pd-sh-metric">
          <Icon name="play" size={13} />
          <span className="pd-sh-metric-label">Pass-through</span>
          <span className="pd-sh-metric-value">{passLabel}</span>
          {passHealth && (
            <Chip
              variant={passHealth === 'healthy' ? 'success' : passHealth === 'slow' ? 'warning' : 'danger'}
              size="xs"
            >
              {passHealth}
            </Chip>
          )}
        </div>

        {/* Saturation bar */}
        <div className="pd-sh-metric">
          <Icon name="bar-chart" size={13} />
          <span className="pd-sh-metric-label">Saturation</span>
          <div className="pd-sh-saturation-bar">
            <div
              className="pd-sh-saturation-fill"
              style={{
                width: `${Math.min(saturation * 100, 100)}%`,
                background: cfg.color,
              }}
            />
          </div>
          <span className="pd-sh-metric-value">{Math.round(saturation * 100)}%</span>
        </div>
      </div>
    </div>
  )
}
