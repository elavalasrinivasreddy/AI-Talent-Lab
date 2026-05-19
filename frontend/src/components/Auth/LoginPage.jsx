import { useState, useRef, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth, defaultRouteForRole } from '../../context/AuthContext'
import AuthShell from './AuthShell'
import {
  BoltIcon, EyeIcon, EyeOffIcon, MailIcon, AlertIcon, SpinnerIcon,
  ArrowRightIcon, CheckCircleIcon,
} from './authIcons'

/**
 * /login — magic-link primary CTA, password fallback below.
 * Per docs/redesign/14_auth.md.
 */
export default function LoginPage() {
  const { login, requestMagicLink } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const nextPath = new URLSearchParams(location.search).get('next')

  // Magic-link UI states: 'idle' | 'expanded' | 'sending' | 'sent'
  const [magicState, setMagicState] = useState('idle')
  const [magicEmail, setMagicEmail] = useState('')
  const [magicMessage, setMagicMessage] = useState('')
  const [magicError, setMagicError] = useState('')

  const emailRef = useRef(null)
  const pwRef = useRef(null)
  const [showPw, setShowPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const redirectAfterLogin = useCallback((data) => {
    const fallback = defaultRouteForRole(data?.user?.role)
    navigate(nextPath || fallback, { replace: true })
  }, [navigate, nextPath])

  const submitMagicLink = async (e) => {
    e?.preventDefault?.()
    setMagicError('')
    const email = magicEmail.trim()
    if (!email) {
      setMagicError('Enter your work email.')
      return
    }
    setMagicState('sending')
    try {
      const res = await requestMagicLink(email)
      setMagicMessage(res?.message || 'Check your inbox for the sign-in link.')
      setMagicState('sent')
    } catch (err) {
      setMagicError(err?.message || 'Couldn\'t send link. Try again.')
      setMagicState('expanded')
    }
  }

  const submitPassword = async (e) => {
    e.preventDefault()
    const email = emailRef.current?.value?.trim() || ''
    const password = pwRef.current?.value || ''
    if (!email || !password) {
      setPwError('Enter your email and password.')
      return
    }
    setPwError('')
    setPwLoading(true)
    try {
      const data = await login(email, password)
      redirectAfterLogin(data)
    } catch (err) {
      setPwError(err?.message || 'Sign-in failed. Try again.')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <AuthShell mode="login">
      <ToggleRow active="signin" />

      <header className="auth-form-header">
        <h2>Welcome back</h2>
        <p>Sign in to your workspace.</p>
      </header>

      {magicState === 'sent' ? (
        <MagicLinkSent email={magicEmail} message={magicMessage} onReset={() => {
          setMagicState('idle')
          setMagicEmail('')
          setMagicMessage('')
        }} />
      ) : (
        <>
          <MagicLinkBlock
            state={magicState}
            email={magicEmail}
            error={magicError}
            onEmailChange={setMagicEmail}
            onExpand={() => setMagicState('expanded')}
            onSubmit={submitMagicLink}
          />

          <div className="auth-divider"><span>OR</span></div>

          {pwError && (
            <div className="auth-error" role="alert">
              <AlertIcon />
              <span>{pwError}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={submitPassword} autoComplete="on">
            <div className="form-group">
              <label htmlFor="login-email">Work email</label>
              <input
                id="login-email"
                ref={emailRef}
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="password-field">
                <input
                  id="login-password"
                  ref={pwRef}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
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
              <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
            </div>

            <button type="submit" className="btn-primary" disabled={pwLoading}>
              {pwLoading ? (
                <><SpinnerIcon /> Signing in…</>
              ) : (
                <>Sign in <ArrowRightIcon /></>
              )}
            </button>
          </form>
        </>
      )}

      <p className="auth-footer">
        New here? <Link to="/register">Create a workspace</Link>
      </p>
    </AuthShell>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

function ToggleRow({ active }) {
  return (
    <nav className="auth-toggle" aria-label="Authentication mode">
      <Link to="/login" data-active={active === 'signin'}>Sign in</Link>
      <Link to="/register" data-active={active === 'create'}>Create workspace</Link>
    </nav>
  )
}

function MagicLinkBlock({ state, email, error, onEmailChange, onExpand, onSubmit }) {
  if (state === 'idle') {
    return (
      <button type="button" className="magic-link-cta" onClick={onExpand}>
        <span className="magic-link-cta-icon"><BoltIcon /></span>
        <span className="magic-link-cta-body">
          <span className="magic-link-cta-title">Continue with magic link</span>
          <span className="magic-link-cta-sub">
            No password — we email you a one-tap sign-in link.
          </span>
        </span>
        <ArrowRightIcon />
      </button>
    )
  }

  return (
    <form className="magic-link-form" onSubmit={onSubmit}>
      <div className="form-group">
        <label htmlFor="magic-email">
          <MailIcon /> Send a sign-in link to
        </label>
        <input
          id="magic-email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          autoFocus
          autoComplete="email"
          required
        />
      </div>
      {error && (
        <div className="auth-error" role="alert">
          <AlertIcon /> <span>{error}</span>
        </div>
      )}
      <button
        type="submit"
        className="btn-primary"
        disabled={state === 'sending'}
      >
        {state === 'sending' ? (
          <><SpinnerIcon /> Sending…</>
        ) : (
          <>Email me the link <ArrowRightIcon /></>
        )}
      </button>
    </form>
  )
}

function MagicLinkSent({ email, message, onReset }) {
  return (
    <div className="magic-link-sent" role="status">
      <div className="magic-link-sent-icon"><CheckCircleIcon /></div>
      <h3>Check your inbox</h3>
      <p className="magic-link-sent-msg">{message}</p>
      <p className="magic-link-sent-email">
        Sent to <strong>{email}</strong>
      </p>
      <p className="magic-link-sent-hint">
        The link expires in 15 minutes and can only be used once.
        Don&apos;t see it? Check spam, or
        {' '}
        <button type="button" className="auth-text-button" onClick={onReset}>
          try a different email
        </button>.
      </p>
    </div>
  )
}
