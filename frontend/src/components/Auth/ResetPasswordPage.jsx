import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import AuthShell from './AuthShell'
import {
  EyeIcon, EyeOffIcon, AlertIcon, SpinnerIcon, CheckCircleIcon,
} from './authIcons'
import { authApi } from '../../utils/api'

/**
 * /reset-password/:token
 * Lets an existing user set a new password via a token emailed to them.
 * POST /api/v1/auth/reset-password with { token, new_password }.
 */
export default function ResetPasswordPage() {
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
      setErrorMsg("Passwords don't match.")
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
      setErrorMsg(err?.message || 'This link may have expired. Request a new one.')
      setStatus('error')
    }
  }

  return (
    <AuthShell mode="reset-password">
      <header className="auth-form-header">
        <h2>Set a new password</h2>
        <p>Choose a strong password to secure your account.</p>
      </header>

      {status === 'success' ? (
        <div className="magic-link-sent" role="status">
          <div className="magic-link-sent-icon"><CheckCircleIcon /></div>
          <h3>Password updated</h3>
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
            <label htmlFor="reset-password">New password</label>
            <div className="password-field">
              <input
                id="reset-password"
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
            <label htmlFor="reset-confirm">Confirm password</label>
            <div className="password-field">
              <input
                id="reset-confirm"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat your new password"
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
              <><SpinnerIcon /> Updating…</>
            ) : (
              'Update password'
            )}
          </button>
        </form>
      )}

      <p className="auth-footer">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthShell>
  )
}
