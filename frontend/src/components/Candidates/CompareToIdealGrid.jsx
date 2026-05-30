/**
 * Candidates/CompareToIdealGrid.jsx — v3 compare-to-ideal two-column grid
 * Per docs/design/pages/04_candidate_detail.md §4.
 * LEFT: What the role needs  |  RIGHT: What this candidate has
 * Each row: marker (✓/~/✗) + requirement text + weight vs evidence + points.
 */
import React, { useState } from 'react'
import Chip from '../common/Chip'
import Icon from '../common/Icon'

const MARKER = {
  met:     { icon: '✓', cls: 'met',     variant: 'success' },
  partial: { icon: '~', cls: 'partial', variant: 'warning' },
  missing: { icon: '✗', cls: 'missing', variant: 'danger' },
}

/**
 * Parse skill_match_data into a unified requirement rows list.
 * Each row: { status, skill, weight, evidence, points, severity }
 */
function buildRequirementRows(scoreData) {
  const rows = []

  // Matched
  const matched = scoreData.matched_skills || []
  matched.forEach(item => {
    const isObj = typeof item === 'object'
    rows.push({
      status: 'met',
      skill: isObj ? item.skill : item,
      weight: isObj ? item.weight : null,
      evidence: isObj ? item.evidence : 'Strong match',
      points: isObj ? item.weight : null,
    })
  })

  // Partial
  const partial = scoreData.partial_skills || []
  partial.forEach(item => {
    const isObj = typeof item === 'object'
    rows.push({
      status: 'partial',
      skill: isObj ? item.skill : item,
      weight: isObj ? item.weight : null,
      evidence: isObj ? item.evidence : 'Partial match — needs probing',
      points: isObj ? Math.round((item.weight || 0) * 0.5) : null,
    })
  })

  // Missing
  const missing = scoreData.missing_skills || []
  missing.forEach(item => {
    const isObj = typeof item === 'object'
    rows.push({
      status: 'missing',
      skill: isObj ? item.skill : item,
      weight: isObj ? item.weight : null,
      evidence: isObj ? (item.severity === 'low' ? 'Worth probing in interview' : 'Gap — not evidenced') : 'Not found in profile',
      severity: isObj ? item.severity : null,
      points: 0,
    })
  })

  // Sort: met first, then partial, then missing. Within each group, by weight desc.
  const order = { met: 0, partial: 1, missing: 2 }
  rows.sort((a, b) => {
    const o = order[a.status] - order[b.status]
    if (o !== 0) return o
    return (b.weight || 0) - (a.weight || 0)
  })

  return rows
}

export default function CompareToIdealGrid({ scoreData, finalScore }) {
  const [showGapsOnly, setShowGapsOnly] = useState(false)

  if (!scoreData) {
    return (
      <div className="cd-compare-empty">
        <Icon name="cpu" size={28} style={{ opacity: 0.25 }} />
        <span>Scoring in progress · auto-retries in 30s</span>
      </div>
    )
  }

  const allRows = buildRequirementRows(scoreData)

  if (allRows.length === 0) {
    return (
      <div className="cd-compare-empty">
        <Icon name="layers" size={28} style={{ opacity: 0.25 }} />
        <span>No detailed skill match data available yet.</span>
        <span className="cd-compare-empty-sub">ATS analysis may use overall resume comparison.</span>
      </div>
    )
  }

  const displayRows = showGapsOnly
    ? allRows.filter(r => r.status !== 'met')
    : allRows

  const metCount = allRows.filter(r => r.status === 'met').length
  const totalCount = allRows.length

  return (
    <div className="cd-compare">
      <div className="cd-compare-header">
        <div className="cd-compare-title-row">
          <Icon name="layers" size={16} />
          <h3 className="cd-compare-title">Requirements Match</h3>
          <span className="cd-compare-subtitle">
            Comparing this candidate against the JD · {metCount} of {totalCount} must-haves met
          </span>
        </div>
        <button
          className={`cd-compare-toggle ${showGapsOnly ? 'active' : ''}`}
          onClick={() => setShowGapsOnly(v => !v)}
        >
          <Icon name="eye" size={12} />
          {showGapsOnly ? 'Show all' : 'Show gaps only'}
        </button>
      </div>

      <div className="cd-compare-grid">
        {/* Column headers */}
        <div className="cd-compare-col-headers">
          <div className="cd-compare-col-left">What the role needs</div>
          <div className="cd-compare-col-right">What this candidate has</div>
        </div>

        {/* Rows */}
        {displayRows.map((row, i) => {
          const m = MARKER[row.status]
          return (
            <div key={i} className={`cd-compare-row ${m.cls}`}>
              {/* LEFT: requirement */}
              <div className="cd-compare-cell cd-compare-left">
                <span className={`cd-compare-marker ${m.cls}`}>{m.icon}</span>
                <span className="cd-compare-req">{row.skill}</span>
                {row.weight != null && (
                  <span className="cd-compare-weight">w{row.weight}</span>
                )}
              </div>

              {/* RIGHT: evidence */}
              <div className="cd-compare-cell cd-compare-right">
                <span className={`cd-compare-marker ${m.cls}`}>{m.icon}</span>
                <span className="cd-compare-evidence">{row.evidence}</span>
                {row.points != null && (
                  <span className={`cd-compare-points ${m.cls}`}>
                    {row.status === 'missing' ? '0' : `+${row.points}`}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Extra skills (not in JD) */}
      {scoreData.extra_skills?.length > 0 && (
        <div className="cd-compare-extra">
          <span className="cd-compare-extra-label">
            <Icon name="plus" size={11} /> Bonus skills not in JD:
          </span>
          {scoreData.extra_skills.map((s, i) => {
            const skill = typeof s === 'object' ? s.skill : s
            return <Chip key={i} variant="primary" size="xs">{skill}</Chip>
          })}
        </div>
      )}
    </div>
  )
}
