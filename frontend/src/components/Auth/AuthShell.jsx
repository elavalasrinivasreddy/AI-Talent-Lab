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
              Hire is a verb.
              <br />
              Let&apos;s make it your favorite.
            </h1>
            <p className="auth-pitch-sub">
              AI sources, screens, scores and schedules. You make the call.
              Together you ship 10× more hires — without the busywork.
            </p>

            <ul className="auth-pitch-stats" aria-label="Product highlights">
              <li>
                <strong>200+</strong>
                <span>Hiring teams onboard</span>
              </li>
              <li>
                <strong>38d</strong>
                <span>Avg time saved per req</span>
              </li>
              <li>
                <strong>94%</strong>
                <span>Candidate response NPS</span>
              </li>
            </ul>
          </div>

          <div className="auth-pitch-trust">
            <span className="auth-trust-badge">SOC 2 Type II</span>
            <span className="auth-trust-badge">GDPR + DPDP</span>
            <span className="auth-trust-badge">ISO 27001 (in progress)</span>
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
