/**
 * CandidateStatusPage.jsx – Public candidate application status portal
 * Route: /status/:token (public, no auth)
 * Shows application status, interview schedule, and timeline to candidates.
 */
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import './CandidateStatusPage.css'

const STATUS_STEPS = ['Under Review', 'Application Received', 'Interview Stage', 'Offer Stage', 'Hired']

export default function CandidateStatusPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/v1/status/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Application not found. The link may be invalid.')
        return res.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [token])

  if (loading) return (
    <div className="cs-page"><div className="cs-spinner" /><p>Loading your application status…</p></div>
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

  return (
    <div className="cs-page">
      <div className="cs-card">
        {/* Header */}
        <div className="cs-header">
          <h1 className="cs-role">{data.position?.role_name}</h1>
          <p className="cs-org">{data.org_name}</p>
          <div className="cs-meta">
            {data.position?.location && <span>📍 {data.position.location}</span>}
            {data.position?.work_type && <span>🏢 {data.position.work_type}</span>}
            {data.applied_at && <span>📅 Applied {new Date(data.applied_at).toLocaleDateString()}</span>}
          </div>
        </div>

        {/* Status */}
        <div className={`cs-status-banner ${rejected ? 'cs-status-rejected' : ''}`}>
          <span className="cs-status-label">Application Status</span>
          <span className="cs-status-value">{data.status}</span>
        </div>

        {/* Progress */}
        {!rejected && (
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
