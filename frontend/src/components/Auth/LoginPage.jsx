import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../styles/auth.css'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Use uncontrolled inputs to avoid browser autocomplete issues.
  // We read values from refs on submit rather than tracking every keystroke,
  // which means the submit button is always enabled (not false-disabled).

  const handleSubmit = async (e) => {
    e.preventDefault()
    const email = emailRef.current?.value?.trim() || ''
    const password = passwordRef.current?.value || ''

    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }

    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/chat', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Clear fields on mount so browser-saved values don't linger on refresh
  useEffect(() => {
    if (emailRef.current) emailRef.current.value = ''
    if (passwordRef.current) passwordRef.current.value = ''
  }, [])

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>AI <span>Talent</span> Lab</h1>
          <p>Sign in to your workspace</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              ref={emailRef}
              type="email"
              placeholder="you@company.com"
              autoFocus
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <div className="password-field">
              <input
                id="login-password"
                ref={passwordRef}
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPw(!showPw)}
                tabIndex={-1}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
            <Link to="/forgot-password" className="forgot-link">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  )
}
