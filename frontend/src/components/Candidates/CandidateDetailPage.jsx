/**
 * CandidateDetailPage.jsx – Full candidate profile per docs/pages/05_candidate_detail.md
 * Tabs: Overview, Skills Match, Timeline, Resume, Interviews
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { candidatesApi } from '../../utils/api'
import { PIPELINE_STAGES, KANBAN_STAGE_ORDER, PIPELINE_EVENT_ICONS, getScoreStyle } from '../../utils/constants'
import StatusBadge from '../common/StatusBadge'
import ScoreCircle from '../common/ScoreCircle'
import InterviewsTab from './tabs/InterviewsTab'
import './CandidateDetailPage.css'

const TABS = [
  { id: 'overview', label: '👤 Overview' },
  { id: 'skills', label: '📊 Skills Match' },
  { id: 'timeline', label: '📜 Timeline' },
  { id: 'resume', label: '📄 Resume' },
  { id: 'interviews', label: '🎙️ Interviews' },
]

export default function CandidateDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const fromState = location.state || {}
  const positionId = fromState.positionId || new URLSearchParams(location.search).get('position_id')

  const [candidate, setCandidate] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [movingStatus, setMovingStatus] = useState(false)

  const load = useCallback(async () => {
    try {
      const [cand, tl] = await Promise.all([
        candidatesApi.get(id, positionId),
        candidatesApi.getTimeline(id, positionId),
      ])
      setCandidate(cand)
      setTimeline(tl.events || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [id, positionId])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (newStatus) => {
    if (!candidate?.application_id) return
    setMovingStatus(true)
    try {
      await candidatesApi.updateStatus(candidate.id, {
        status: newStatus,
        application_id: candidate.application_id,
        position_id: positionId,
      })
      setCandidate(prev => ({ ...prev, pipeline_status: newStatus }))
      load()
    } catch (e) {
      alert(`Move failed: ${e.message}`)
    } finally {
      setMovingStatus(false)
    }
  }

  const handleMarkSelected = async () => {
    if (!window.confirm('Mark this candidate as selected? This action will be logged.')) return
    try {
      await candidatesApi.markSelected(candidate.id, {
        application_id: candidate.application_id,
        position_id: positionId,
      })
      setCandidate(prev => ({ ...prev, pipeline_status: 'selected' }))
    } catch (e) {
      alert(`Error: ${e.message}`)
    }
  }

  if (loading) return <CandidateSkeleton />
  if (!candidate) return (
    <div className="cd-error">
      <span>⚠️</span>
      <p>Candidate not found</p>
      {fromState.from && <Link to={fromState.from}>← {fromState.fromLabel || 'Back'}</Link>}
    </div>
  )

  const scoreData = candidate.skill_match_data || {}
  const score = candidate.skill_match_score
  const initials = (candidate.name || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="cd-page">
      {/* Back link */}
      {fromState.from && (
        <Link
          to={fromState.from}
          className="cd-back-link"
          onClick={e => { e.preventDefault(); navigate(fromState.from) }}
        >
          ← {fromState.fromLabel || 'Back'}
        </Link>
      )}

      {/* ── Header ── */}
      <div className="cd-header">
        <div className="cd-avatar-lg">{initials}</div>
        <div className="cd-header-info">
          <h1 className="cd-name">{candidate.name}</h1>
          <div className="cd-subtitle">
            {candidate.current_title && <span>{candidate.current_title}</span>}
            {candidate.current_company && <><span className="cd-sep">·</span><span>@ {candidate.current_company}</span></>}
            {candidate.experience_years != null && (
              <><span className="cd-sep">·</span><span>{candidate.experience_years} years exp</span></>
            )}
          </div>
          <div className="cd-contact">
            {candidate.email && <span>📧 {candidate.email}</span>}
            {candidate.phone && <span>📞 {candidate.phone}</span>}
            {candidate.location && <span>📍 {candidate.location}</span>}
          </div>
          {candidate.pipeline_status && (
            <div style={{ marginTop: 8 }}>
              <StatusBadge status={candidate.pipeline_status} type="pipeline" size="md" />
            </div>
          )}
        </div>

        {/* Score */}
        <div className="cd-score-area">
          <ScoreCircle score={score} size={96} />
        </div>

        {/* Actions */}
        <div className="cd-actions">
          {candidate.application_id && positionId && (
            <>
              <select
                className="cd-status-select"
                value={candidate.pipeline_status || 'sourced'}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={movingStatus}
              >
                {KANBAN_STAGE_ORDER.map(s => (
                  <option key={s} value={s}>{PIPELINE_STAGES[s]?.label || s}</option>
                ))}
              </select>
              {candidate.pipeline_status !== 'selected' && (
                <button className="cd-select-btn" onClick={handleMarkSelected}>
                  ⭐ Mark Selected
                </button>
              )}
            </>
          )}
          {candidate.source_profile_url && (
            <a
              href={candidate.source_profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="cd-profile-link"
            >
              🔗 View Profile
            </a>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="cd-tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`cd-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="cd-tab-content">
        {activeTab === 'overview' && <OverviewTab candidate={candidate} />}
        {activeTab === 'skills' && <SkillsTab scoreData={scoreData} score={score} />}
        {activeTab === 'timeline' && <TimelineTab events={timeline} />}
        {activeTab === 'resume' && <ResumeTab candidate={candidate} />}
        {activeTab === 'interviews' && (
          <InterviewsTab
            candidateId={parseInt(id)}
            positionId={positionId ? parseInt(positionId) : null}
            candidateName={candidate.name}
            applicationId={candidate.application_id}
          />
        )}
      </div>
    </div>
  )
}

// ── Sub Tabs ───────────────────────────────────────────────────────────────────

function OverviewTab({ candidate }) {
  return (
    <div className="cd-section-grid">
      <div className="cd-section">
        <h3 className="cd-section-title">Professional Info</h3>
        <InfoRow label="Current Title" value={candidate.current_title} />
        <InfoRow label="Current Company" value={candidate.current_company} />
        <InfoRow label="Experience" value={candidate.experience_years ? `${candidate.experience_years} years` : null} />
        <InfoRow label="Location" value={candidate.location} />
        <InfoRow label="Source" value={candidate.source} />
      </div>
      <div className="cd-section">
        <h3 className="cd-section-title">Contact</h3>
        <InfoRow label="Email" value={candidate.email} />
        <InfoRow label="Phone" value={candidate.phone} />
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="cd-info-row">
      <span className="cd-info-label">{label}</span>
      <span className="cd-info-value">{value}</span>
    </div>
  )
}

function SkillsTab({ scoreData, score }) {
  return (
    <div className="cd-skills-tab">
      {scoreData.summary && (
        <div className="cd-ai-summary">
          <span className="cd-ai-badge">🤖 AI Analysis</span>
          <p>{scoreData.summary}</p>
        </div>
      )}

      <div className="cd-skills-grid">
        {scoreData.matched_skills?.length > 0 && (
          <div className="cd-skills-group">
            <h4 className="cd-skills-heading matched">✅ Matched Skills</h4>
            <div className="cd-skill-pills">
              {scoreData.matched_skills.map(s => (
                <span key={s} className="cd-skill-pill matched">{s}</span>
              ))}
            </div>
          </div>
        )}
        {scoreData.missing_skills?.length > 0 && (
          <div className="cd-skills-group">
            <h4 className="cd-skills-heading missing">❌ Missing Skills</h4>
            <div className="cd-skill-pills">
              {scoreData.missing_skills.map(s => (
                <span key={s} className="cd-skill-pill missing">{s}</span>
              ))}
            </div>
          </div>
        )}
        {scoreData.extra_skills?.length > 0 && (
          <div className="cd-skills-group">
            <h4 className="cd-skills-heading extra">➕ Bonus Skills</h4>
            <div className="cd-skill-pills">
              {scoreData.extra_skills.map(s => (
                <span key={s} className="cd-skill-pill extra">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {!scoreData.matched_skills?.length && !scoreData.missing_skills?.length && (
        <div className="cd-no-skills">ATS analysis not yet available for this candidate.</div>
      )}
    </div>
  )
}

function TimelineTab({ events }) {
  if (!events.length) {
    return <div className="cd-no-skills">No events recorded yet.</div>
  }
  return (
    <div className="cd-timeline">
      {events.map((evt, idx) => {
        const icon = PIPELINE_EVENT_ICONS[evt.event_type] || '📌'
        const data = evt.event_data || {}
        const ts = new Date(evt.created_at)
        return (
          <div key={idx} className="cd-event">
            <div className="cd-event-icon">{icon}</div>
            <div className="cd-event-body">
              <div className="cd-event-type">{evt.event_type?.replace(/_/g, ' ')}</div>
              {data.new_status && <div className="cd-event-detail">→ {data.new_status}</div>}
              {data.score != null && <div className="cd-event-detail">Score: {Math.round(data.score)}%</div>}
              {evt.user_name && <div className="cd-event-user">by {evt.user_name}</div>}
            </div>
            <div className="cd-event-time">
              {ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResumeTab({ candidate }) {
  const resume = candidate.resume_text || ''
  return (
    <div className="cd-resume">
      {resume ? (
        <pre className="cd-resume-text">{resume}</pre>
      ) : (
        <div className="cd-no-skills">No resume text available for this candidate.</div>
      )}
    </div>
  )
}

function CandidateSkeleton() {
  return (
    <div className="cd-page">
      <div className="skeleton-block" style={{ height: 180, borderRadius: 12, marginBottom: 16 }} />
      <div className="skeleton-block" style={{ height: 44, borderRadius: 8, marginBottom: 16 }} />
      <div className="skeleton-block" style={{ height: 400, borderRadius: 12 }} />
    </div>
  )
}
