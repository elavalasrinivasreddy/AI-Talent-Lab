/**
 * PipelineTab.jsx – Kanban board per docs/pages/04_position_detail.md §3.1
 * Horizontal scrolling columns, stage-colored headers, candidate cards.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi, candidatesApi } from '../../../utils/api'
import { PIPELINE_STAGES, KANBAN_STAGE_ORDER, getScoreStyle } from '../../../utils/constants'
import StatusBadge from '../../common/StatusBadge'
import './PipelineTab.css'

const VISIBLE_STAGES = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected', 'rejected']

export default function PipelineTab({ positionId }) {
  const [kanban, setKanban] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const data = await dashboardApi.getPipeline(positionId)
      setKanban(data)
    } catch (e) {
      console.error('Pipeline load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [positionId])

  useEffect(() => { load() }, [load])

  const handleMoveCard = async (card, newStatus) => {
    try {
      await candidatesApi.updateStatus(card.id, {
        status: newStatus,
        application_id: card.application_id,
        position_id: positionId,
      })
      load()
    } catch (e) {
      alert(`Move failed: ${e.message}`)
    }
  }

  if (loading) return <KanbanSkeleton />

  if (!kanban || VISIBLE_STAGES.every(s => !kanban[s]?.length)) {
    return (
      <div className="kanban-empty">
        <span>🔍</span>
        <h3>No candidates yet</h3>
        <p>Click "Run Search Now" to source candidates for this position.</p>
      </div>
    )
  }

  return (
    <div className="kanban-board">
      {VISIBLE_STAGES.map(stage => {
        const cards = kanban[stage] || []
        const stageConfig = PIPELINE_STAGES[stage]
        return (
          <div key={stage} className="kanban-column">
            <div className="kanban-col-header" style={{ borderTopColor: stageConfig.color }}>
              <span className="kanban-col-label" style={{ color: stageConfig.color }}>
                {stageConfig.label}
              </span>
              <span className="kanban-col-count" style={{ background: stageConfig.bg, color: stageConfig.color }}>
                {cards.length}
              </span>
            </div>

            <div className="kanban-cards">
              {cards.map(card => (
                <KanbanCard
                  key={card.application_id || card.id}
                  card={card}
                  positionId={positionId}
                  onMove={(newStatus) => handleMoveCard(card, newStatus)}
                  onClick={() => navigate(`/candidates/${card.id}`, {
                    state: { from: `/positions/${positionId}`, fromLabel: 'Back to Position', fromTab: 'pipeline' }
                  })}
                />
              ))}

              {cards.length === 0 && (
                <div className="kanban-col-empty">
                  <span>–</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({ card, positionId, onMove, onClick }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const score = card.skill_match_score
  const scoreStyle = score != null ? getScoreStyle(score) : null

  const initials = (card.name || '??')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="kanban-card" onClick={onClick}>
      <div className="kanban-card-top">
        <div className="kanban-avatar">{initials}</div>
        <div className="kanban-card-info">
          <div className="kanban-candidate-name">{card.name || 'Unknown'}</div>
          {card.current_title && (
            <div className="kanban-candidate-title">{card.current_title}</div>
          )}
        </div>
        {score != null && (
          <div className="kanban-score" style={{ color: scoreStyle.color }}>
            <div className="kanban-score-dot" style={{ background: scoreStyle.color }} />
            {Math.round(score)}%
          </div>
        )}
      </div>

      <div className="kanban-card-meta">
        {card.current_company && (
          <span className="kanban-meta-tag">{card.current_company}</span>
        )}
        {card.experience_years != null && (
          <span className="kanban-meta-tag">{card.experience_years} yrs</span>
        )}
      </div>

      <div className="kanban-card-actions" onClick={e => e.stopPropagation()}>
        <button
          className="kanban-menu-btn"
          onClick={() => setMenuOpen(p => !p)}
        >
          •••
        </button>
        {menuOpen && (
          <div className="kanban-menu">
            {VISIBLE_STAGES.filter(s => s !== card.status).map(s => (
              <button key={s} className="kanban-menu-item" onClick={() => { onMove(s); setMenuOpen(false) }}>
                Move to {PIPELINE_STAGES[s].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanSkeleton() {
  return (
    <div className="kanban-board">
      {VISIBLE_STAGES.slice(0, 5).map(s => (
        <div key={s} className="kanban-column">
          <div className="kanban-col-header skeleton-block" style={{ height: 38, borderRadius: 8 }} />
          {[1, 2].map(i => (
            <div key={i} className="skeleton-block" style={{ height: 100, margin: '8px 0', borderRadius: 10 }} />
          ))}
        </div>
      ))}
    </div>
  )
}
