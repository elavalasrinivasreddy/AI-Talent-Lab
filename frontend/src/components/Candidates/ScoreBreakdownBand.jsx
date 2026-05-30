/**
 * Candidates/ScoreBreakdownBand.jsx — v3 score equation visualizer
 * Per docs/design/pages/04_candidate_detail.md §5.
 * Horizontal stacked bar showing emb sim, skills match, experience, gap penalty.
 */
import React from 'react'

const WEIGHTS = { emb: 0.40, skills: 0.40, exp: 0.20 }

export default function ScoreBreakdownBand({ scoreData, finalScore }) {
  if (!scoreData || finalScore == null) return null

  const emb = scoreData.emb_score ?? scoreData.embedding_score ?? null
  const skills = scoreData.skills_match ?? null
  const exp = scoreData.experience_match ?? null

  // Calculate contributions
  const embContrib = emb != null ? Math.round(emb * WEIGHTS.emb * 100) : null
  const skillsContrib = skills != null ? Math.round(skills * WEIGHTS.skills * 100) : null
  const expContrib = exp != null ? Math.round(exp * WEIGHTS.exp * 100) : null

  const totalPositive = (embContrib || 0) + (skillsContrib || 0) + (expContrib || 0)
  const gap = totalPositive > finalScore ? 0 : Math.round(finalScore - totalPositive)
  const penalty = totalPositive > finalScore ? Math.round(totalPositive - finalScore) : 0

  const segments = [
    embContrib != null && { label: `emb ${emb?.toFixed(2)}`, value: embContrib, color: '#64748B', sign: '+' },
    skillsContrib != null && { label: `skills ${skills?.toFixed(2)}`, value: skillsContrib, color: '#10B981', sign: '+' },
    expContrib != null && { label: `exp ${exp?.toFixed(2)}`, value: expContrib, color: '#14B8A6', sign: '+' },
    penalty > 0 && { label: 'gap', value: penalty, color: '#EF4444', sign: '−' },
  ].filter(Boolean)

  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1

  return (
    <div className="cd-score-band">
      <div className="cd-score-band-header">
        <span className="cd-score-band-title">Score Breakdown</span>
        <span className="cd-score-band-formula">
          emb×{WEIGHTS.emb} + skills×{WEIGHTS.skills} + exp×{WEIGHTS.exp} × 100 = {finalScore}
        </span>
      </div>
      <div className="cd-score-band-bar" title={`emb×0.40 + skills×0.40 + exp×0.20 × 100 = ${finalScore}`}>
        {segments.map((seg, i) => (
          <div
            key={i}
            className="cd-score-band-segment"
            style={{
              width: `${(seg.value / total) * 100}%`,
              background: seg.color,
            }}
          >
            <span className="cd-score-band-seg-label">
              {seg.sign}{seg.value} {seg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
