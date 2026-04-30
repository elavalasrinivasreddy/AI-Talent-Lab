/**
 * InterviewsTab.jsx – Interview rounds + scorecards + debrief
 * Per docs/pages/10_interview_scheduling.md §3-4
 * Used inside CandidateDetailPage
 */
import React, { useState, useEffect } from 'react'
import { interviewsApi } from '../../../utils/api'
import ScheduleInterviewModal from '../../Interviews/ScheduleInterviewModal'
import './InterviewsTab.css'

const ROUND_STATUS_ICONS = {
  scheduled: '📅',
  completed: '✅',
  cancelled: '❌',
  pending: '⏳',
}

const RECOMMENDATION_MAP = {
  strong_yes: { label: 'Strong Yes', emoji: '💪', color: '#22c55e' },
  yes: { label: 'Yes', emoji: '👍', color: '#4ade80' },
  neutral: { label: 'Neutral', emoji: '😐', color: '#94a3b8' },
  no: { label: 'No', emoji: '👎', color: '#fb923c' },
  strong_no: { label: 'Strong No', emoji: '❌', color: '#ef4444' },
}

const DIMENSIONS = [
  { key: 'technical_skills', label: 'Technical Skills' },
  { key: 'problem_solving', label: 'Problem Solving' },
  { key: 'communication', label: 'Communication' },
  { key: 'culture_fit', label: 'Culture Fit' },
]

