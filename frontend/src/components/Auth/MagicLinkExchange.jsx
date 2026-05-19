import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, defaultRouteForRole } from '../../context/AuthContext'
import AuthShell from './AuthShell'
import { SpinnerIcon, AlertIcon, CheckCircleIcon, ArrowRightIcon } from './authIcons'

/**
 * /auth/verify?token=…
 * Exchanges a magic-link JWT for a session JWT, then redirects to the role-default route.
 * Single-use is enforced server-side, so a refresh after success bounces to /login.
 */
export default function MagicLinkExchange() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const next = params.get('next') || ''
  const { verifyMagicLink } = useAuth()
  const navigate = useNavigate()
  const ran = useRef(false)

  // 'verifying' | 'success' | 'expired' | 'used' | 'invalid' | 'error'
  const [status, setStatus] = useState(token ? 'verifying' : 'invalid')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) return
    if (ran.current) return  // React 18 StrictMode double-invoke guard — a magic link is single-use
    ran.current = true

    let cancelled = false
    ;(async () => {
      try {
        const data = await verifyMagicLink(token)
        if (cancelled) return
        setStatus('success')
        const dest = next || defaultRouteForRole(data?.user?.role)
        // Brief success flash so users see "Signed in" before nav.
        setTimeout(() => navigate(dest, { replace: true }), 350)
      } catch (err) {
        if (cancelled) return
        const code = err?.code
        if (code === 'MAGIC_LINK_EXPIRED') setStatus('expired')
        else if (code === 'MAGIC_LINK_USED') setStatus('used')
        else if (code === 'INVALID_CREDENTIALS') setStatus('invalid')
        else setStatus('error')
        setErrorMessage(err?.message || 'Couldn\'t verify this link.')
      }
    })()
    return () => { cancelled = true }
  }, [token, verifyMagicLink, navigate, next])

  return (
    <AuthShell mode="verify">
      <header className="auth-form-header">
        <h2>{HEADINGS[status]}</h2>
        <p>{SUBLINES[status]}</p>
      </header>

      <div className="magic-exchange-card" data-status={status}>
        {status === 'verifying' && (
          <div className="magic-exchange-icon magic-exchange-icon-spin">
            <SpinnerIcon size={28} />
          </div>
        )}
        {status === 'success' && (
          <div className="magic-exchange-icon magic-exchange-icon-ok">
            <CheckCircleIcon size={28} />
          </div>
        )}
        {(status === 'expired' || status === 'used' || status === 'invalid' || status === 'error') && (
          <div className="magic-exchange-icon magic-exchange-icon-err">
            <AlertIcon size={28} />
          </div>
        )}

        {errorMessage && status !== 'verifying' && status !== 'success' && (
          <p className="magic-exchange-error">{errorMessage}</p>
        )}

        {(status === 'expired' || status === 'used' || status === 'invalid' || status === 'error') && (
          <Link to="/login" className="btn-primary magic-exchange-cta">
            Back to sign in <ArrowRightIcon />
          </Link>
        )}
      </div>
    </AuthShell>
  )
}

const HEADINGS = {
  verifying: 'Signing you in…',
  success: 'You\'re in',
  expired: 'This link has expired',
  used: 'This link was already used',
  invalid: 'This link isn\'t valid',
  error: 'Something went wrong',
}

const SUBLINES = {
  verifying: 'Hang tight while we verify your magic link.',
  success: 'Redirecting to your workspace…',
  expired: 'Sign-in links expire after 15 minutes. Request a fresh one to continue.',
  used: 'For security, each link can only be used once. Request a new one and try again.',
  invalid: 'We couldn\'t recognise this link. Request a new one from the sign-in page.',
  error: 'Try requesting a new sign-in link.',
}
