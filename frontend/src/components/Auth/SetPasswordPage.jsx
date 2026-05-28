import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import AuthShell from './AuthShell'
import {
  EyeIcon, EyeOffIcon, AlertIcon, SpinnerIcon, CheckCircleIcon,
} from './authIcons'
import { authApi } from '../../utils/api'

/**
 * /set-password/:token
 * Onboards a newly invited user — same backend endpoint as reset-password
 * (POST /api/v1/auth/reset-password) but with warmer, welcome-oriented copy.
 * The invite token is a standard password-reset token issued at user creation.
 */
export default function SetPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  const validate = () => {
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.')
      return false
    }
    if (password !== confirm) {
      setErrorMsg('Passwords don't match.')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    if (!validate()) {
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      await authApi.resetPassword(token, password)
      setStatus('success')
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      setErrorMsg(err?.message || 'This invite link may have expired. Ask your admin to resend it.')
      setStatus('error')
    }
  }

  return (
    <AuthShell mode="set-password">
      <header className="auth-form-header">
        <h2>Welcome! Set your password</h2>
        <p>Choose a password to get started with your workspace.</p>
      </header>

      {status === 'success' ? (
        <div className="magic-link-sent" role="status">
          <div className="magic-link-sent-icon"><CheckCircleIcon /></div>
          <h3>You're all set</h3>
          <p className="magic-link-sent-msg">Redirecting to sign in…</p>
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
            <label htmlFor="set-password">Password</label>
            <div className="password-field">
              <input
                id="set-password"
                type={showPw ? 'text' : 'password'}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPw(s => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="set-confirm">Confirm password</label>
            <div className="password-field">
              <input
                id="set-confirm"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirm(s => !s)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={status === 'loading'}>
            {status === 'loading' ? (
              <><SpinnerIcon /> Getting you started…</>
            ) : (
              'Get started'
            )}
          </button>
        </form>
      )}

      <p className="auth-footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  )
}
