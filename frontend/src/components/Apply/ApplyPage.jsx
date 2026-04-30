/**
 * ApplyPage.jsx – Candidate magic-link chat application page
 * Route: /apply/:token (public, no auth)
 * Per docs/pages/07_apply.md — mobile-first, chat interface
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import './ApplyPage.css'

const API_BASE = '/api/v1/apply'

export default function ApplyPage() {
  const { token } = useParams()
  const [pageState, setPageState] = useState('loading') // loading | valid | expired | completed | declined
  const [context, setContext] = useState(null)
  const [messages, setMessages] = useState([])
  const [step, setStep] = useState('greeting')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [jdOpen, setJdOpen] = useState(false)
  const [uploadState, setUploadState] = useState('idle') // idle | uploading | done | error
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // ── Load context on mount ──────────────────────────────────────────────────
  useEffect(() => {
    loadContext()
  }, [token])

  const loadContext = async () => {
    try {
      const res = await fetch(`${API_BASE}/${token}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const code = err?.detail?.code || err?.code || ''
        setPageState(code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid')
        return
      }
      const data = await res.json()
      if (!data.valid) {
        setPageState('expired')
        return
      }
      if (data.already_completed) {
        setPageState('completed')
        setContext(data)
        return
      }
      setContext(data)

      // Restore previous messages
      if (data.messages?.length > 0) {
        setMessages(data.messages)
        const lastState = data.session_state || {}
        setStep(lastState.step || 'interest')
        setPageState('valid')
      } else {
        setPageState('valid')
        // Send initial greeting automatically
        await sendFirstGreeting()
      }
    } catch (e) {
      setPageState('invalid')
    }
  }

  const sendFirstGreeting = async () => {
    try {
      const res = await fetch(`${API_BASE}/${token}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '__init__' }),
      })
      const data = await res.json()
      if (data.response) {
        setMessages([{ role: 'assistant', content: data.response }])
        setStep(data.step || 'interest')
      }
    } catch (e) {
      setMessages([{ role: 'assistant', content: 'Welcome! Type your reply below to start your application.' }])
    }
  }

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || sending || step === 'completion' || step === 'declined') return

    const userMsg = text.trim()
    setInput('')
    setSending(true)

    setMessages(prev => [...prev, { role: 'user', content: userMsg }])

    try {
      const res = await fetch(`${API_BASE}/${token}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      })
      const data = await res.json()

      if (data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
        setStep(data.step || step)
      }
      if (data.completed) setPageState('completed')
      if (data.not_interested) setStep('declined')
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong on our end. Please refresh the page and we\'ll pick up where we left off.'
      }])
    } finally {
      setSending(false)
    }
  }, [token, sending, step])

  // ── Upload resume ──────────────────────────────────────────────────────────
  const handleFileUpload = async (file) => {
    if (!file) return
    setUploadState('uploading')
    setMessages(prev => [...prev, { role: 'user', content: `📎 Uploading ${file.name}…` }])

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/${token}/upload-resume`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = err?.detail?.message || 'Upload failed. Please try again.'
        setMessages(prev => [...prev, { role: 'assistant', content: msg }])
        setUploadState('error')
        return
      }
      const data = await res.json()
      setUploadState('done')
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      setStep(data.step || step)
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'It seems there was an issue uploading that file. Could you try again?'
      }])
      setUploadState('error')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ── Page states ────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return <LoadingState />
  }

  if (pageState === 'expired' || pageState === 'invalid') {
    return <ExpiredState context={context} />
  }

  if (pageState === 'completed') {
    return <CompletedState context={context} />
  }

  const pos = context?.position || {}
  const org = context?.org || {}
  const candidate = context?.candidate || {}
  const isInputDisabled = step === 'completion' || step === 'declined' || sending
  const showResumeUpload = step === 'resume_upload'

  return (
    <div className="apply-page">
      {/* ── Header ── */}
      <header className="apply-header">
        <div className="apply-logo">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="apply-logo-img" />
          ) : (
            <span className="apply-logo-fallback">{(org.name || 'A')[0]}</span>
          )}
          <span className="apply-org-name">{org.name}</span>
        </div>
        <span className="apply-powered">Powered by AI Talent Lab</span>
      </header>

      {/* ── Position strip ── */}
      <div className="apply-position-strip">
        <div className="apply-position-info">
          <span>💼 {pos.role_name}</span>
          {pos.location && <span>📍 {pos.location}</span>}
          {pos.work_type && (
            <span className="apply-work-type">{pos.work_type.replace('_', '-')}</span>
          )}
        </div>
        {context?.jd_markdown && (
          <button
            className="apply-jd-toggle"
            onClick={() => setJdOpen(p => !p)}
          >
            {jdOpen ? 'Collapse ▲' : 'View Full JD ▾'}
          </button>
        )}
      </div>

      {/* ── JD Panel ── */}
      {jdOpen && context?.jd_markdown && (
        <div className="apply-jd-panel">
          {org.about_us && (
            <div className="apply-jd-section">
              <h4>About {org.name}</h4>
              <p>{org.about_us}</p>
            </div>
          )}
          <div className="apply-jd-section">
            <h4>{pos.role_name}</h4>
            <pre className="apply-jd-content">{context.jd_markdown}</pre>
          </div>
        </div>
      )}

      {/* ── Chat Messages ── */}
      <div className="apply-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`apply-msg apply-msg-${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="apply-msg-avatar">🤖</div>
            )}
            <div className="apply-msg-bubble">
              <MessageContent content={msg.content} />
            </div>
            {msg.role === 'user' && (
              <div className="apply-msg-avatar apply-msg-avatar-user">
                {(candidate.name || 'U')[0]}
              </div>
            )}
          </div>
        ))}

        {/* Quick reply buttons based on step */}
        {step === 'interest' && !sending && (
          <div className="apply-quick-replies">
            <button className="apply-quick-btn primary" onClick={() => sendMessage("Yes, I'm interested!")}>
              ✅ Yes, I'm interested!
            </button>
            <button className="apply-quick-btn" onClick={() => sendMessage('No, thanks')}>
              No, thanks
            </button>
          </div>
        )}

        {step === 'current_role' && context?.candidate?.current_title && !sending && (
          <div className="apply-quick-replies">
            <button className="apply-quick-btn primary" onClick={() => sendMessage("Yes, that's correct")}>
              ✅ Yes, that's correct
            </button>
            <button className="apply-quick-btn" onClick={() => sendMessage('No, let me update')}>
              No, let me update
            </button>
          </div>
        )}

        {step === 'notice_period' && !sending && (
          <div className="apply-quick-replies">
            {['Immediate', '15 days', '30 days', '60 days', '90+ days'].map(opt => (
              <button key={opt} className="apply-quick-btn" onClick={() => sendMessage(opt)}>
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Resume upload */}
        {showResumeUpload && uploadState !== 'done' && (
          <div className="apply-resume-upload">
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.docx,.doc,.txt"
              style={{ display: 'none' }}
              onChange={e => handleFileUpload(e.target.files[0])}
            />
            <button
              className="apply-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadState === 'uploading'}
            >
              {uploadState === 'uploading' ? '⏳ Uploading…' : '📎 Upload Resume (PDF or DOCX · Max 5MB)'}
            </button>
            {uploadState === 'error' && (
              <p className="apply-upload-error">Upload failed. Please try again.</p>
            )}
          </div>
        )}

        {sending && (
          <div className="apply-typing">
            <div className="apply-typing-dots">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="apply-input-area">
        <textarea
          className="apply-input"
          placeholder={isInputDisabled ? '' : 'Type your reply…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isInputDisabled}
          rows={1}
        />
        <button
          className="apply-send-btn"
          onClick={() => sendMessage(input)}
          disabled={isInputDisabled || !input.trim()}
        >
          Send
        </button>
      </div>
      <div className="apply-footer">
        Powered by AI Talent Lab · Your data is safe and secure
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MessageContent({ content }) {
  // Render markdown-like bold (**text**) and newlines
  const parts = (content || '').split('\n')
  return (
    <>
      {parts.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          <BoldText text={line} />
        </React.Fragment>
      ))}
    </>
  )
}

function BoldText({ text }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
      )}
    </>
  )
}

function LoadingState() {
  return (
    <div className="apply-state-page">
      <div className="apply-spinner" />
      <p>Verifying your application link…</p>
    </div>
  )
}

function ExpiredState({ context }) {
  const org = context?.org || {}
  return (
    <div className="apply-state-page">
      <div className="apply-state-icon">⏰</div>
      <h2>This link has expired</h2>
      <p>Application links are valid for 72 hours.</p>
      {org.hiring_contact_email && (
        <p>Please contact the recruiter at <a href={`mailto:${org.hiring_contact_email}`}>{org.hiring_contact_email}</a> for a new link.</p>
      )}
    </div>
  )
}

function CompletedState({ context }) {
  const pos = context?.position || {}
  const org = context?.org || {}
  return (
    <div className="apply-state-page">
      <div className="apply-state-icon">✅</div>
      <h2>You've Already Applied!</h2>
      <p>You submitted your application for <strong>{pos.role_name}</strong> at <strong>{org.name}</strong>.</p>
      <p>The team will review it and reach out with next steps.</p>
      <p>Good luck! 🍀</p>
    </div>
  )
}
