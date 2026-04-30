/**
 * CandidatesTab.jsx – Sorted list view with filters, ATS score, quick actions.
 * Per docs/pages/04_position_detail.md §3.2
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { candidatesApi } from '../../../utils/api'
import { PIPELINE_STAGES, getScoreStyle } from '../../../utils/constants'
import StatusBadge from '../../common/StatusBadge'
import ScoreCircle from '../../common/ScoreCircle'
import './CandidatesTab.css'

const FILTER_STAGES = ['all', 'sourced', 'emailed', 'applied', 'screening', 'interview', 'selected', 'rejected']

export default function CandidatesTab({ positionId }) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { candidates: data } = await candidatesApi.listForPosition(positionId, {
        status: filter === 'all' ? null : filter,
        page,
      })
      setCandidates(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [positionId, filter, page])

  useEffect(() => { load() }, [load])

  const handleSendOutreach = async (applicationId) => {
    try {
      await candidatesApi.sendOutreach([applicationId])
      alert('✅ Outreach email queued!')
      load()
    } catch (e) {
      alert(`❌ ${e.message}`)
    }
  }

  return (
    <div className="cands-tab">
      {/* Filters */}
      <div className="cands-filter-bar">
        {FILTER_STAGES.map(s => (
          <button
            key={s}
            className={`cands-filter-btn ${filter === s ? 'active' : ''}`}
            onClick={() => { setFilter(s); setPage(1) }}
          >
            {s === 'all' ? 'All' : PIPELINE_STAGES[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="cands-skeleton">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton-block" style={{ height: 70, borderRadius: 8, marginBottom: 8 }} />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="cands-empty">
          <span>👥</span>
          <h3>No candidates {filter !== 'all' ? `in "${PIPELINE_STAGES[filter]?.label}"` : 'yet'}</h3>
          <p>{filter !== 'all' ? 'Try a different filter.' : 'Candidates will appear after the search runs.'}</p>
        </div>
      ) : (
        <div className="cands-list">
          {candidates.map(c => (
            <CandidateRow
              key={c.application_id || c.id}
              candidate={c}
              onView={() => navigate(`/candidates/${c.id}`, {
                state: { from: `/positions/${positionId}`, fromLabel: 'Back to Position', fromTab: 'candidates' }
              })}
              onSendOutreach={() => handleSendOutreach(c.application_id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {candidates.length === 50 && (
        <div className="cands-pagination">
          <button className="btn-outline" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>
            ← Prev
          </button>
          <span>Page {page}</span>
          <button className="btn-outline" onClick={() => setPage(p => p+1)}>Next →</button>
        </div>
      )}
    </div>
  )
}

function CandidateRow({ candidate, onView, onSendOutreach }) {
  const scoreStyle = candidate.skill_match_score != null
    ? getScoreStyle(candidate.skill_match_score)
    : null

  const initials = (candidate.name || '??')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const skillData = candidate.skill_match_data || {}

  return (
    <div className="cand-row" onClick={onView}>
      {/* Avatar */}
      <div className="cand-avatar">{initials}</div>

      {/* Info */}
      <div className="cand-info">
        <div className="cand-name">{candidate.name}</div>
        <div className="cand-sub">
          {candidate.current_title && <span>{candidate.current_title}</span>}
          {candidate.current_company && <span className="cand-sep">·</span>}
          {candidate.current_company && <span>{candidate.current_company}</span>}
          {candidate.experience_years != null && (
            <><span className="cand-sep">·</span><span>{candidate.experience_years} yrs</span></>
          )}
          {candidate.location && (
            <><span className="cand-sep">·</span><span>📍 {candidate.location}</span></>
          )}
        </div>
        {/* Skill pills */}
        {skillData.matched_skills?.length > 0 && (
          <div className="cand-skills">
            {skillData.matched_skills.slice(0, 4).map(s => (
              <span key={s} className="cand-skill-pill matched">{s}</span>
            ))}
            {skillData.missing_skills?.slice(0, 2).map(s => (
              <span key={s} className="cand-skill-pill missing">{s}</span>
            ))}
          </div>
        )}
      </div>

      {/* Score */}
      <div className="cand-score">
        <ScoreCircle score={candidate.skill_match_score} size={56} />
      </div>

      {/* Status + Actions */}
      <div className="cand-actions">
        <StatusBadge status={candidate.status} type="pipeline" size="sm" />
        <div className="cand-btns" onClick={e => e.stopPropagation()}>
          {candidate.status === 'sourced' && (
            <button className="cand-btn" onClick={onSendOutreach} title="Send outreach email">
              📧
            </button>
          )}
          <button className="cand-btn" onClick={onView} title="View profile">
            👤
          </button>
        </div>
      </div>
    </div>
  )
}
