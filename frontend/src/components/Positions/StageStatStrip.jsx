/**
 * Positions/StageStatStrip.jsx — v3 clickable 7-stage strip
 * Each cell: count + delta_today, colored top accent border.
 * Clicking a stage sets the active stage in PipelineStackView.
 * Per docs/design/pages/03_position_detail.md §3.
 */
import React from 'react'
import { PIPELINE_STAGES } from '../../utils/constants'

const STAGES = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected', 'rejected']

export default function StageStatStrip({ summary, activeStage, onStageClick }) {
  return (
    <div className="pd-stage-strip">
      {STAGES.map(key => {
        const cfg = PIPELINE_STAGES[key] || { label: key, color: 'var(--color-text-muted, #94A3B8)' }
        const data = summary?.stages?.[key] || { count: 0, delta_today: 0 }
        const isActive = activeStage === key

        return (
          <button
            key={key}
            className={`pd-stage-cell ${isActive ? 'active' : ''}`}
            style={{ '--stage-color': cfg.color }}
            onClick={() => onStageClick(key)}
          >
            <div className="pd-stage-count">
              {data.count}
              {data.delta_today > 0 && (
                <span className="pd-stage-delta">+{data.delta_today}</span>
              )}
            </div>
            <div className="pd-stage-label">{cfg.label}</div>
          </button>
        )
      })}
    </div>
  )
}
