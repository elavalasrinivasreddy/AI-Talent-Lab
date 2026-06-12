/**
 * Positions/PipelineStackView.jsx — v3 stack-ranked pipeline view
 * Replaces the Grid+Kanban toggle as the primary pipeline view.
 * Contains: StageHealthHeader + keyboard shortcut hint bar + ranked candidate rows.
 * Per docs/design/pages/03_position_detail.md §3.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi, candidatesApi, positionsApi } from '../../utils/api'
import { PIPELINE_STAGES, KANBAN_STAGE_ORDER } from '../../utils/constants'
import StageHealthHeader from './StageHealthHeader'
import CandidateRankedRow from './CandidateRankedRow'
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts'
import Icon from '../common/Icon'
import Toast from '../common/Toast'

const VISIBLE_STAGES = KANBAN_STAGE_ORDER

export default function PipelineStackView({
  positionId,
  activeStage,
  summary,
  summaryUnavailable,
}) {
  const navigate = useNavigate()
  const [kanban, setKanban] = useState(null)
  const [loading, setLoading] = useState(true)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const [viewMode, setViewMode] = useState('stack') // 'stack' or 'kanban'
  const [toast, setToast] = useState(null)

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
  useEffect(() => { setFocusedIndex(0) }, [activeStage])

  // Candidates for current stage sorted by ATS desc
  const candidates = useMemo(() => {
    if (!kanban) return []
    const list = [...(kanban[activeStage] || [])]
    list.sort((a, b) => (b.skill_match_score ?? -1) - (a.skill_match_score ?? -1))
    return list
  }, [kanban, activeStage])

  const stageData = summary?.stages?.[activeStage]

  const handleMove = async (candidate, newStatus) => {
    try {
      await candidatesApi.updateStatus(candidate.id, {
        status: newStatus,
        application_id: candidate.application_id,
        position_id: positionId,
      })
      load()
      setToast({ message: 'Candidate moved', type: 'success' })
    } catch (e) {
      setToast({ message: `Move failed: ${e.message}`, type: 'error' })
    }
  }

  const handleOpen = (candidate) => {
    navigate(`/candidates/${candidate.id}`, {
      state: {
        positionId,
        from: `/positions/${positionId}`,
        fromTab: 'pipeline',
        fromLabel: 'Back to Position',
      },
    })
  }

  useKeyboardShortcuts({
    enabled: viewMode === 'stack' && !loading,
    candidates,
    focusedIndex,
    setFocusedIndex,
    onOpen: handleOpen,
    onMove: (c) => {
      const nextIdx = VISIBLE_STAGES.indexOf(activeStage)
      const nextStage = VISIBLE_STAGES[nextIdx + 1]
      if (nextStage) handleMove(c, nextStage)
    },
    onSchedule: () => {}, // TODO: open schedule modal
    onReject: () => {},   // TODO: open rejection draft modal
    onEmail: () => {},    // TODO: open email modal
    onShowHelp: () => setShowHelp(v => !v),
  })

  if (loading) return <PipelineStackSkeleton />

  if (!kanban || VISIBLE_STAGES.every(s => !kanban[s]?.length)) {
    return (
      <div className="pd-stack-empty">
        <Icon name="search" size={32} style={{ opacity: 0.3 }} />
        <h3>No candidates yet</h3>
        <p>Click "Run Search" to source candidates for this position.</p>
      </div>
    )
  }

  return (
    <div className="pd-stack-view">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* View toggle */}
      <div className="pd-stack-toolbar">
        <div className="pd-view-toggle">
          <button
            className={`pd-view-btn ${viewMode === 'stack' ? 'active' : ''}`}
            onClick={() => setViewMode('stack')}
          >
            <Icon name="layers" size={14} /> Stack
          </button>
          <button
            className={`pd-view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
            onClick={() => setViewMode('kanban')}
          >
            <Icon name="bar-chart" size={14} /> Kanban
          </button>
        </div>
        <span className="pd-stack-count">
          {candidates.length} in {PIPELINE_STAGES[activeStage]?.label || activeStage}
        </span>
      </div>

      {viewMode === 'stack' ? (
        <>
          {/* Stage Health Header */}
          <StageHealthHeader
            stage={activeStage}
            stageData={stageData}
            unavailable={summaryUnavailable}
          />

          {/* Keyboard hint bar */}
          <div className="pd-kb-hints">
            <span className="pd-kb-key">↑↓</span> Navigate
            <span className="pd-kb-sep">·</span>
            <span className="pd-kb-key">→</span> Open
            <span className="pd-kb-sep">·</span>
            <span className="pd-kb-key">E</span> Email
            <span className="pd-kb-sep">·</span>
            <span className="pd-kb-key">I</span> Schedule
            <span className="pd-kb-sep">·</span>
            <span className="pd-kb-key">R</span> Reject
            <span className="pd-kb-sep">·</span>
            <span className="pd-kb-key">M</span> Move
            <span className="pd-kb-sep">·</span>
            <span className="pd-kb-key">?</span> All shortcuts
          </div>

          {/* Stack-ranked rows */}
          {candidates.length === 0 ? (
            <div className="pd-stage-empty-msg">
              <Icon name="inbox" size={20} style={{ opacity: 0.3 }} />
              <span>No candidates in {PIPELINE_STAGES[activeStage]?.label || activeStage} stage.</span>
              <div className="pd-stage-empty-actions">
                <button className="pd-btn pd-btn-outline" onClick={() => positionsApi.searchNow(positionId).then(load)}>
                  <Icon name="search" size={13} /> Run AI search
                </button>
              </div>
            </div>
          ) : (
            <div className="pd-ranked-list">
              {/* Column header */}
              <div className="pd-ranked-header">
                <span className="pd-rh-rank">#</span>
                <span className="pd-rh-ats">ATS</span>
                <span className="pd-rh-identity">Candidate</span>
                <span className="pd-rh-reasoning">Match</span>
                <span className="pd-rh-skills">Skills</span>
                <span className="pd-rh-source">Source</span>
                <span className="pd-rh-time">Time</span>
                <span className="pd-rh-actions">Actions</span>
              </div>

              {candidates.map((c, i) => (
                <CandidateRankedRow
                  key={c.application_id || c.id}
                  candidate={c}
                  rank={i + 1}
                  isFocused={i === focusedIndex}
                  stageTarget={stageData?.target_time_in_stage_days}
                  currentStage={activeStage}
                  onClick={() => handleOpen(c)}
                  onMove={handleMove}
                  onSchedule={() => {}} // TODO: schedule modal
                  onReject={() => {}}   // TODO: rejection draft modal
                />
              ))}
            </div>
          )}

          {/* Footer */}
          {candidates.length > 0 && (
            <div className="pd-stack-footer">
              <span className="pd-stack-footer-count">
                Showing {candidates.length} in {PIPELINE_STAGES[activeStage]?.label}
              </span>
            </div>
          )}
        </>
      ) : (
        /* Kanban fallback — render existing kanban cards inline */
        <KanbanFallback kanban={kanban} positionId={positionId} onMove={handleMove} onOpen={handleOpen} />
      )}

      {/* Shortcuts help overlay */}
      {showHelp && (
        <div className="pd-shortcuts-overlay" onClick={() => setShowHelp(false)}>
          <div className="pd-shortcuts-modal" onClick={e => e.stopPropagation()}>
            <h3>Keyboard Shortcuts</h3>
            <div className="pd-shortcuts-grid">
              {[
                ['↑ / ↓', 'Move focus row'],
                ['→', 'Open candidate detail'],
                ['E', 'Send outreach email'],
                ['I', 'Schedule interview'],
                ['R', 'Draft rejection'],
                ['M', 'Move to stage picker'],
                ['?', 'Toggle this overlay'],
              ].map(([key, desc]) => (
                <div key={key} className="pd-sc-row">
                  <span className="pd-sc-key">{key}</span>
                  <span className="pd-sc-desc">{desc}</span>
                </div>
              ))}
            </div>
            <button className="pd-btn pd-btn-outline" onClick={() => setShowHelp(false)} style={{ marginTop: 16 }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* Simple Kanban fallback using existing pipeline data */
function KanbanFallback({ kanban, positionId, onMove, onOpen }) {
  return (
    <div className="pd-kanban-board">
      {VISIBLE_STAGES.map(stage => {
        const cards = kanban[stage] || []
        const cfg = PIPELINE_STAGES[stage]
        return (
          <div key={stage} className="pd-kanban-col">
            <div className="pd-kanban-header" style={{ borderTopColor: cfg.color }}>
              <span style={{ color: cfg.color }}>{cfg.label}</span>
              <span className="pd-kanban-count">{cards.length}</span>
            </div>
            <div className="pd-kanban-cards">
              {cards.map(c => {
                const initials = (c.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                return (
                  <div key={c.application_id || c.id} className="pd-kanban-card" onClick={() => onOpen(c)}>
                    <div className="pd-kanban-card-top">
                      <span className="pd-kanban-avatar">{initials}</span>
                      <span className="pd-kanban-name">{c.name || 'Unknown'}</span>
                      {c.skill_match_score != null && (
                        <span className="pd-kanban-score">{Math.round(c.skill_match_score)}%</span>
                      )}
                    </div>
                    {c.current_company && (
                      <div className="pd-kanban-card-sub">{c.current_company}</div>
                    )}
                  </div>
                )
              })}
              {cards.length === 0 && <div className="pd-kanban-empty">—</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PipelineStackSkeleton() {
  return (
    <div className="pd-stack-view">
      <div className="skeleton-block" style={{ height: 40, marginBottom: 12, borderRadius: 8 }} />
      <div className="skeleton-block" style={{ height: 80, marginBottom: 12, borderRadius: 10 }} />
      <div className="skeleton-block" style={{ height: 32, marginBottom: 12, borderRadius: 6 }} />
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton-block" style={{ height: 56, marginBottom: 4, borderRadius: 8 }} />
      ))}
    </div>
  )
}