export default function InterviewsTab({ candidateId, positionId, candidateName, applicationId }) {
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [generating, setGenerating] = useState(null) // interview id
  const [debriefs, setDebriefs] = useState({}) // interview_id → debrief markdown

  const load = async () => {
    setLoading(true)
    try {
      const data = await interviewsApi.listForCandidate(candidateId)
      setInterviews(Array.isArray(data) ? data : data.interviews || [])
    } catch (e) {
      console.error('Failed to load interviews:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [candidateId])

  const handleScheduled = (newInterview) => {
    load()
  }

  const allCompleted = interviews.length > 0 && interviews.every(i => i.status === 'completed')
  const allScorecards = interviews.every(i =>
    i.panel_count === 0 || i.submitted_count >= i.panel_count
  )
  const canDebrief = allCompleted && allScorecards

  const handleGenerateDebrief = async (interviewId) => {
    setGenerating(interviewId)
    try {
      const result = await interviewsApi.generateDebrief(interviewId)
      setDebriefs(d => ({ ...d, [interviewId]: result.debrief }))
    } catch (e) {
      alert('Debrief generation failed: ' + e.message)
    } finally {
      setGenerating(null)
    }
  }

  const nextRound = (interviews.length > 0 ? Math.max(...interviews.map(i => i.round_number)) : 0) + 1

  if (loading) return <InterviewsSkeleton />

  return (
    <div className="interviews-tab">
      {/* Header */}
      <div className="interviews-tab-header">
        <h3 className="interviews-tab-title">🎙️ Interview Rounds</h3>
        <button
          className="interviews-schedule-btn"
          onClick={() => setShowScheduleModal(true)}
        >
          + Schedule Interview
        </button>
      </div>

      {interviews.length === 0 ? (
        <div className="interviews-empty">
          <span>📅</span>
          <p>No interviews scheduled yet.</p>
          <button className="interviews-schedule-btn" onClick={() => setShowScheduleModal(true)}>
            + Schedule First Interview
          </button>
        </div>
      ) : (
        <div className="interviews-list">
          {interviews.map(interview => (
            <InterviewRoundCard
              key={interview.id}
              interview={interview}
              debrief={debriefs[interview.id]}
              generating={generating === interview.id}
              onReload={load}
              onDebrief={() => handleGenerateDebrief(interview.id)}
            />
          ))}
        </div>
      )}

      {/* Debrief CTA */}
      {canDebrief && (
        <div className="debrief-cta">
          <span>🎯</span>
          <div>
            <h4>All rounds complete. All feedback received.</h4>
            <p>AI will synthesize all feedback into a hiring recommendation.</p>
          </div>
          <button
            className="debrief-btn"
            onClick={() => handleGenerateDebrief(interviews[interviews.length - 1].id)}
            disabled={!!generating}
          >
            {generating ? '⏳ Generating…' : '📋 Generate Interview Debrief'}
          </button>
        </div>
      )}

      {/* Schedule modal */}
      <ScheduleInterviewModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onCreated={handleScheduled}
        positionId={positionId}
        candidateId={candidateId}
        applicationId={applicationId}
        candidateName={candidateName}
        positionTitle=""
        roundNumber={nextRound}
      />
    </div>
  )
}

function InterviewRoundCard({ interview, debrief, generating, onReload, onDebrief }) {
  const [expanded, setExpanded] = useState(false)

  const statusIcon = ROUND_STATUS_ICONS[interview.status] || '⏳'
  const statusLabel = {
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
    pending: 'Not Scheduled',
  }[interview.status] || interview.status

  const scorecards = interview.scorecards || []
  const panelCount = interview.panel_count || 0
  const submittedCount = interview.submitted_count || 0

  const avgScore = scorecards.length > 0
    ? scorecards.reduce((s, sc) => s + (sc.overall_score || 0), 0) / scorecards.length
    : null

  return (
    <div className={`interview-round-card ${interview.status}`}>
      {/* Round header */}
      <div className="round-header" onClick={() => setExpanded(p => !p)}>
        <div className="round-header-left">
          <span className="round-status-icon">{statusIcon}</span>
          <div>
            <div className="round-name">{interview.round_name || `Round ${interview.round_number}`}</div>
            <div className="round-meta">
              {interview.scheduled_at && (
                <span>{new Date(interview.scheduled_at).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })}</span>
              )}
              {interview.duration_minutes && <span>· {interview.duration_minutes} min</span>}
              <span className={`round-status-badge ${interview.status}`}>{statusLabel}</span>
            </div>
          </div>
        </div>
        <div className="round-header-right">
          <span className="round-scorecard-count">
            {submittedCount}/{panelCount} scorecards
          </span>
          {avgScore != null && (
            <span className="round-avg-score">{avgScore.toFixed(1)}/5</span>
          )}
          <span className="round-expand-icon">{expanded ? '▲' : '▾'}</span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="round-body">
          {/* Panel list */}
          {interview.panel?.length > 0 && (
            <div className="round-panel-list">
              <span className="round-section-label">Panel:</span>
              {interview.panel.map(p => (
                <span key={p.id} className={`round-panelist ${p.feedback_submitted ? 'submitted' : ''}`}>
                  {p.panelist_name} {p.feedback_submitted ? '✅' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Scorecards */}
          {scorecards.length > 0 && (
            <div className="scorecards-section">
              <h4 className="round-section-label">Scorecards</h4>
              <div className="scorecards-table-wrap">
                <table className="scorecards-table">
                  <thead>
                    <tr>
                      <th>Panelist</th>
                      {DIMENSIONS.map(d => <th key={d.key}>{d.label.split(' ')[0]}</th>)}
                      <th>Overall</th>
                      <th>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scorecards.map(sc => {
                      const ratingsMap = Array.isArray(sc.ratings)
                        ? Object.fromEntries(sc.ratings.map(r => [r.dimension, r.score]))
                        : {}
                      const rec = RECOMMENDATION_MAP[sc.recommendation] || RECOMMENDATION_MAP.neutral
                      return (
                        <tr key={sc.id}>
                          <td className="scorecard-panelist">{sc.panelist_name}</td>
                          {DIMENSIONS.map(d => (
                            <td key={d.key} className="scorecard-score">
                              <StarMini score={ratingsMap[d.key]} />
                            </td>
                          ))}
                          <td className="scorecard-overall">{sc.overall_score?.toFixed(1) ?? '—'}/5</td>
                          <td>
                            <span className="rec-badge" style={{ color: rec.color }}>
                              {rec.emoji} {rec.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Debrief */}
          {debrief && (
            <div className="debrief-section">
              <h4 className="round-section-label">📋 Interview Debrief</h4>
              <div className="debrief-content">
                <pre className="debrief-text">{debrief}</pre>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="round-actions">
            {interview.status === 'completed' && submittedCount >= panelCount && !debrief && (
              <button
                className="round-action-btn primary"
                onClick={onDebrief}
                disabled={generating}
              >
                {generating ? '⏳ Generating…' : '📋 Generate Debrief'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StarMini({ score }) {
  if (score == null) return <span className="score-na">—</span>
  return (
    <span className="star-mini">
      {'★'.repeat(score)}{'☆'.repeat(5 - score)}
    </span>
  )
}

function InterviewsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px' }}>
      {[1, 2].map(i => (
        <div key={i} className="skeleton-block" style={{ height: 80, borderRadius: 12 }} />
      ))}
    </div>
  )
}
