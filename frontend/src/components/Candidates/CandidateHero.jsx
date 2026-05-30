/**
 * Candidates/CandidateHero.jsx — v3 hero with score ring + action panel
 * Per docs/design/pages/04_candidate_detail.md §3, §6.
 */
import React from 'react'
import { Link } from 'react-router-dom'
import Chip from '../common/Chip'
import Icon from '../common/Icon'
import ScoreCircle from '../common/ScoreCircle'
import { PIPELINE_STAGES, KANBAN_STAGE_ORDER, getScoreStyle } from '../../utils/constants'

const VISIBLE_MOVE_STAGES = ['sourced', 'emailed', 'applied', 'screening', 'interview']

function nextStageLabel(currentStage) {
  const idx = VISIBLE_MOVE_STAGES.indexOf(currentStage)
  if (idx >= 0 && idx < VISIBLE_MOVE_STAGES.length - 1) {
    const next = VISIBLE_MOVE_STAGES[idx + 1]
    return `Move to ${PIPELINE_STAGES[next]?.label || next}`
  }
  return 'Move →'
}

export default function CandidateHero({
  candidate,
  fromState,
  positionId,
  movingStatus,
  onStatusChange,
  onMarkSelected,
  onSchedule,
  onDraftRejection,
}) {
  const score = candidate.skill_match_score
  const scoreStyle = score != null ? getScoreStyle(score) : null
  const initials = (candidate.name || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  // Avatar gradient
  const hue = candidate.id ? (candidate.id * 37 + 120) % 360 : 180

  return (
    <div className="cd-hero">
      {/* Breadcrumb */}
      <div className="cd-breadcrumb-row">
        {fromState.from ? (
          <>
            <Link to={fromState.from} className="cd-breadcrumb-link">
              <Icon name="chevron-right" size={12} style={{ transform: 'rotate(180deg)' }} />
              {fromState.fromLabel || 'Back'}
            </Link>
            <span className="cd-breadcrumb-sep">›</span>
            <span className="cd-breadcrumb-current">{candidate.name}</span>
          </>
        ) : (
          <span className="cd-breadcrumb-current">{candidate.name}</span>
        )}
      </div>

      <div className="cd-hero-main">
        {/* Left: Avatar + Info */}
        <div className="cd-hero-identity">
          <div
            className="cd-hero-avatar"
            style={{ background: `linear-gradient(135deg, hsl(${hue},50%,45%), hsl(${hue + 40},50%,35%))` }}
          >
            {initials}
          </div>
          <div className="cd-hero-info">
            <h1 className="cd-hero-name">{candidate.name}</h1>
            <div className="cd-hero-meta">
              {[
                candidate.current_title,
                candidate.experience_years != null ? `${candidate.experience_years} yrs exp` : null,
                candidate.current_company ? `@ ${candidate.current_company}` : null,
              ].filter(Boolean).map((p, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="cd-hero-dot">·</span>}
                  <span>{p}</span>
                </React.Fragment>
              ))}
            </div>
            <div className="cd-hero-contact">
              {candidate.email && (
                <span><Icon name="mail" size={12} /> {candidate.email}</span>
              )}
              {candidate.location && (
                <span><Icon name="map-pin" size={12} /> {candidate.location}</span>
              )}
              {candidate.source_profile_url && (
                <a href={candidate.source_profile_url} target="_blank" rel="noopener noreferrer" className="cd-hero-profile-link">
                  <Icon name="briefcase" size={12} /> Profile
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Center: Score Ring */}
        <div className="cd-hero-score">
          <ScoreCircle score={score} size={96} />
        </div>

        {/* Right: Action Panel */}
        <div className="cd-hero-actions">
          {candidate.application_id && positionId && (
            <>
              <button
                className="cd-action-primary"
                onClick={() => {
                  const idx = VISIBLE_MOVE_STAGES.indexOf(candidate.pipeline_status)
                  const next = VISIBLE_MOVE_STAGES[idx + 1]
                  if (next) onStatusChange(next)
                }}
                disabled={movingStatus}
              >
                {nextStageLabel(candidate.pipeline_status)}
              </button>
              <button className="cd-action-secondary" onClick={onSchedule}>
                <Icon name="calendar" size={13} /> Schedule
              </button>
              {candidate.pipeline_status !== 'selected' && (
                <button className="cd-action-secondary" onClick={onMarkSelected}>
                  <Icon name="check" size={13} /> Mark Selected
                </button>
              )}
              <button className="cd-action-ghost-danger" onClick={onDraftRejection}>
                <Icon name="x" size={13} /> Draft Rejection
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
