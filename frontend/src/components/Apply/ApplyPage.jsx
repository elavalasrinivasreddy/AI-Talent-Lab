/**
 * ApplyPage.jsx – Candidate magic-link chat application page
 * Route: /apply/:token (public, no auth)
 * Per docs/design/pages/10_apply_chat.md — mobile-first, chat interface
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import './ApplyPage.css'

const API_BASE = '/api/v1/apply'

export default function ApplyPage() {
  const { token } = useParams()
  const [pageState, setPageState] = useState('loading') // loading | consent | valid | expired | completed | declined
  const [context, setContext] = useState(null)
  const [messages, setMessages] = useState([])
  const [step, setStep] = useState('greeting')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [jdOpen, setJdOpen] = useState(false)
  const [uploadState, setUploadState] = useState('idle') // idle | uploading | done | error
  const [videoState, setVideoState] = useState('idle')   // idle | uploading | done | skipped | error
  const videoInputRef = useRef(null)
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

      // Restore previous messages — skip consent screen if already consented
      if (data.messages?.length > 0) {
        setMessages(data.messages)
        const lastState = data.session_state || {}
        setStep(lastState.step || 'interest')
        setPageState('valid')
      } else if (data.consent_given) {
        // Already consented in a previous session
        setPageState('valid')
        await sendFirstGreeting()
      } else {
        // Show consent screen before starting the chat
        setPageState('consent')
      }
    } catch (e) {
      setPageState('invalid')
    }
  }

  const handleConsent = async (agreed) => {
    if (!agreed) {
      setPageState('declined')
      return
    }
    try {
      await fetch(`${API_BASE}/${token}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consented: true }),
      })
    } catch {
      // Non-fatal — consent is best-effort; proceed regardless
    }
    setPageState('valid')
    await sendFirstGreeting()
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

  const handleVideoUpload = async (file) => {
    if (!file) return
    setVideoState('uploading')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/${token}/upload-video`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data?.detail?.message || 'Upload failed. Please try again or skip.' }])
        setVideoState('error')
        return
      }
      setVideoState('done')
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      setStep(data.step || 'completion')
    } catch {
      setVideoState('error')
      setMessages(prev => [...prev, { role: 'assistant', content: 'Upload failed. You can skip the video and continue.' }])
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

  if (pageState === 'consent') {
    return <ConsentScreen context={context} onConsent={handleConsent} />
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

      {/* ── Progress Bar ── */}
      <ApplyProgress step={step} />

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

        {/* Video intro upload (optional) */}
        {step === 'video_intro' && videoState === 'idle' && (
          <div className="apply-resume-upload">
            <input
              type="file"
              ref={videoInputRef}
              accept="video/*"
              style={{ display: 'none' }}
              onChange={e => handleVideoUpload(e.target.files[0])}
            />
            <button className="apply-upload-btn" onClick={() => videoInputRef.current?.click()}>
              📹 Upload Video Intro (MP4 · Max 100 MB)
            </button>
            <button
              className="apply-upload-btn"
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', marginTop: 6 }}
              onClick={() => { setVideoState('skipped'); sendMessage('Skip video intro') }}
            >
              Skip — I'll pass on the video
            </button>
          </div>
        )}
        {step === 'video_intro' && videoState === 'uploading' && (
          <div className="apply-resume-upload">
            <button className="apply-upload-btn" disabled>⏳ Uploading video…</button>
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
        <span>Powered by AI Talent Lab · AI-assisted hiring</span>
        <a href="/delete-my-data" target="_blank" rel="noopener">Privacy & Data Deletion</a>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

const APPLY_STEPS = [
  { id: 'greeting', label: 'Welcome' },
  { id: 'interest', label: 'Interest' },
  { id: 'current_role', label: 'Questions' },
  { id: 'experience', label: 'Questions' },
  { id: 'notice_period', label: 'Questions' },
  { id: 'screening_q', label: 'Questions' },
  { id: 'resume_upload', label: 'Resume' },
  { id: 'confirmation', label: 'Review' },
  { id: 'completion', label: 'Complete' },
]

const PROGRESS_LABELS = ['Welcome', 'Interest', 'Questions', 'Resume', 'Review', 'Complete']

function ApplyProgress({ step }) {
  // Map current step to progress index
  const stepObj = APPLY_STEPS.find(s => s.id === step)
  const currentLabel = stepObj?.label || 'Welcome'
  const currentIdx = PROGRESS_LABELS.indexOf(currentLabel)
  const progress = currentIdx >= 0 ? currentIdx : 0

  return (
    <div className="apply-progress">
      {PROGRESS_LABELS.map((label, idx) => (
        <div
          key={label}
          className={`apply-progress-step ${idx <= progress ? 'active' : ''} ${idx === progress ? 'current' : ''}`}
        >
          <div className="apply-progress-dot">
            {idx < progress ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <span>{idx + 1}</span>
            )}
          </div>
          <span className="apply-progress-label">{label}</span>
          {idx < PROGRESS_LABELS.length - 1 && <div className="apply-progress-line" />}
        </div>
      ))}
    </div>
  )
}

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

function ConsentScreen({ context, onConsent }) {
  const org = context?.org || {}
  const pos = context?.position || {}
  return (
    <div className="apply-page apply-consent-page">
      <header className="apply-header">
        <div className="apply-logo">
          {org.logo_url
            ? <img src={org.logo_url} alt={org.name} className="apply-logo-img" />
            : <span className="apply-logo-fallback">{(org.name || 'A')[0]}</span>
          }
          <span className="apply-org-name">{org.name}</span>
        </div>
        <span className="apply-powered">Powered by AI Talent Lab</span>
      </header>

      <div className="apply-consent-card">
        <div className="apply-consent-icon">🔒</div>
        <h2 className="apply-consent-title">Before we start</h2>
        <p className="apply-consent-role">
          Applying for <strong>{pos.role_name}</strong> at <strong>{org.name}</strong>
        </p>

        <div className="apply-consent-body">
          <p>To process your application, we need your consent to:</p>
          <ul className="apply-consent-list">
            <li>✓ Store and use the information you share during this chat</li>
            <li>✓ Use AI to match your skills with this role's requirements</li>
            <li>✓ Contact you about this application and relevant future opportunities</li>
          </ul>
          <p className="apply-consent-note">
            Your data is stored securely and not shared with third parties.
            All final hiring decisions are made by humans. You can request deletion
            of your data at any time via the link in any email we send you.
          </p>
        </div>

        <div className="apply-consent-ai-notice">
          🤖 This hiring process uses AI to match candidates with roles. All decisions are made by humans.
        </div>

        <div className="apply-consent-actions">
          <button className="apply-consent-agree" onClick={() => onConsent(true)}>
            I Agree &amp; Continue
          </button>
          <button className="apply-consent-decline" onClick={() => onConsent(false)}>
            No Thanks
          </button>
        </div>

        <p className="apply-consent-privacy">
          <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>
          {' · '}
          <a href="/delete-my-data" target="_blank" rel="noopener">Data Rights</a>
        </p>
      </div>
    </div>
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
