/**
 * InterviewKitTab.jsx – AI-generated interview kit with Q&A and scorecard.
 */
import React, { useState, useEffect } from 'react'
import { positionsApi } from '../../../utils/api'
import './InterviewKitTab.css'

export default function InterviewKitTab({ positionId }) {
  const [kit, setKit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const load = async () => {
    try {
      const data = await positionsApi.getInterviewKit(positionId)
      setKit(data)
    } catch (e) {
      if (e.status !== 404) console.error(e)
      setKit(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [positionId])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const data = await positionsApi.generateInterviewKit(positionId)
      setKit(data)
    } catch (e) {
      alert(`Generation failed: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="kit-skeleton"><div className="skeleton-block" style={{ height: 400, borderRadius: 12 }} /></div>

  if (!kit) {
    return (
      <div className="kit-empty">
        <span>🎯</span>
        <h3>No Interview Kit Generated</h3>
        <p>Generate an AI interview kit based on the JD for this position.</p>
        <button className="kit-btn primary" onClick={handleGenerate} disabled={generating}>
          {generating ? '⏳ Generating…' : '✨ Generate Interview Kit'}
        </button>
      </div>
    )
  }

  const questions = Array.isArray(kit.questions) ? kit.questions : []

  return (
    <div className="kit-tab">
      <div className="kit-header">
        <h3 className="kit-title">🎯 Interview Kit</h3>
        <button className="kit-btn" onClick={handleGenerate} disabled={generating}>
          {generating ? '⏳ Regenerating…' : '🔄 Regenerate'}
        </button>
      </div>

      {questions.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No questions available.</p>
      ) : (
        <div className="kit-questions">
          {questions.map((q, idx) => (
            <div key={idx} className="kit-question">
              <div className="kit-q-header">
                <span className="kit-q-num">Q{idx + 1}</span>
                {q.type && <span className="kit-q-type">{q.type}</span>}
                {q.difficulty && <span className="kit-q-diff">{q.difficulty}</span>}
              </div>
              <div className="kit-q-text">{q.question}</div>
              {q.what_to_look_for && (
                <div className="kit-q-hint">
                  <strong>What to look for:</strong> {q.what_to_look_for}
                </div>
              )}
              {q.follow_ups?.length > 0 && (
                <div className="kit-q-followups">
                  <strong>Follow-ups:</strong>
                  <ul>
                    {q.follow_ups.map((fu, i) => <li key={i}>{fu}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
