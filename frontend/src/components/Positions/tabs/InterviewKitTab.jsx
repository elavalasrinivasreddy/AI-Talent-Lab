/**
 * InterviewKitTab.jsx – AI-generated interview questions + scorecard template
 * Used in PositionDetailPage tabs
 * Per docs/pages/09_career_page.md §Interview Kit
 */
import React, { useState, useEffect } from 'react'
import './InterviewKitTab.css'

const API = '/api/v1'

function authHeader() {
  const t = localStorage.getItem('token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const TYPE_ICONS = {
  technical: '⚙️',
  behavioral: '💬',
  situational: '🎯',
  culture: '🌱',
  motivation: '🔥',
  problem_solving: '🧩',
}

const DIFFICULTY_COLORS = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
}

export default function InterviewKitTab({ positionId }) {
  const [kit, setKit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [expandedQ, setExpandedQ] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadKit()
  }, [positionId])

  const loadKit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/positions/${positionId}/interview-kit`, {
        headers: authHeader(),
      })
      if (res.status === 404) {
        setKit(null) // Not yet generated
      } else if (!res.ok) {
        throw new Error('Failed to load')
      } else {
        const data = await res.json()
        setKit(data)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch(`${API}/positions/${positionId}/interview-kit/generate`, {
        method: 'POST',
        headers: authHeader(),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setKit(data)
    } catch (e) {
      setError('AI generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyAll = async () => {
    if (!kit?.questions) return
    const text = kit.questions
      .map((q, i) => `Q${i + 1}. ${q.question}\nType: ${q.type} | Difficulty: ${q.difficulty}\nLook for: ${q.what_to_look_for}`)
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <KitSkeleton />

  if (!kit) {
    return (
      <div className="ik-empty">
        <div className="ik-empty-icon">🎯</div>
        <h3>No Interview Kit Yet</h3>
        <p>AI will generate 8–10 tailored questions with scoring guides based on the job description.</p>
        <button className="ik-generate-btn" onClick={handleGenerate} disabled={generating}>
          {generating ? <><span className="ik-spinner" /> Generating…</> : '✨ Generate Interview Kit'}
        </button>
        {error && <div className="ik-error">{error}</div>}
      </div>
    )
  }

  const questions = Array.isArray(kit.questions) ? kit.questions : []
  const scorecard = Array.isArray(kit.scorecard_template) ? kit.scorecard_template : []

  const byType = {}
  for (const q of questions) {
    const t = q.type || 'general'
    if (!byType[t]) byType[t] = []
    byType[t].push(q)
  }

  return (
    <div className="ik-tab">
      {/* Header */}
      <div className="ik-header">
        <div>
          <h3 className="ik-title">🎯 Interview Kit</h3>
          <p className="ik-sub">{questions.length} questions · {scorecard.length} scorecard dimensions</p>
        </div>
        <div className="ik-header-actions">
          <button className="ik-copy-btn" onClick={handleCopyAll} disabled={copied}>
            {copied ? '✅ Copied!' : '📋 Copy All Questions'}
          </button>
          <button className="ik-regen-btn" onClick={handleGenerate} disabled={generating}>
            {generating ? '⏳' : '↺ Regenerate'}
          </button>
        </div>
      </div>

      {error && <div className="ik-error">{error}</div>}

      {/* Questions by type */}
      <div className="ik-sections">
        {Object.entries(byType).map(([type, qs]) => (
          <div key={type} className="ik-type-group">
            <h4 className="ik-type-label">
              {TYPE_ICONS[type] || '❓'} {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              <span className="ik-type-count">{qs.length}</span>
            </h4>
            {qs.map((q, idx) => {
              const qId = `${type}-${idx}`
              const isExpanded = expandedQ === qId
              return (
                <div
                  key={idx}
                  className={`ik-question-card ${isExpanded ? 'expanded' : ''}`}
                >
                  <div className="ik-question-header" onClick={() => setExpandedQ(isExpanded ? null : qId)}>
                    <div className="ik-question-num">{questions.indexOf(q) + 1}</div>
                    <div className="ik-question-text">{q.question}</div>
                    <div className="ik-question-meta">
                      <span
                        className="ik-difficulty"
                        style={{ color: DIFFICULTY_COLORS[q.difficulty] || '#94a3b8' }}
                      >
                        {q.difficulty}
                      </span>
                      <span className="ik-expand-icon">{isExpanded ? '▲' : '▾'}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="ik-question-body">
                      <div className="ik-look-for">
                        <span className="ik-look-label">Look for:</span>
                        <p>{q.what_to_look_for}</p>
                      </div>
                      {q.follow_ups?.length > 0 && (
                        <div className="ik-follow-ups">
                          <span className="ik-follow-label">Follow-up questions:</span>
                          <ul>
                            {q.follow_ups.map((fu, fi) => (
                              <li key={fi}>{fu}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Scorecard Template */}
      {scorecard.length > 0 && (
        <div className="ik-scorecard">
          <h4 className="ik-scorecard-title">📊 Scorecard Template</h4>
          <div className="ik-scorecard-grid">
            {scorecard.map((dim, i) => (
              <div key={i} className="ik-scorecard-dim">
                <div className="ik-dim-name">{dim.dimension}</div>
                <div className="ik-dim-desc">{dim.description}</div>
                <div className="ik-rating-scale">
                  {dim.rating_scale?.map((r, ri) => (
                    <span key={ri} className={`ik-rating-pill ik-r${ri + 1}`}>{r.split(' - ')[0]}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {kit.generated_at && (
        <p className="ik-generated-at">
          Generated {new Date(kit.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {kit.regenerated_count > 0 && ` · regenerated ${kit.regenerated_count}×`}
        </p>
      )}
    </div>
  )
}

function KitSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton-block" style={{ height: 72, borderRadius: 10 }} />
      ))}
    </div>
  )
}
