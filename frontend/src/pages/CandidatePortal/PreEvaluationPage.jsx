import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { preEvaluationsApi } from '../../utils/api'

/**
 * Public pre-evaluation page. Candidate opens /pre-evaluations/:token (from the
 * portal or an email), answers the written test, and submits. Token-authenticated
 * — no login required. Backend: GET /pre-evaluations/:token, POST /submit.
 */
const TEAL = '#0D9488'

export default function PreEvaluationPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await preEvaluationsApi.getByToken(token)
        if (!active) return
        const qs = res?.evaluation?.questions || []
        setQuestions(Array.isArray(qs) ? qs : [])
      } catch (e) {
        if (active) setError(e?.message || 'This assessment link is invalid, expired, or already submitted.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [token])

  const qid = (q, i) => q.question_id ?? q.id ?? String(i)
  const qtext = (q) => q.question || q.text || q.prompt || q.label || 'Question'

  const allAnswered = questions.length > 0 && questions.every((q, i) => (answers[qid(q, i)] || '').trim().length > 0)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload = questions.map((q, i) => ({
        question_id: String(qid(q, i)),
        answer: answers[qid(q, i)] || '',
      }))
      await preEvaluationsApi.submit({ token, answers: payload })
      setDone(true)
    } catch (e) {
      setError(e?.message || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const wrap = { maxWidth: 720, margin: '0 auto', padding: '32px 20px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#1E293B' }

  if (loading) return <div style={wrap}><p style={{ color: '#64748B' }}>Loading your assessment…</p></div>

  if (done) return (
    <div style={wrap}>
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 44 }}>✅</div>
        <h1 style={{ fontSize: 22, margin: '12px 0 8px' }}>Assessment submitted</h1>
        <p style={{ color: '#64748B' }}>Thanks! Your responses are in. The hiring team will review them and you'll be notified of next steps.</p>
      </div>
    </div>
  )

  if (error && questions.length === 0) return (
    <div style={wrap}>
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h1 style={{ fontSize: 20, margin: '12px 0 8px' }}>Can't open this assessment</h1>
        <p style={{ color: '#64748B' }}>{error}</p>
      </div>
    </div>
  )

  return (
    <div style={wrap}>
      <header style={{ borderBottom: `2px solid ${TEAL}`, paddingBottom: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Written Assessment</h1>
        <p style={{ color: '#64748B', margin: '6px 0 0', fontSize: 14 }}>
          Answer each question in your own words. Your responses are reviewed by the hiring team. Submit once — you can't edit after submitting.
        </p>
      </header>

      {questions.map((q, i) => (
        <div key={qid(q, i)} style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
            {i + 1}. {qtext(q)}
          </label>
          <textarea
            value={answers[qid(q, i)] || ''}
            onChange={(e) => setAnswers(a => ({ ...a, [qid(q, i)]: e.target.value }))}
            rows={5}
            placeholder="Type your answer…"
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      ))}

      {error && <p style={{ color: '#EF4444', fontSize: 13 }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        style={{
          marginTop: 8, padding: '12px 24px', borderRadius: 8, border: 'none',
          background: allAnswered && !submitting ? TEAL : '#94A3B8',
          color: '#fff', fontWeight: 700, fontSize: 15,
          cursor: allAnswered && !submitting ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? 'Submitting…' : 'Submit Assessment'}
      </button>
      {!allAnswered && questions.length > 0 && (
        <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 8 }}>Please answer all questions before submitting.</p>
      )}
    </div>
  )
}
