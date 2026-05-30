/**
 * CandidateDetailPage.jsx — v3 Compare-to-Ideal redesign
 * Per docs/design/pages/04_candidate_detail.md
 * Redesigned 2026-05-29.
 *
 * Layout: breadcrumb → hero (score ring + actions) → tags row →
 *         score breakdown band → compare-to-ideal grid →
 *         3-card AI signals → tab rail → tab content
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { candidatesApi, notesApi } from '../../utils/api'
import { PIPELINE_STAGES, PIPELINE_EVENT_ICONS } from '../../utils/constants'

import CandidateHero from './CandidateHero'
import TagsRow from './TagsRow'
import ScoreBreakdownBand from './ScoreBreakdownBand'
import CompareToIdealGrid from './CompareToIdealGrid'
import InterviewsTab from './tabs/InterviewsTab'
import Icon from '../common/Icon'
import Chip from '../common/Chip'
import './CandidateDetailPage.css'

const TABS = [
  { id: 'skills',     label: 'Skills Match',  icon: 'layers' },
  { id: 'application',label: 'Application',   icon: 'file-text' },
  { id: 'resume',     label: 'Resume',        icon: 'file' },
  { id: 'interviews', label: 'Interviews',    icon: 'briefcase' },
  { id: 'timeline',   label: 'Timeline',      icon: 'clock' },
  { id: 'notes',      label: 'Notes',         icon: 'edit' },
]

export default function CandidateDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const fromState = location.state || {}
  const positionId = fromState.positionId || new URLSearchParams(location.search).get('position_id')

  const [candidate, setCandidate] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('skills')
  const [movingStatus, setMovingStatus] = useState(false)

  const load = useCallback(async () => {
    try {
      const [cand, tl] = await Promise.all([
        candidatesApi.get(id, positionId),
        candidatesApi.getTimeline(id, positionId),
      ])
      setCandidate(cand)
      setTimeline(tl.events || [])

      // Load tags
      try {
        const tagData = await candidatesApi.getTags(id)
        setTags(Array.isArray(tagData) ? tagData : tagData.tags || [])
      } catch { setTags([]) }
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
      <Icon name="alert-triangle" size={40} style={{ opacity: 0.3 }} />
      <p>Candidate not found</p>
      {fromState.from && <Link to={fromState.from} className="cd-error-link">← {fromState.fromLabel || 'Back'}</Link>}
    </div>
  )

  const scoreData = candidate.skill_match_data
    ? (typeof candidate.skill_match_data === 'string' ? JSON.parse(candidate.skill_match_data) : candidate.skill_match_data)
    : null
  const score = candidate.skill_match_score

  // Timing
  const stageEnteredAt = candidate.updated_at || candidate.sourced_at
  const totalDays = candidate.created_at
    ? Math.floor((Date.now() - new Date(candidate.created_at).getTime()) / 86400000)
    : null

  // AI signal cards
  const summary = scoreData?.summary || null
  const trajectory = scoreData?.career_trajectory || null
  const redFlags = scoreData?.red_flags || null

  return (
    <div className="cd-page">
      {/* Hero */}
      <CandidateHero
        candidate={candidate}
        fromState={fromState}
        positionId={positionId}
        movingStatus={movingStatus}
        onStatusChange={handleStatusChange}
        onMarkSelected={handleMarkSelected}
        onSchedule={() => {}} // TODO: schedule modal
        onDraftRejection={() => {}} // TODO: rejection draft modal
      />

      {/* Tags + Status row */}
      <TagsRow
        candidateId={parseInt(id)}
        tags={tags}
        pipelineStatus={candidate.pipeline_status}
        stageEnteredAt={stageEnteredAt}
        totalDays={totalDays}
        onTagsChange={setTags}
        onStatusChange={handleStatusChange}
        movingStatus={movingStatus}
      />

      {/* Score Breakdown Band */}
      <ScoreBreakdownBand scoreData={scoreData} finalScore={score} />

      {/* Compare-to-Ideal Grid — the radical part */}
      <CompareToIdealGrid scoreData={scoreData} finalScore={score} />

      {/* 3-card AI signal row */}
      <div className="cd-signal-cards">
        <div className="cd-signal-card">
          <div className="cd-signal-header">
            <Icon name="cpu" size={14} />
            <span>AI Analysis</span>
          </div>
          <p className="cd-signal-body">
            {summary || 'ATS analysis will populate once scoring completes.'}
          </p>
        </div>
        <div className="cd-signal-card">
          <div className="cd-signal-header">
            <Icon name="trending-up" size={14} />
            <span>Career Trajectory</span>
          </div>
          <p className="cd-signal-body">
            {trajectory ? (
              <Chip variant={trajectory === 'steady_growth' ? 'success' : trajectory === 'job_hopper' ? 'warning' : 'primary'} size="xs">
                {trajectory.replace(/_/g, ' ')}
              </Chip>
            ) : (
              'Not yet analyzed'
            )}
          </p>
        </div>
        <div className="cd-signal-card">
          <div className="cd-signal-header">
            <Icon name="alert-triangle" size={14} />
            <span>Red Flags</span>
          </div>
          <p className="cd-signal-body">
            {redFlags?.length > 0
              ? redFlags.map((f, i) => <Chip key={i} variant="danger" size="xs">{typeof f === 'object' ? f.flag : f}</Chip>)
              : <Chip variant="success" size="xs">None detected</Chip>
            }
          </p>
        </div>
      </div>

      {/* Tab Rail */}
      <div className="cd-tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`cd-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
            {t.id === 'interviews' && candidate.interview_count > 0 && (
              <span className="cd-tab-count">({candidate.interview_count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="cd-tab-content">
        {activeTab === 'skills' && <SkillsTab scoreData={scoreData} />}
        {activeTab === 'application' && <ApplicationTab candidate={candidate} />}
        {activeTab === 'resume' && <ResumeTab candidate={candidate} />}
        {activeTab === 'interviews' && (
          <InterviewsTab
            candidateId={parseInt(id)}
            positionId={positionId ? parseInt(positionId) : null}
            candidateName={candidate.name}
            applicationId={candidate.application_id}
          />
        )}
        {activeTab === 'timeline' && <TimelineTab events={timeline} />}
        {activeTab === 'notes' && <NotesTab candidateId={parseInt(id)} />}
      </div>
    </div>
  )
}

// ── Sub Tabs ───────────────────────────────────────────────────────────────────

function SkillsTab({ scoreData }) {
  if (!scoreData) {
    return <div className="cd-tab-empty"><Icon name="cpu" size={24} style={{opacity:0.3}}/><span>ATS analysis not yet available for this candidate.</span></div>
  }
  return (
    <div className="cd-skills-tab">
      {scoreData.summary && (
        <div className="cd-ai-summary">
          <span className="cd-ai-badge"><Icon name="cpu" size={12} /> AI Analysis</span>
          <p>{scoreData.summary}</p>
        </div>
      )}
      <div className="cd-skills-grid">
        {scoreData.matched_skills?.length > 0 && (
          <div className="cd-skills-group">
            <h4 className="cd-skills-heading matched"><Icon name="check" size={13} /> Matched Skills ({scoreData.matched_skills.length})</h4>
            <div className="cd-skill-pills">
              {scoreData.matched_skills.map((s, i) => {
                const label = typeof s === 'object' ? s.skill : s
                return <span key={i} className="cd-skill-pill matched">{label}</span>
              })}
            </div>
          </div>
        )}
        {scoreData.missing_skills?.length > 0 && (
          <div className="cd-skills-group">
            <h4 className="cd-skills-heading missing"><Icon name="x" size={13} /> Missing Skills ({scoreData.missing_skills.length})</h4>
            <div className="cd-skill-pills">
              {scoreData.missing_skills.map((s, i) => {
                const label = typeof s === 'object' ? s.skill : s
                return <span key={i} className="cd-skill-pill missing">{label}</span>
              })}
            </div>
          </div>
        )}
        {scoreData.extra_skills?.length > 0 && (
          <div className="cd-skills-group">
            <h4 className="cd-skills-heading extra"><Icon name="plus" size={13} /> Bonus Skills ({scoreData.extra_skills.length})</h4>
            <div className="cd-skill-pills">
              {scoreData.extra_skills.map((s, i) => {
                const label = typeof s === 'object' ? s.skill : s
                return <span key={i} className="cd-skill-pill extra">{label}</span>
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ApplicationTab({ candidate }) {
  if (!candidate.applied_at && !candidate.screening_responses) {
    return <div className="cd-tab-empty"><Icon name="file-text" size={24} style={{opacity:0.3}}/><span>Candidate sourced/emailed but hasn't applied yet.</span></div>
  }
  const responses = candidate.screening_responses
    ? (typeof candidate.screening_responses === 'string' ? JSON.parse(candidate.screening_responses) : candidate.screening_responses)
    : null

  return (
    <div className="cd-application-tab">
      <div className="cd-section">
        <h3 className="cd-section-title">Application Details</h3>
        <InfoRow label="Applied" value={candidate.applied_at ? new Date(candidate.applied_at).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : null} />
        <InfoRow label="Current Role" value={candidate.current_title ? `${candidate.current_title} at ${candidate.current_company || '—'}` : null} />
        <InfoRow label="Experience" value={candidate.experience_years != null ? `${candidate.experience_years} years` : null} />
        <InfoRow label="Location" value={candidate.location} />
        <InfoRow label="Source" value={candidate.source} />
      </div>
      {responses && (
        <div className="cd-section" style={{marginTop: 16}}>
          <h3 className="cd-section-title">Screening Responses</h3>
          {Object.entries(responses).map(([q, a]) => (
            <InfoRow key={q} label={q} value={String(a)} />
          ))}
        </div>
      )}
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

function ResumeTab({ candidate }) {
  const resume = candidate.resume_text || ''
  const videoUrl = candidate.video_intro_url

  return (
    <div className="cd-resume">
      {videoUrl && (
        <div className="cd-video-intro">
          <div className="cd-video-header">
            <span className="cd-video-label"><Icon name="play" size={13} /> Video Introduction</span>
            {candidate.video_intro_duration && (
              <span className="cd-video-duration">
                {Math.floor(candidate.video_intro_duration / 60)}:{String(candidate.video_intro_duration % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          <video className="cd-video-player" src={videoUrl} controls preload="metadata" />
        </div>
      )}
      {resume ? (
        <pre className="cd-resume-text">{resume}</pre>
      ) : (
        <div className="cd-tab-empty">
          <Icon name="file" size={24} style={{opacity:0.3}} />
          <span>{videoUrl ? 'No resume text — candidate submitted video only.' : 'No resume uploaded. Candidate was sourced — upload one manually if available.'}</span>
        </div>
      )}
    </div>
  )
}

function TimelineTab({ events }) {
  if (!events.length) {
    return <div className="cd-tab-empty"><Icon name="clock" size={24} style={{opacity:0.3}}/><span>No events recorded yet.</span></div>
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

function NotesTab({ candidateId }) {
  const [notes, setNotes] = useState([])
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    notesApi.list(candidateId).then(d => setNotes(d.notes || [])).catch(() => {})
  }, [candidateId])

  const handleSubmit = async () => {
    if (!draft.trim()) return
    setSubmitting(true)
    try {
      const res = await notesApi.create(candidateId, { content: draft.trim() })
      setNotes(prev => [{ ...res.note, author_name: res.author_name, author_role: res.author_role }, ...prev])
      setDraft('')
    } catch (e) { alert(`Failed to save note: ${e.message}`) }
    finally { setSubmitting(false) }
  }

  const handleUpdate = async (nid) => {
    try {
      const res = await notesApi.update(nid, editContent)
      setNotes(prev => prev.map(n => n.id === nid ? { ...n, content: res.note.content, updated_at: res.note.updated_at } : n))
      setEditingId(null)
    } catch (e) { alert(`Update failed: ${e.message}`) }
  }

  const handleDelete = async (nid) => {
    if (!window.confirm('Delete this note?')) return
    try {
      await notesApi.delete(nid)
      setNotes(prev => prev.filter(n => n.id !== nid))
    } catch (e) { alert(`Delete failed: ${e.message}`) }
  }

  return (
    <div className="cd-notes-tab">
      <div className="cd-notes-compose">
        <textarea className="cd-notes-input" placeholder="Add a note… (use @name to mention)" value={draft} onChange={e => setDraft(e.target.value)} rows={3} />
        <button className="cd-notes-submit" onClick={handleSubmit} disabled={submitting || !draft.trim()}>
          {submitting ? 'Saving…' : 'Add Note'}
        </button>
      </div>
      {notes.length === 0 ? (
        <div className="cd-tab-empty"><Icon name="edit" size={24} style={{opacity:0.3}}/><span>No notes yet. Add the first one above.</span></div>
      ) : (
        <div className="cd-notes-list">
          {notes.map(note => (
            <div key={note.id} className="cd-note-card">
              <div className="cd-note-header">
                <div className="cd-note-author">
                  <span className="cd-note-avatar">{(note.author_name || 'U')[0]}</span>
                  <span className="cd-note-name">{note.author_name}</span>
                  <span className="cd-note-role">{note.author_role}</span>
                </div>
                <div className="cd-note-meta">
                  <span className="cd-note-time">{new Date(note.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
                  <button className="cd-note-action" onClick={() => { setEditingId(note.id); setEditContent(note.content) }}>Edit</button>
                  <button className="cd-note-action cd-note-delete" onClick={() => handleDelete(note.id)}>Delete</button>
                </div>
              </div>
              {editingId === note.id ? (
                <div className="cd-note-edit">
                  <textarea className="cd-notes-input" value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="cd-notes-submit" onClick={() => handleUpdate(note.id)}>Save</button>
                    <button className="cd-note-action" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="cd-note-content">{note.content}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CandidateSkeleton() {
  return (
    <div className="cd-page">
      <div className="skeleton-block" style={{ height: 180, borderRadius: 14 }} />
      <div className="skeleton-block" style={{ height: 48, marginTop: 12, borderRadius: 10 }} />
      <div className="skeleton-block" style={{ height: 36, marginTop: 12, borderRadius: 8 }} />
      <div className="skeleton-block" style={{ height: 260, marginTop: 12, borderRadius: 14 }} />
      <div className="skeleton-block" style={{ height: 100, marginTop: 12, borderRadius: 12 }} />
      <div className="skeleton-block" style={{ height: 44, marginTop: 12, borderRadius: 10 }} />
      <div className="skeleton-block" style={{ height: 300, marginTop: 12, borderRadius: 14 }} />
    </div>
  )
}
