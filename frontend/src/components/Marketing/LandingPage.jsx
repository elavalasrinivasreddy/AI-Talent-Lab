import { Link } from 'react-router-dom'
import { MarketingNav, MarketingFooter, BOOKING_URL } from './MarketingChrome'
import '../../styles/marketing.css'

/**
 * / — public landing page (Sprint 1, F1).
 * Front door of the sales path: landing → pricing → demo / sign-up.
 * Voice + claims mirror the auth shell pitch so the funnel feels continuous.
 */

const FEATURES = [
  {
    title: 'AI JD generation',
    body: 'Chat your way to a hireable job description — role extraction, internal check, market benchmark, then a final streamed JD.',
    icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  },
  {
    title: 'Autonomous sourcing',
    body: 'Background agents search candidates, score resumes against the JD, and send magic-link outreach while you sleep.',
    icon: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
  },
  {
    title: 'Conversational apply',
    body: 'Candidates apply through a chat — no account, no forms. Higher completion, less ghosting.',
    icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  },
  {
    title: 'Kanban pipeline',
    body: 'Drag-and-drop stages with full status history, timeline events, and AI-drafted rejection emails.',
    icon: 'M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M9 3v18M9 3h6m0 0h4a2 2 0 012 2v14a2 2 0 01-2 2h-4m0-18v18',
  },
  {
    title: 'Panel feedback',
    body: 'Panelists score via public magic link — no seat needed. AI enriches raw notes and synthesizes a debrief.',
    icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  },
  {
    title: 'Org-wide talent pool',
    body: 'Bulk-upload resumes, get AI match suggestions, and auto-pool candidates on reject — a reusable hiring asset.',
    icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  },
]

function FeatureIcon({ d }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div className="mkt">
      <MarketingNav />

      <main className="mkt-main">
        {/* Hero */}
        <section className="mkt-hero">
          <span className="mkt-eyebrow">Conversational AI hiring platform</span>
          <h1>
            Hire is a verb.<br />
            Make it your <span className="grad">favorite.</span>
          </h1>
          <p className="mkt-hero-sub">
            AI sources, screens, scores, and schedules. You make the call. Together you
            ship far more hires — without the busywork, the spreadsheets, or the ghosting.
          </p>
          <div className="mkt-hero-cta">
            <Link to="/register" className="mkt-btn mkt-btn-primary mkt-btn-lg">Start free</Link>
            <a href={BOOKING_URL} className="mkt-btn mkt-btn-ghost mkt-btn-lg">Book a demo</a>
          </div>
          <p className="mkt-hero-note">Free plan, no card required · 2 active positions · 50 candidates/mo</p>

          <ul className="mkt-stats" aria-label="Product highlights">
            <li><strong>200+</strong><span>Hiring teams onboard</span></li>
            <li><strong>38d</strong><span>Avg time saved per req</span></li>
            <li><strong>94%</strong><span>Candidate response NPS</span></li>
          </ul>
        </section>

        {/* Features */}
        <section className="mkt-section" id="features">
          <div className="mkt-section-head">
            <h2>One platform, the whole hire</h2>
            <p>From the first JD to the signed offer — every step is AI-assisted and org-scoped.</p>
          </div>
          <div className="mkt-grid">
            {FEATURES.map((f) => (
              <article className="mkt-card" key={f.title}>
                <div className="mkt-card-icon"><FeatureIcon d={f.icon} /></div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="mkt-cta-band">
          <h2>See it on your own roles</h2>
          <p>Spin up a workspace in minutes, or grab one of three founder-pilot slots.</p>
          <div className="mkt-hero-cta">
            <Link to="/register" className="mkt-btn mkt-btn-primary mkt-btn-lg">Create a workspace</Link>
            <Link to="/pricing" className="mkt-btn mkt-btn-ghost mkt-btn-lg">See pricing</Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
