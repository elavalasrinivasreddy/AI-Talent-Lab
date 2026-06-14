/**
 * AskBar — persistent natural-language assistant docked on the right of the Explore tab.
 * Describe a chart in plain English; the backend (LLM constrained to the catalog, validated
 * by the query engine) returns a ready widget (added like a manual one) or a follow-up question.
 */
import { useEffect, useRef, useState } from 'react'
import { analyticsApi } from '../../../utils/api'

export default function AskBar({ onCreate }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])   // {role:'user'|'bot', text}
  const [history, setHistory] = useState([])      // backend conversation context
  const [busy, setBusy] = useState(false)
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages, busy])

  const send = async () => {
    const q = input.trim()
    if (!q || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: q }])
    const nextHistory = [...history, { role: 'user', content: q }]
    setHistory(nextHistory)
    setBusy(true)
    try {
      const res = await analyticsApi.nlWidget(q, nextHistory)
      if (res.action === 'create' && res.widget) {
        onCreate(res.widget)
        setMessages((m) => [...m, { role: 'bot', text: `✓ Added "${res.widget.title}". Hit Save to keep it.` }])
        setHistory((h) => [...h, { role: 'assistant', content: `created widget "${res.widget.title}"` }])
      } else if (res.action === 'clarify') {
        setMessages((m) => [...m, { role: 'bot', text: res.question }])
        setHistory((h) => [...h, { role: 'assistant', content: res.question }])
      } else {
        setMessages((m) => [...m, { role: 'bot', text: res.message || 'Sorry — I could not build that.' }])
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'bot', text: e.message || 'Request failed.' }])
    } finally {
      setBusy(false)
    }
  }

  const examples = [
    'Hires by department this quarter',
    'Application trend over time',
    'Match score distribution',
  ]

  return (
    <div className="exp-ask-panel">
      <div className="exp-ask-header">
        <span className="exp-ask-spark" aria-hidden>✦</span> Ask AI
      </div>

      <div className="exp-ask-log" ref={logRef}>
        {messages.length === 0 ? (
          <div className="exp-ask-intro">
            <p>Describe a chart in plain English and I'll build it from your data.</p>
            <div className="exp-ask-examples">
              {examples.map((ex) => (
                <button key={ex} type="button" className="exp-ask-chip"
                  onClick={() => setInput(ex)}>{ex}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`exp-ask-msg exp-ask-${m.role}`}>{m.text}</div>
          ))
        )}
        {busy && <div className="exp-ask-msg exp-ask-bot exp-ask-thinking">Thinking…</div>}
      </div>

      <div className="exp-ask-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          placeholder="Ask for a chart…"
        />
        <button type="button" className="exp-btn-primary" onClick={send} disabled={busy}>Send</button>
      </div>
    </div>
  )
}
