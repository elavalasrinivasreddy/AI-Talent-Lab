import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MarketingNav, MarketingFooter, BOOKING_URL } from './MarketingChrome'
import '../../styles/marketing.css'

/**
 * / — public landing page (Sprint 1, F1).
 * v2: Premium redesign with CSS chat preview, scroll animations,
 * capability badges (no fake metrics), and distinct voice from auth shell.
 */

/* ── Feature data ─────────────────────────────────────────────────────── */
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

const HOW_IT_WORKS = [
  {
    num: '1',
    title: 'Describe your role',
    body: 'Chat with the AI recruiter. It extracts role details, checks internal context, and writes a polished JD in minutes.',
  },
  {
    num: '2',
    title: 'AI sources & scores',
    body: 'Background agents search candidates, parse resumes, generate match scores, and send outreach — all autonomously.',
  },
  {
    num: '3',
    title: 'You make the call',
    body: 'Review scored candidates in a Kanban pipeline. Schedule interviews, collect panel feedback, and extend offers.',
  },
]

const PERSONAS = [
  {
    emoji: '🚀',
    title: 'Startup founders',
    body: 'Hire your first 10 without a recruiting team. The AI handles the grunt work.',
  },
  {
    emoji: '👥',
    title: 'HR & TA leads',
    body: 'Replace the spreadsheet-email-ATS juggle with one conversational pipeline.',
  },
  {
    emoji: '🏢',
    title: 'Growing orgs',
    body: 'Org-scoped isolation, department controls, and audit logs for scaling teams.',
  },
]

const CAPABILITIES = [
  { label: '5-stage JD generation', icon: 'M9 12l2 2 4-4' },
  { label: 'Zero-form candidate apply', icon: 'M9 12l2 2 4-4' },
  { label: 'Full Kanban pipeline', icon: 'M9 12l2 2 4-4' },
  { label: 'AI resume scoring', icon: 'M9 12l2 2 4-4' },
  { label: 'Magic-link panel feedback', icon: 'M9 12l2 2 4-4' },
]

/* ── Chat conversation for hero ───────────────────────────────────────── */
const CHAT_MESSAGES = [
  {
    type: 'ai',
    text: "Hi! I'm your AI recruiter. What role are you looking to fill?",
  },
  {
    type: 'user',
    text: 'We need a Senior Backend Engineer — Python, distributed systems, 4+ years.',
  },
  {
    type: 'ai',
    text: "Got it. I've extracted the role details. Let me check your org context and benchmark against the market...",
  },
  {
    type: 'ai',
    text: '✅ JD ready — with tech stack, team fit signals, and a competitive salary band. Want me to start sourcing?',
  },
]

/* ── Helper components ────────────────────────────────────────────────── */
function FeatureIcon({ d }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function CapIcon({ d }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" strokeWidth="0" fill="none" />
      <path d={d} />
    </svg>
  )
}

/**
 * IntersectionObserver hook for scroll-triggered reveal.
 * Elements with class `mkt-reveal` get `visible` added when in view.
 */
