/**
 * CandidateStatusPage.jsx – Public candidate application status portal
 * Route: /status/:token (public, no auth)
 * Shows application status, interview schedule, timeline, and transparency link.
 */
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import './CandidateStatusPage.css'

const STATUS_STEPS = ['Application Received', 'Under Review', 'Interview Stage', 'Offer Stage', 'Hired']

export default function CandidateStatusPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/status/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Application not found. The link may be invalid.')
        return res.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [token])

  if (loading) return (
    <div className="cs-page">
      <div className="cs-card">
        <div className="cs-skel cs-skel--title" />
        <div className="cs-skel cs-skel--text" />
        <div className="cs-skel cs-skel--text cs-skel--short" />
        <div className="cs-skel cs-skel--bar" />
        <div className="cs-skel cs-skel--bar cs-skel--short" />
      </div>
    </div>
  )

  if (error) return (
    <div className="cs-page">
      <span className="cs-error-icon">⚠️</span>
      <h2>Unable to load status</h2>
      <p>{error}</p>
    </div>
  )

  const currentStepIdx = STATUS_STEPS.indexOf(data.status)
  const rejected = data.internal_status === 'rejected'
  const pct = rejected ? 0 : Math.round(((currentStepIdx + 1) / STATUS_STEPS.length) * 100)

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for browsers that block clipboard without HTTPS
      const input = document.createElement('input')
      input.value = window.location.href
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="cs-page">
      <div className="cs-card">
        {/* Header */}
        <div className="cs-header">
          <div className="cs-header-top">
            <div>
              <h1 className="cs-role">{data.position?.role_name}</h1>
              <p className="cs-org">{data.org_name}</p>
            </div>
            <button className="status-share-btn" onClick={handleShare}>
              {copied ? '✓ Copied!' : '🔗 Share Status'}
            </button>
          </div>
          <div className="cs-meta">
            {data.position?.location && <span>📍 {data.position.location}</span>}
            {data.position?.work_type && <span>🏢 {data.position.work_type}</span>}
            {data.applied_at && <span>📅 Applied {new Date(data.applied_at).toLocaleDateString()}</span>}
          </div>
        </div>

        {/* Status Banner */}
        <div className={`cs-status-banner ${rejected ? 'cs-status-rejected' : ''}`}>
          <span className="cs-status-label">Application Status</span>
          <span className="cs-status-value">{rejected ? 'Not Selected' : data.status}</span>
        </div>

        {/* Progress Bar */}
        {!rejected && (
          <>
            <div className="cs-progress-bar">
              <div className="cs-progress-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="cs-progress">
              {STATUS_STEPS.map((step, idx) => (
                <div
                  key={step}
                  className={`cs-step ${idx <= currentStepIdx ? 'active' : ''} ${idx === currentStepIdx ? 'current' : ''}`}
                >
                  <div className="cs-step-dot">
                    {idx < currentStepIdx ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <span className="cs-step-label">{step}</span>
                  {idx < STATUS_STEPS.length - 1 && <div className="cs-step-line" />}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Interviews */}
        {data.interviews && data.interviews.length > 0 && (
          <div className="cs-interviews">
            <h3 className="cs-section-title">📅 Interview Schedule</h3>
            {data.interviews.map((iv, idx) => (
              <div key={idx} className="cs-interview-card">
                <div className="cs-iv-header">
                  <span className="cs-iv-round">{iv.round}</span>
                  <span className={`cs-iv-status cs-iv-${iv.status}`}>
                    {iv.status === 'completed' ? '✅ Completed' :
                      iv.status === 'scheduled' ? '🗓 Scheduled' :
                        iv.status === 'cancelled' ? '❌ Cancelled' : '⏳ Pending'}
                  </span>
                </div>
                {iv.scheduled_at && (
                  <p className="cs-iv-time">
                    {new Date(iv.scheduled_at).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                    })} at {new Date(iv.scheduled_at).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                    {iv.duration_minutes && ` · ${iv.duration_minutes} min`}
                  </p>
                )}
                <p className="cs-iv-type">{iv.type}</p>
              </div>
            ))}
          </div>
        )}

        {/* Timeline */}
        {data.timeline && data.timeline.length > 0 && (
          <div className="cs-timeline">
            <h3 className="cs-section-title">📋 Application Timeline</h3>
            <div className="cs-timeline-list">
              {data.timeline.map((evt, idx) => (
                <div key={idx} className="cs-timeline-item">
                  <div className="cs-timeline-dot" />
                  <div className="cs-timeline-body">
                    <span className="cs-timeline-event">{evt.event}</span>
                    <span className="cs-timeline-date">
                      {new Date(evt.date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transparency */}
        <div className="cs-transparency">
          <h4>🔍 How we process applications</h4>
          <ul>
            <li>AI is used to match your skills against job requirements</li>
            <li>All final decisions are made by humans — not AI</li>
            <li>You can request data deletion anytime via <a href="/delete-my-data">this link</a></li>
          </ul>
          {data.career_page_url && (
            <a href={data.career_page_url} className="cs-transparency-link" target="_blank" rel="noopener noreferrer">
              View all open positions at {data.org_name} →
            </a>
          )}
        </div>

        {/* Info */}
        <div className="cs-info">
          <p>
            This page shows the current status of your application.
            You'll receive email updates when your status changes.
          </p>
        </div>

        <footer className="cs-footer">
          <span>Powered by AI Talent Lab</span>
          <a href="/delete-my-data">Privacy & Data Deletion</a>
        </footer>
      </div>
    </div>
  )
}

