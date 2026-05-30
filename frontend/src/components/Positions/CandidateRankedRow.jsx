/**
 * Positions/CandidateRankedRow.jsx — v3 stack-ranked candidate row
 * Per docs/design/pages/03_position_detail.md §4.
 *
 * Layout: rank · ATS score · avatar+name+sub · reasoning chips · skill chips · source · time-in-stage · actions
 */
import React, { useState } from 'react'
import Chip from '../common/Chip'
import Icon from '../common/Icon'
import { PIPELINE_STAGES, getScoreStyle } from '../../utils/constants'

const SOURCE_MAP = {
  'ai_sourced': { label: 'AI-sourced', variant: 'primary', icon: 'cpu' },
  'simulation': { label: 'AI-sourced', variant: 'primary', icon: 'cpu' },
  'referral':   { label: 'Referral', variant: 'info', icon: 'users' },
  'career_page': { label: 'Career page', variant: 'info', icon: 'home' },
  'linkedin':   { label: 'LinkedIn', variant: 'info', icon: 'briefcase' },
  'manual':     { label: 'Manual', variant: 'neutral', icon: 'user' },
}

const VISIBLE_STAGES = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected', 'rejected']

function timeInStage(updatedAt) {
  if (!updatedAt) return '—'
  const diff = Date.now() - new Date(updatedAt).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export default function CandidateRankedRow({
  candidate,
  rank,
  isFocused,
  stageTarget,
  currentStage,
  onClick,
  onMove,
  onSchedule,
  onReject,
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const score = candidate.skill_match_score
  const scoreStyle = score != null ? getScoreStyle(score) : null

  // Initials avatar
  const initials = (candidate.name || '??')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Reasoning chips from skill_match_data
  let matchedCount = 0, missingItems = [], expMatch = null
  try {
    const smd = typeof candidate.skill_match_data === 'string'
      ? JSON.parse(candidate.skill_match_data)
      : candidate.skill_match_data
    if (smd) {
      matchedCount = smd.matched_skills?.length || 0
      missingItems = (smd.missing_skills || []).slice(0, 2)
      expMatch = smd.experience_match
    }
  } catch { /* ignore */ }

  // Skills
  const skills = candidate.key_skills || []
  const visibleSkills = skills.slice(0, 3)
  const overflowSkills = skills.length - 3

  // Source
  const src = SOURCE_MAP[candidate.source] || SOURCE_MAP.manual

  // Time in stage
  const tis = timeInStage(candidate.updated_at || candidate.sourced_at)
  const tisHours = candidate.updated_at
    ? (Date.now() - new Date(candidate.updated_at).getTime()) / 3600000
    : null
  const stale = stageTarget && tisHours && (tisHours / 24) > stageTarget

  // Avatar gradient — vary by rank for visual distinction
  const hue = (rank * 37 + 120) % 360

  return (
    <div
      className={`pd-ranked-row ${isFocused ? 'focused' : ''} ${stale ? 'stale' : ''}`}
      onClick={onClick}
      tabIndex={0}
      data-rank={rank}
    >
      {/* Rank */}
      <div className="pd-rr-rank">#{rank}</div>

      {/* ATS Score */}
      <div className="pd-rr-ats" style={{ '--ats-color': scoreStyle?.color || '#94A3B8' }}>
        {score != null ? (
          <>
            <span className="pd-rr-ats-num">{Math.round(score)}</span>
            <span className="pd-rr-ats-label">ATS</span>
          </>
        ) : (
          <span className="pd-rr-ats-na">—</span>
        )}
      </div>

      {/* Identity */}
      <div className="pd-rr-identity">
        <div
          className="pd-rr-avatar"
          style={{
            background: `linear-gradient(135deg, hsl(${hue},50%,45%), hsl(${hue + 40},50%,35%))`,
          }}
        >
          {initials}
        </div>
        <div className="pd-rr-name-block">
          <span className="pd-rr-name">{candidate.name || 'Unknown'}</span>
          <span className="pd-rr-sub">
            {[
              candidate.experience_years != null ? `${candidate.experience_years} yrs` : null,
              candidate.current_company,
              candidate.location,
            ].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>

      {/* Reasoning chips */}
      <div className="pd-rr-reasoning">
        {matchedCount > 0 && (
          <Chip variant="success" size="xs">+{matchedCount} skills</Chip>
        )}
        {expMatch && (
          <Chip variant={expMatch.startsWith('+') ? 'success' : 'warning'} size="xs">{expMatch}</Chip>
        )}
        {missingItems.map((m, i) => (
          <Chip key={i} variant="danger" size="xs">−{m}</Chip>
        ))}
      </div>

      {/* Skills chips */}
      <div className="pd-rr-skills">
        {visibleSkills.map((s, i) => (
          <span key={i} className="pd-rr-skill-tag">{s}</span>
        ))}
        {overflowSkills > 0 && (
          <span className="pd-rr-skill-more">+{overflowSkills}</span>
        )}
      </div>

      {/* Source */}
      <div className="pd-rr-source">
        <Chip variant={src.variant} size="xs">
          <Icon name={src.icon} size={10} /> {src.label}
        </Chip>
      </div>

      {/* Time in stage */}
      <div className={`pd-rr-time ${stale ? 'stale' : ''}`}>
        {tis}
        {stale && <span className="pd-rr-stale-label">(stale)</span>}
      </div>

      {/* Actions */}
      <div className="pd-rr-actions" onClick={e => e.stopPropagation()}>
        <button
          className="pd-rr-action-primary"
          onClick={() => {
            const nextIdx = VISIBLE_STAGES.indexOf(currentStage)
            const nextStage = VISIBLE_STAGES[nextIdx + 1]
            if (nextStage) onMove(candidate, nextStage)
          }}
          title="Move to next stage"
        >
          Move →
        </button>
        <button className="pd-rr-action-icon" onClick={() => onSchedule?.(candidate)} title="Schedule interview (I)">
          <Icon name="calendar" size={13} />
        </button>
        <button
          className="pd-rr-action-icon pd-rr-more-btn"
          onClick={() => setMenuOpen(v => !v)}
          title="More actions"
        >
          <Icon name="chevron-down" size={13} />
        </button>

        {menuOpen && (
          <div className="pd-rr-menu">
            {VISIBLE_STAGES.filter(s => s !== currentStage).map(s => (
              <button
                key={s}
                className="pd-rr-menu-item"
                onClick={() => { onMove(candidate, s); setMenuOpen(false) }}
              >
                <span className="pd-rr-menu-dot" style={{ background: PIPELINE_STAGES[s]?.color }} />
                Move to {PIPELINE_STAGES[s]?.label || s}
              </button>
            ))}
            <div className="pd-rr-menu-divider" />
            <button className="pd-rr-menu-item" onClick={() => { onSchedule?.(candidate); setMenuOpen(false) }}>
              <Icon name="calendar" size={12} /> Schedule Interview
            </button>
            <button className="pd-rr-menu-item pd-rr-menu-danger" onClick={() => { onReject?.(candidate); setMenuOpen(false) }}>
              <Icon name="x" size={12} /> Draft Rejection
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
