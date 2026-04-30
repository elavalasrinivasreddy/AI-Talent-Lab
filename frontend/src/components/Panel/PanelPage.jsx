/**
 * PanelPage.jsx – Panel member feedback submission via magic link
 * Route: /panel/:token (public, no auth)
 * Per docs/pages/11_panel_feedback.md — mobile-first form
 */
import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import './PanelPage.css'

const API_BASE = '/api/v1/panel'

const DIMENSIONS = [
  {
    key: 'technical_skills',
    label: 'Technical Skills',
    desc: 'Assess technical depth, problem-solving approach, code quality demonstrated',
  },
  {
    key: 'problem_solving',
    label: 'Problem Solving',
    desc: 'Ability to break down complex problems and arrive at systematic solutions',
  },
  {
    key: 'communication',
    label: 'Communication',
    desc: 'Clarity of explanation, listening skills, articulation',
  },
  {
    key: 'culture_fit',
    label: 'Culture Fit',
    desc: 'Alignment with team values and working style',
  },
]

const WEIGHTS = {
  technical_skills: 0.40,
  problem_solving: 0.30,
  communication: 0.15,
  culture_fit: 0.15,
}

const RECOMMENDATIONS = [
  { value: 'strong_yes', label: 'Strong Yes', emoji: '💪' },
  { value: 'yes', label: 'Yes', emoji: '👍' },
  { value: 'neutral', label: 'Neutral', emoji: '😐' },
  { value: 'no', label: 'No', emoji: '👎' },
  { value: 'strong_no', label: 'Strong No', emoji: '❌' },
]

function computeOverall(ratings) {
  let total = 0
  for (const [dim, weight] of Object.entries(WEIGHTS)) {
    total += (ratings[dim] || 0) * weight
  }
  return Math.round(total * 100) / 100
}

