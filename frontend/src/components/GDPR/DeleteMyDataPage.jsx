/**
 * DeleteMyDataPage.jsx – Public GDPR/DPDP "Right to Erasure" page
 * Route: /delete-my-data (public, no auth)
 * Allows candidates to request deletion of all their data.
 */
import React, { useState } from 'react'
import './DeleteMyDataPage.css'

export default function DeleteMyDataPage() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState('form') // form | sent | verifying | done | error
  const [verifyToken, setVerifyToken] = useState('')
  const [error, setError] = useState('')

  const handleRequest = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setStep('sending')
    try {
      const res = await fetch('/api/v1/gdpr/delete-my-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (data.verification_token) {
        setVerifyToken(data.verification_token)
      }
      setStep('sent')
    } catch (err) {
      setError('Something went wrong. Please try again later.')
      setStep('error')
    }
  }

  const handleVerify = async () => {
    if (!verifyToken) return
    setStep('verifying')
    try {
      const res = await fetch(`/api/v1/gdpr/verify-deletion/${verifyToken}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.verified) {
        setStep('done')
      } else {
        setError(data.detail?.message || 'Verification failed.')
        setStep('error')
      }
    } catch (err) {
      setError('Verification failed. The link may have expired.')
      setStep('error')
    }
  }

  return (
    <div className="dmd-page">
      <div className="dmd-card">
        <div className="dmd-logo">
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="url(#g1)" />
            <path d="M12 24h16M12 20h16M16 16h8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <defs><linearGradient id="g1" x1="0" y1="0" x2="40" y2="40"><stop stopColor="#6366f1" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient></defs>
          </svg>
          <span>AI Talent Lab</span>
        </div>

        <h1 className="dmd-title">Delete My Data</h1>
        <p className="dmd-subtitle">
          Under GDPR Article 17 and India's DPDP Act, you have the right to request 
          deletion of your personal data from our systems.
        </p>

        {step === 'form' && (
          <form className="dmd-form" onSubmit={handleRequest}>
            <label htmlFor="dmd-email">Email address used in your application</label>
            <input
              id="dmd-email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="dmd-submit-btn">
              Request Data Deletion
            </button>
            <p className="dmd-hint">
              We'll verify your identity before processing. Your data will be anonymized 
              within 72 hours of verification.
            </p>
          </form>
        )}

        {step === 'sending' && (
          <div className="dmd-status">
            <div className="dmd-spinner" />
            <p>Processing your request…</p>
          </div>
        )}

        {step === 'sent' && (
          <div className="dmd-status dmd-status-success">
            <span className="dmd-status-icon">📧</span>
            <h3>Request Received</h3>
            <p>
              If your email is in our system, you'll receive a verification link. 
              Please check your inbox (and spam folder).
            </p>
            {/* Dev mode: show verify button directly */}
            {verifyToken && (
              <div className="dmd-dev-verify">
                <p className="dmd-dev-label">Dev Mode — Verify directly:</p>
                <button className="dmd-verify-btn" onClick={handleVerify}>
                  ✅ Verify & Process Deletion
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'verifying' && (
          <div className="dmd-status">
            <div className="dmd-spinner" />
            <p>Verifying and processing deletion…</p>
          </div>
        )}

        {step === 'done' && (
          <div className="dmd-status dmd-status-success">
            <span className="dmd-status-icon">✅</span>
            <h3>Deletion Confirmed</h3>
            <p>
              Your deletion request has been verified. Your personal data will be 
              anonymized within 72 hours. You'll receive a confirmation email when complete.
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="dmd-status dmd-status-error">
            <span className="dmd-status-icon">⚠️</span>
            <h3>Something Went Wrong</h3>
            <p>{error}</p>
            <button className="dmd-retry-btn" onClick={() => setStep('form')}>
              Try Again
            </button>
          </div>
        )}

        <div className="dmd-info">
          <h4>What gets deleted?</h4>
          <ul>
            <li>Your name, email, phone number, and contact details</li>
            <li>Resume content and parsed data</li>
            <li>Chat conversation history</li>
            <li>Screening question responses</li>
            <li>Interview feedback comments (ratings are anonymized)</li>
          </ul>
          <h4>What's preserved?</h4>
          <ul>
            <li>Anonymized hiring metrics (no PII)</li>
            <li>Aggregate statistics for compliance reporting</li>
          </ul>
        </div>

        <footer className="dmd-footer">
          Powered by AI Talent Lab · <a href="/privacy">Privacy Policy</a>
        </footer>
      </div>
    </div>
  )
}
