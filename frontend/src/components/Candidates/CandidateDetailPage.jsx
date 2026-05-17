/**
 * CandidateDetailPage.jsx – Full candidate profile per docs/pages/05_candidate_detail.md
 * Tabs: Overview, Skills Match, Timeline, Resume, Interviews
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { candidatesApi, notesApi } from '../../utils/api'
import { PIPELINE_STAGES, KANBAN_STAGE_ORDER, PIPELINE_EVENT_ICONS } from '../../utils/constants'
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
  { id: 'notes', label: '📝 Notes' },
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
        {activeTab === 'skills' && <SkillsTab scoreData={scoreData} />}
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
        {activeTab === 'notes' && <NotesTab candidateId={parseInt(id)} />}
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

function SkillsTab({ scoreData }) {
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
  const videoUrl = candidate.video_intro_url
  const videoDuration = candidate.video_intro_duration

  return (
    <div className="cd-resume">
      {videoUrl && (
        <div className="cd-video-intro">
          <div className="cd-video-header">
            <span className="cd-video-label">📹 Video Introduction</span>
            {videoDuration && (
              <span className="cd-video-duration">
                {Math.floor(videoDuration / 60)}:{String(videoDuration % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          <video
            className="cd-video-player"
            src={videoUrl}
            controls
            preload="metadata"
          />
        </div>
      )}
      {resume ? (
        <pre className="cd-resume-text">{resume}</pre>
      ) : (
        <div className="cd-no-skills">
          {videoUrl ? 'No resume text — candidate submitted video only.' : 'No resume available for this candidate.'}
        </div>
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

// ── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({ candidateId }) {
  const [notes, setNotes] = useState([])
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    notesApi.list(candidateId)
      .then(d => setNotes(d.notes || []))
      .catch(() => {})
  }, [candidateId])

  const handleSubmit = async () => {
    if (!draft.trim()) return
    setSubmitting(true)
    try {
      const res = await notesApi.create(candidateId, { content: draft.trim() })
      setNotes(prev => [{ ...res.note, author_name: res.author_name, author_role: res.author_role }, ...prev])
      setDraft('')
    } catch (e) {
      alert(`Failed to save note: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (id) => {
    try {
      const res = await notesApi.update(id, editContent)
      setNotes(prev => prev.map(n => n.id === id ? { ...n, content: res.note.content, updated_at: res.note.updated_at } : n))
      setEditingId(null)
    } catch (e) {
      alert(`Update failed: ${e.message}`)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this note?')) return
    try {
      await notesApi.delete(id)
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch (e) {
      alert(`Delete failed: ${e.message}`)
    }
  }

  return (
    <div className="cd-notes-tab">
      <div className="cd-notes-compose">
        <textarea
          className="cd-notes-input"
          placeholder="Add a note… (use @name to mention a teammate)"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
        />
        <button className="cd-notes-submit" onClick={handleSubmit} disabled={submitting || !draft.trim()}>
          {submitting ? 'Saving…' : 'Add Note'}
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="cd-notes-empty">
          <span>📝</span>
          <p>No notes yet. Add the first one above.</p>
        </div>
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
                  <span className="cd-note-time">{new Date(note.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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
