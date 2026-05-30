import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from './AuthShell'
import { MailIcon, AlertIcon, SpinnerIcon, CheckCircleIcon, ArrowLeftIcon } from './authIcons'
import { authApi } from '../../utils/api'

/**
 * /forgot-password
 * Submits an email to POST /api/v1/auth/forgot-password.
 * Always shows a neutral success message — never reveals whether the email exists.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'sent' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setErrorMsg('Enter your work email.')
      setStatus('error')
      return
    }
    setErrorMsg('')
    setStatus('loading')
    try {
      await authApi.forgotPassword(trimmed)
      setStatus('sent')
    } catch (err) {
      setErrorMsg(err?.message || 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  return (
    <AuthShell mode="forgot-password">
      <header className="auth-form-header">
        <h2>Reset your password</h2>
        <p>Enter your work email and we'll send you a reset link.</p>
      </header>

      {status === 'sent' ? (
        <div className="magic-link-sent" role="status">
          <div className="magic-link-sent-icon"><CheckCircleIcon /></div>
          <h3>Check your inbox</h3>
          <p className="magic-link-sent-msg">
            If that email is registered, we've sent a reset link. Check your inbox.
          </p>
          <p className="magic-link-sent-hint">
            The link expires in 30 minutes. Don't see it? Check spam.
          </p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {status === 'error' && errorMsg && (
            <div className="auth-error" role="alert">
              <AlertIcon />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="forgot-email">
              <MailIcon /> Work email
            </label>
            <input
              id="forgot-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={status === 'loading'}>
            {status === 'loading' ? (
              <><SpinnerIcon /> Sending…</>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>
      )}

      <p className="auth-footer">
        <Link to="/login" className="auth-back-link">
          <ArrowLeftIcon /> Back to sign in
        </Link>
      </p>
    </AuthShell>
  )
}