function useScrollReveal() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    const els = container.querySelectorAll('.mkt-reveal')
    els.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return containerRef
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function LandingPage() {
  const revealRef = useScrollReveal()

  return (
    <div className="mkt" ref={revealRef}>
      {/* Animated background orbs */}
      <div className="mkt-orb mkt-orb--a" aria-hidden="true" />
      <div className="mkt-orb mkt-orb--b" aria-hidden="true" />
      <div className="mkt-orb mkt-orb--c" aria-hidden="true" />

      <MarketingNav />

      <main className="mkt-main">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="mkt-hero">
          <span className="mkt-eyebrow">
            <span className="mkt-eyebrow-dot" aria-hidden="true" />
            Conversational AI hiring platform
          </span>

          <h1>
            Your next hire starts<br />
            with a <span className="grad">conversation.</span>
          </h1>

          <p className="mkt-hero-sub">
            Describe the role in plain language. The AI writes the JD, sources candidates,
            scores resumes, and manages the pipeline — so you focus on the people, not the process.
          </p>

          <div className="mkt-hero-cta">
            <Link to="/register" className="mkt-btn mkt-btn-primary mkt-btn-lg">Start free</Link>
            <a href={BOOKING_URL} className="mkt-btn mkt-btn-ghost mkt-btn-lg">Book a demo</a>
          </div>

          <p className="mkt-hero-note">Free plan, no card required · 2 active positions · 50 candidates/mo</p>

          {/* Capability badges (real, not fake metrics) */}
          <div className="mkt-caps" aria-label="Platform capabilities">
            {CAPABILITIES.map((c) => (
              <span className="mkt-cap" key={c.label}>
                <span className="mkt-cap-icon"><CapIcon d={c.icon} /></span>
                {c.label}
              </span>
            ))}
          </div>

          {/* CSS-rendered chat preview */}
          <div className="mkt-hero-preview" aria-label="Product preview">
            <div className="mkt-chat-window">
              <div className="mkt-chat-titlebar">
                <div className="mkt-chat-dots">
                  <span /><span /><span />
                </div>
                <span className="mkt-chat-title">AI Talent Lab — New Position</span>
                <div style={{ width: 42 }} />
              </div>
              <div className="mkt-chat-body">
                {CHAT_MESSAGES.map((msg, i) => (
                  <div className={`mkt-chat-msg mkt-chat-msg--${msg.type}`} key={i}>
                    <div className="mkt-chat-avatar">
                      {msg.type === 'ai' ? 'AI' : 'You'}
                    </div>
                    <div className="mkt-chat-bubble">{msg.text}</div>
                  </div>
                ))}
                <div className="mkt-chat-typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────── */}
        <section className="mkt-how" id="how">
          <div className="mkt-section-head mkt-reveal">
            <h2>Three steps. Zero busywork.</h2>
            <p>From job description to hired candidate — the AI handles the heavy lifting at every stage.</p>
          </div>
          <div className="mkt-how-steps mkt-reveal-stagger">
            {HOW_IT_WORKS.map((step) => (
              <div className="mkt-how-step mkt-reveal" key={step.num}>
                <div className="mkt-how-num">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────── */}
        <section className="mkt-section" id="features">
          <div className="mkt-section-head mkt-reveal">
            <h2>One platform, the whole hire</h2>
            <p>From the first JD to the signed offer — every step is AI-assisted and org-scoped.</p>
          </div>
          <div className="mkt-grid mkt-reveal-stagger">
            {FEATURES.map((f) => (
              <article className="mkt-card mkt-reveal" key={f.title}>
                <div className="mkt-card-icon"><FeatureIcon d={f.icon} /></div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Who it's for ──────────────────────────────────────── */}
        <section className="mkt-section">
          <div className="mkt-section-head mkt-reveal">
            <h2>Built for teams that move fast</h2>
            <p>Whether you're hiring your first engineer or scaling across departments.</p>
          </div>
          <div className="mkt-personas mkt-reveal-stagger">
            {PERSONAS.map((p) => (
              <div className="mkt-persona mkt-reveal" key={p.title}>
                <span className="mkt-persona-emoji" aria-hidden="true">{p.emoji}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA band ──────────────────────────────────────────── */}
        <section className="mkt-cta-band mkt-reveal">
          <h2>See it on your own roles</h2>
          <p>Spin up a workspace in minutes. Early adopter orgs get 3 founder-pilot seats with priority support and extended quotas.</p>
          <div className="mkt-hero-cta">
            <Link to="/register" className="mkt-btn mkt-btn-primary mkt-btn-lg">Create a workspace</Link>
            <Link to="/pricing" className="mkt-btn mkt-btn-ghost mkt-btn-lg">See pricing</Link>
          </div>
          <p className="mkt-cta-note">Founder-pilot slots are limited — first come, first served.</p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
