/**
 * Candidates/ScoreBreakdownBand.jsx — v3 score equation visualizer
 * Per docs/design/pages/04_candidate_detail.md §5.
 * Horizontal stacked bar showing emb sim, skills match, experience, gap penalty.
 */
import React from 'react'

const WEIGHTS = { emb: 0.40, skills: 0.40, exp: 0.20 }

export default function ScoreBreakdownBand({ scoreData, finalScore }) {
  if (!scoreData || finalScore == null) return null

  const emb = scoreData.emb_score ?? scoreData.embedding_score ?? 0
  const skills = scoreData.skills_match ?? 0
  const exp = scoreData.experience_match ?? 0

  // Calculate contributions (raw scores are 0-100)
  const embContrib = Math.round(emb * WEIGHTS.emb)
  const skillsContrib = Math.round(skills * WEIGHTS.skills)
  const expContrib = Math.round(exp * WEIGHTS.exp)

  const totalPositive = embContrib + skillsContrib + expContrib
  const penalty = totalPositive > finalScore ? Math.round(totalPositive - finalScore) : 0

  return (
    <div className="cd-score-breakdown">
      <div className="cd-sb-header">
        <div className="cd-sb-title">Score Breakdown</div>
      </div>

      <div className="cd-sb-grid">
        {/* Semantic Match */}
        <div className="cd-sb-card emb">
          <div className="cd-sb-card-header">
            <div>
              <h4 className="cd-sb-card-title">Semantic</h4>
              <div className="cd-sb-card-weight">40% Weight</div>
            </div>
            <div className="cd-sb-card-points">+{embContrib}</div>
          </div>
          <div className="cd-sb-raw-score">
            <span>Match</span>
            <strong>{emb.toFixed(1)} / 100</strong>
          </div>
          <div className="cd-sb-progress-bg">
            <div className="cd-sb-progress-fill" style={{ width: `${Math.min(100, Math.max(0, emb))}%` }}></div>
          </div>
        </div>

        {/* Skills Match */}
        <div className="cd-sb-card skills">
          <div className="cd-sb-card-header">
            <div>
              <h4 className="cd-sb-card-title">Key Skills</h4>
              <div className="cd-sb-card-weight">40% Weight</div>
            </div>
            <div className="cd-sb-card-points">+{skillsContrib}</div>
          </div>
          <div className="cd-sb-raw-score">
            <span>Match</span>
            <strong>{skills.toFixed(1)} / 100</strong>
          </div>
          <div className="cd-sb-progress-bg">
            <div className="cd-sb-progress-fill" style={{ width: `${Math.min(100, Math.max(0, skills))}%` }}></div>
          </div>
        </div>

        {/* Experience Match */}
        <div className="cd-sb-card exp">
          <div className="cd-sb-card-header">
            <div>
              <h4 className="cd-sb-card-title">Experience</h4>
              <div className="cd-sb-card-weight">20% Weight</div>
            </div>
            <div className="cd-sb-card-points">+{expContrib}</div>
          </div>
          <div className="cd-sb-raw-score">
            <span>Match</span>
            <strong>{exp.toFixed(1)} / 100</strong>
          </div>
          <div className="cd-sb-progress-bg">
            <div className="cd-sb-progress-fill" style={{ width: `${Math.min(100, Math.max(0, exp))}%` }}></div>
          </div>
        </div>

        {/* Final ATS Score */}
        <div className={`cd-sb-card final ${penalty > 0 ? 'danger-border' : ''}`}>
          <div className="cd-sb-card-header">
            <div>
              <h4 className="cd-sb-card-title">ATS Score</h4>
              {penalty > 0 && (
                <div className="cd-sb-penalty-tag">−{penalty} gap penalty</div>
              )}
            </div>
            <div className="cd-sb-card-points">{finalScore}%</div>
          </div>
          <div className="cd-sb-raw-score" style={{ marginTop: 'auto' }}>
            <span>Final Result</span>
          </div>
          <div className="cd-sb-progress-bg">
            <div className="cd-sb-progress-fill" style={{ width: `${Math.min(100, Math.max(0, finalScore))}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}
