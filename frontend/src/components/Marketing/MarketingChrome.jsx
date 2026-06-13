import { Link } from 'react-router-dom'
import { LogoMark } from '../Auth/authIcons'

/**
 * Shared nav + footer for the public marketing surfaces (/, /pricing).
 * Kept separate from AuthShell so marketing pages don't pull in auth-form CSS.
 *
 * Demo bookings go through BOOKING_URL. Sprint 1 (F1) ships this as a mailto
 * placeholder; swap to the Calendly link when the 3 pilot slots are live.
 */
export const BOOKING_URL = 'mailto:founders@aitalentlab.com?subject=AI%20Talent%20Lab%20demo'

export function MarketingNav() {
  return (
    <header className="mkt-nav">
      <Link to="/" className="mkt-brand" aria-label="AI Talent Lab home">
        <span className="mkt-brand-mark"><LogoMark size={20} /></span>
        <span className="mkt-brand-word">AI <span>Talent</span> Lab</span>
      </Link>
      <nav className="mkt-nav-links" aria-label="Primary">
        <Link to="/pricing">Pricing</Link>
        <Link to="/login" className="mkt-nav-hide">Sign in</Link>
        <Link to="/register" className="mkt-btn mkt-btn-primary">Get started</Link>
      </nav>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-footer-inner">
        <span className="mkt-footer-copy">© {new Date().getFullYear()} AI Talent Lab. All rights reserved.</span>
        <nav className="mkt-footer-links" aria-label="Footer">
          <Link to="/pricing">Pricing</Link>
          <Link to="/login">Sign in</Link>
          <Link to="/privacy">Privacy</Link>
          <a href={BOOKING_URL}>Book a demo</a>
        </nav>
      </div>
      <div className="mkt-trust">
        <span className="mkt-trust-badge">SOC 2 Type II</span>
        <span className="mkt-trust-badge">GDPR + DPDP</span>
        <span className="mkt-trust-badge">ISO 27001 (in progress)</span>
      </div>
    </footer>
  )
}

/* Inline icons — keep marketing self-contained, no icon-lib dependency. */
export function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