export default function PanelPage() {
  const { token } = useParams()
  const [pageState, setPageState] = useState('loading')
  const [context, setContext] = useState(null)
  const [attended, setAttended] = useState(null) // null | true | false
  const [ratings, setRatings] = useState({}) // dim → score
  const [ratingNotes, setRatingNotes] = useState({}) // dim → note text
  const [strengthsRaw, setStrengthsRaw] = useState('')
  const [concernsRaw, setConcernsRaw] = useState('')
  const [strengthsEnriched, setStrengthsEnriched] = useState('')
  const [concernsEnriched, setConcernsEnriched] = useState('')
  const [enriched, setEnriched] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [useEnriched, setUseEnriched] = useState(null) // null | true | false
  const [recommendation, setRecommendation] = useState('')
  const [additionalComments, setAdditionalComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [resumeOpen, setResumeOpen] = useState(false)
  const [jdOpen, setJdOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadContext() }, [token])

  const loadContext = async () => {
    try {
      const res = await fetch(`${API_BASE}/${token}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const code = err?.code || err?.detail?.code || ''
        setPageState(code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid')
        return
      }
      const data = await res.json()
      if (!data.valid) { setPageState('expired'); return }
      if (data.already_submitted) { setPageState('submitted'); setContext(data); return }
      setContext(data)
      setPageState('attendance')
    } catch (e) {
      setPageState('invalid')
    }
  }

  const handleAttendance = async (didAttend) => {
    setAttended(didAttend)
    if (!didAttend) {
      // Mark as not attended and close
      try {
        await fetch(`${API_BASE}/${token}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attended: false, is_draft: false }),
        })
      } catch (e) {}
      setPageState('not_attended')
    } else {
      setPageState('form')
    }
  }

  const handleEnrich = async () => {
    if (!strengthsRaw.trim() && !concernsRaw.trim()) return
    setEnriching(true)
    try {
      const res = await fetch(`${API_BASE}/${token}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strengths_raw: strengthsRaw, concerns_raw: concernsRaw }),
      })
      const data = await res.json()
      setStrengthsEnriched(data.strengths || strengthsRaw)
      setConcernsEnriched(data.concerns || concernsRaw)
      setEnriched(true)
      setUseEnriched(null)
    } catch (e) {
      setError('AI enrichment failed. Your original notes are kept.')
    } finally {
      setEnriching(false)
    }
  }

  const allRated = DIMENSIONS.every(d => ratings[d.key] > 0)

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    setError('')
    try {
      await submitPayload(true)
    } catch (e) {
      setError('Draft save failed: ' + e.message)
    } finally {
      setSavingDraft(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    if (!allRated) { setError('Please rate all 4 dimensions before submitting.'); return }
    if (!recommendation) { setError('Please select your hiring recommendation.'); return }
    setConfirmDialog(true)
  }

  const confirmSubmit = async () => {
    setConfirmDialog(false)
    setSubmitting(true)
    try {
      await submitPayload(false)
      setSubmitSuccess(true)
    } catch (e) {
      setError('Submission failed: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const submitPayload = async (isDraft) => {
    const finalStrengths = useEnriched === true ? strengthsEnriched : strengthsRaw
    const finalConcerns = useEnriched === true ? concernsEnriched : concernsRaw
    const overall = computeOverall(ratings)

    const ratingsList = DIMENSIONS.map(d => ({
      dimension: d.key,
      score: ratings[d.key] || 0,
      notes: ratingNotes[d.key] || '',
    }))

    const body = {
      is_draft: isDraft,
      attended: true,
      ratings: ratingsList,
      overall_score: overall,
      recommendation: recommendation || null,
      strengths: finalStrengths || null,
      concerns: finalConcerns || null,
      additional_comments: additionalComments || null,
      raw_notes_strengths: strengthsRaw || null,
      raw_notes_concerns: concernsRaw || null,
    }

    const res = await fetch(`${API_BASE}/${token}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.message || err?.detail?.message || 'Submit failed')
    }
    return await res.json()
  }

  const overallScore = computeOverall(ratings)

  // ── Page states ────────────────────────────────────────────────────────────
  if (pageState === 'loading') return <PanelStateLoading />
  if (pageState === 'expired' || pageState === 'invalid') return <PanelStateExpired context={context} />
  if (pageState === 'submitted') return <PanelStateSubmitted context={context} />
  if (pageState === 'not_attended') return <PanelStateNotAttended />
  if (submitSuccess) return <PanelStateSuccess overallScore={overallScore} recommendation={recommendation} context={context} />

  const org = context?.org_name || 'the company'
  const candidate = context?.candidate_name || 'the candidate'
  const roundLabel = context?.round_name || `Round ${context?.round_number || 1}`

  // Attendance gate
  if (pageState === 'attendance') {
    return (
      <div className="panel-page">
        <PanelHeader org={org} />
        <div className="panel-attendance-gate">
          <div className="attendance-card">
            <h2>Were you present in this interview?</h2>
            <p className="attendance-sub">{candidate} · {roundLabel}</p>
            <div className="attendance-btns">
              <button className="attend-btn primary" onClick={() => handleAttendance(true)}>
                ✅ Yes, I attended
              </button>
              <button className="attend-btn" onClick={() => handleAttendance(false)}>
                I was not present
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Feedback form ──────────────────────────────────────────────────────────
  return (
    <div className="panel-page">
      <PanelHeader org={org} />

      {/* Context banner */}
      <div className="panel-context-banner">
        <span>👤 <strong>{candidate}</strong></span>
        <span>💼 {context?.role_name}</span>
        <span>🎙️ {roundLabel}</span>
        {context?.scheduled_at && (
          <span>📅 {new Date(context.scheduled_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short'
          })}</span>
        )}
      </div>

      {/* Collapsible resume/JD */}
      <div className="panel-collapses">
        {context?.resume_text && (
          <div>
            <button className="panel-collapse-btn" onClick={() => setResumeOpen(p => !p)}>
              📄 {resumeOpen ? 'Hide Resume ▲' : 'View Resume ▾'}
            </button>
            {resumeOpen && (
              <div className="panel-collapse-body">
                <pre className="panel-resume-text">{context.resume_text}</pre>
              </div>
            )}
          </div>
        )}
        {context?.jd_markdown && (
          <div>
            <button className="panel-collapse-btn" onClick={() => setJdOpen(p => !p)}>
              📋 {jdOpen ? 'Hide JD ▲' : 'View JD ▾'}
            </button>
            {jdOpen && (
              <div className="panel-collapse-body">
                <pre className="panel-jd-text">{context.jd_markdown}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel-form-body">
        {/* Section 1 — Ratings */}
        <section className="panel-section">
          <h2 className="panel-section-title">1. Skill Ratings</h2>
          <p className="panel-section-sub">All 4 dimensions required.</p>

          {DIMENSIONS.map(dim => (
            <DimensionRating
              key={dim.key}
              dimension={dim}
              score={ratings[dim.key] || 0}
              note={ratingNotes[dim.key] || ''}
              onScore={(s) => setRatings(r => ({ ...r, [dim.key]: s }))}
              onNote={(n) => setRatingNotes(r => ({ ...r, [dim.key]: n }))}
            />
          ))}

          {allRated && (
            <div className="overall-score-preview">
              Overall Score: <strong>{overallScore.toFixed(2)} / 5.0</strong>
              <span className="overall-score-bar">
                <span style={{ width: `${(overallScore / 5) * 100}%` }} />
              </span>
            </div>
          )}
        </section>

        {/* Section 2 — Written feedback */}
        <section className="panel-section">
          <h2 className="panel-section-title">2. Written Feedback</h2>

          <div className="panel-form-group">
            <label>Strengths</label>
            <textarea
              className="panel-textarea"
              rows={3}
              placeholder="What did the candidate do well? (rough notes OK)"
              value={strengthsRaw}
              onChange={e => setStrengthsRaw(e.target.value)}
              disabled={useEnriched === true}
            />
          </div>

          <div className="panel-form-group">
            <label>Areas of Concern</label>
            <textarea
              className="panel-textarea"
              rows={3}
              placeholder="Any concerns or gaps? (rough notes OK)"
              value={concernsRaw}
              onChange={e => setConcernsRaw(e.target.value)}
              disabled={useEnriched === true}
            />
          </div>

          {!enriched && (
            <button
              className="enrich-btn"
              onClick={handleEnrich}
              disabled={enriching || (!strengthsRaw.trim() && !concernsRaw.trim())}
            >
              {enriching ? '✨ Enriching…' : '✨ AI Enrich — Make this more professional'}
            </button>
          )}

          {enriched && useEnriched === null && (
            <div className="enrich-preview">
              <div className="enrich-preview-header">─── Enriched Preview ───</div>
              <div className="panel-form-group">
                <label>Strengths (Enriched)</label>
                <div className="enrich-text">{strengthsEnriched}</div>
              </div>
              <div className="panel-form-group">
                <label>Areas of Concern (Enriched)</label>
                <div className="enrich-text">{concernsEnriched}</div>
              </div>
              <div className="enrich-actions">
                <button className="enrich-use-btn" onClick={() => setUseEnriched(true)}>
                  ✅ Use Enriched Version
                </button>
                <button className="enrich-keep-btn" onClick={() => setUseEnriched(false)}>
                  Keep My Original
                </button>
              </div>
            </div>
          )}

          {useEnriched === true && (
            <div className="enrich-accepted">
              ✅ Using enriched version.{' '}
              <button className="enrich-undo" onClick={() => setUseEnriched(null)}>Undo</button>
            </div>
          )}
        </section>

        {/* Section 3 — Recommendation */}
        <section className="panel-section">
          <h2 className="panel-section-title">3. Hiring Recommendation</h2>

          <div className="rec-grid">
            {RECOMMENDATIONS.map(r => (
              <button
                key={r.value}
                className={`rec-btn ${recommendation === r.value ? 'selected' : ''}`}
                onClick={() => setRecommendation(r.value)}
              >
                <span className="rec-emoji">{r.emoji}</span>
                <span className="rec-label">{r.label}</span>
              </button>
            ))}
          </div>

          <div className="panel-form-group" style={{ marginTop: 16 }}>
            <label>Additional Comments (optional)</label>
            <textarea
              className="panel-textarea"
              rows={2}
              placeholder="Any additional context for the hiring team"
              value={additionalComments}
              onChange={e => setAdditionalComments(e.target.value)}
            />
          </div>
        </section>

        {/* Section 4 — Submit */}
        <section className="panel-section panel-submit-section">
          <div className="submit-summary">
            <div>
              <span className="submit-summary-label">Overall Score</span>
              <span className="submit-summary-value">{allRated ? `${overallScore.toFixed(2)} / 5.0` : '—'}</span>
            </div>
            <div>
              <span className="submit-summary-label">Recommendation</span>
              <span className="submit-summary-value">
                {recommendation
                  ? `${RECOMMENDATIONS.find(r => r.value === recommendation)?.emoji || ''} ${RECOMMENDATIONS.find(r => r.value === recommendation)?.label || ''}`
                  : '—'}
              </span>
            </div>
          </div>

          <p className="submit-disclaimer">
            By submitting, you confirm this is your independent assessment based on the interview conducted.
          </p>

          {error && <div className="panel-error">{error}</div>}

          <div className="submit-actions">
            <button
              className="submit-draft-btn"
              onClick={handleSaveDraft}
              disabled={savingDraft || submitting}
            >
              {savingDraft ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              className="submit-final-btn"
              onClick={handleSubmit}
              disabled={submitting || savingDraft}
            >
              {submitting ? 'Submitting…' : '✅ Submit Feedback'}
            </button>
          </div>
        </section>
      </div>

      {/* Confirm dialog */}
      {confirmDialog && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h3>Submit Feedback?</h3>
            <p>Once submitted, feedback cannot be edited. Are you sure?</p>
            <div className="confirm-actions">
              <button className="sim-btn-cancel" onClick={() => setConfirmDialog(false)}>Cancel</button>
              <button className="submit-final-btn" onClick={confirmSubmit}>Yes, Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DimensionRating({ dimension, score, note, onScore, onNote }) {
  return (
    <div className="dimension-card">
      <div className="dim-header">
        <div>
          <div className="dim-label">{dimension.label}</div>
          <div className="dim-desc">{dimension.desc}</div>
        </div>
        {score > 0 && <div className="dim-score-badge">{score}/5</div>}
      </div>
      <div className="dim-stars">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            className={`star-btn ${s <= score ? 'filled' : ''}`}
            onClick={() => onScore(s === score ? 0 : s)}
            aria-label={`${s} stars`}
          >
            {s <= score ? '★' : '☆'}
          </button>
        ))}
      </div>
      <input
        type="text"
        className="dim-note-input"
        placeholder="Brief note (optional)"
        value={note}
        onChange={e => onNote(e.target.value)}
      />
    </div>
  )
}

function PanelHeader({ org }) {
  return (
    <header className="panel-header">
      <span className="panel-org-name">{org}</span>
      <span className="panel-header-sub">Interview Feedback · Powered by AI Talent Lab</span>
    </header>
  )
}

function PanelStateLoading() {
  return (
    <div className="panel-state-page">
      <div className="apply-spinner" />
      <p>Verifying your feedback link…</p>
    </div>
  )
}

function PanelStateExpired({ context }) {
  return (
    <div className="panel-state-page">
      <div style={{ fontSize: '3rem' }}>⏰</div>
      <h2>This link has expired</h2>
      <p>Feedback links are valid for 7 days. Contact the hiring team for assistance.</p>
    </div>
  )
}

function PanelStateSubmitted({ context }) {
  return (
    <div className="panel-state-page">
      <div style={{ fontSize: '3rem' }}>✅</div>
      <h2>Feedback Already Submitted</h2>
      <p>You have already submitted feedback for this interview.</p>
      <p>Thank you!</p>
    </div>
  )
}

function PanelStateNotAttended() {
  return (
    <div className="panel-state-page">
      <div style={{ fontSize: '3rem' }}>📋</div>
      <h2>Noted — Not Attended</h2>
      <p>Your non-attendance has been recorded. No further action needed.</p>
    </div>
  )
}

function PanelStateSuccess({ overallScore, recommendation, context }) {
  const rec = RECOMMENDATIONS.find(r => r.value === recommendation)
  return (
    <div className="panel-state-page">
      <div style={{ fontSize: '3rem' }}>🎉</div>
      <h2>Feedback Submitted!</h2>
      <p>Thank you for assessing {context?.candidate_name || 'the candidate'}.</p>
      <div className="success-summary">
        <div><span>Score:</span> <strong>{overallScore.toFixed(2)} / 5.0</strong></div>
        {rec && <div><span>Recommendation:</span> <strong>{rec.emoji} {rec.label}</strong></div>}
      </div>
    </div>
  )
}
