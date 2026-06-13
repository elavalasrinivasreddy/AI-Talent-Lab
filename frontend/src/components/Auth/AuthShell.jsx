import { Link } from 'react-router-dom'
import { LogoMark } from './authIcons'
import '../../styles/auth.css'

/**
 * Shared two-pane shell for /login, /register, /auth/verify.
 * Left pane = brand pitch (gradient teal). Right pane = form (white/dark card).
 * On mobile the pitch collapses to a short banner above the form.
 */
export default function AuthShell({ children, mode }) {
  // `mode` is one of 'login' | 'register' | 'verify' — used only for the
  // toggle row inside the form pane (not in the shell itself), but kept here
  // so consumers can `<AuthShell mode="login">` for future tweaks.
  return (
    <div className="auth-shell" data-mode={mode}>
      <aside className="auth-pitch">
        <div className="auth-pitch-bg-anim" aria-hidden="true">
          <div className="auth-pitch-track track-1">
            <div className="auth-bg-card type-jd" />
            <div className="auth-bg-card type-candidate" />
            <div className="auth-bg-card type-score" />
            <div className="auth-bg-card type-jd" />
            <div className="auth-bg-card type-candidate" />
            <div className="auth-bg-card type-score" />
          </div>
          <div className="auth-pitch-track track-2">
            <div className="auth-bg-card type-offer" />
            <div className="auth-bg-card type-jd" />
            <div className="auth-bg-card type-candidate" />
            <div className="auth-bg-card type-offer" />
            <div className="auth-bg-card type-jd" />
            <div className="auth-bg-card type-candidate" />
          </div>
        </div>

        <div className="auth-pitch-orb auth-pitch-orb-a" aria-hidden="true" />
        <div className="auth-pitch-orb auth-pitch-orb-b" aria-hidden="true" />

        <div className="auth-pitch-inner">
          <Link to="/" className="auth-brand" aria-label="AI Talent Lab home">
            <span className="auth-brand-mark">
              <LogoMark size={22} />
            </span>
            <span className="auth-brand-word">
              AI <span>Talent</span> Lab
            </span>
          </Link>

          <div className="auth-pitch-body">
            <h1 className="auth-pitch-h1">
              You&apos;re in the
              <br />
              right place.
            </h1>
            <p className="auth-pitch-sub">
              One AI-powered workspace for your entire hiring loop —
              from writing the JD to extending the offer. No spreadsheets,
              no juggling tools, no ghosting.
            </p>

            <ul className="auth-pitch-caps" aria-label="What you get">
              <li>
                <span className="auth-cap-check" aria-hidden="true">✓</span>
                <span>Chat-based JD generation in minutes</span>
              </li>
              <li>
                <span className="auth-cap-check" aria-hidden="true">✓</span>
                <span>AI sourcing, scoring &amp; outreach</span>
              </li>
              <li>
                <span className="auth-cap-check" aria-hidden="true">✓</span>
                <span>Candidate apply via chat — zero forms</span>
              </li>
              <li>
                <span className="auth-cap-check" aria-hidden="true">✓</span>
                <span>Panel feedback with magic links</span>
              </li>
            </ul>
          </div>

          <div className="auth-pitch-trust">
            <span className="auth-trust-badge">Designed for SOC 2</span>
            <span className="auth-trust-badge">GDPR + DPDP ready</span>
            <span className="auth-trust-badge">ISO 27001 aligned</span>
          </div>
        </div>
      </aside>

      <main className="auth-form-pane" role="main">
        <div className="auth-form-inner">
          {children}
        </div>
      </main>
    </div>
  )
}
