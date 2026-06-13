import { Link } from 'react-router-dom'
import { MarketingNav, MarketingFooter, BOOKING_URL, Check } from './MarketingChrome'
import '../../styles/marketing.css'

/**
 * /pricing — public pricing page (Sprint 1, F1).
 * Tiers + quotas mirror docs/product/03_roadmap.md and the Sprint 2 plan model
 * (org.plan ∈ starter | professional | business | founder_pilot). Keep this in
 * sync with the plan/quota middleware when F2a lands so marketing ≠ enforcement.
 */

const TIERS = [
  {
    plan: 'starter',
    name: 'Starter',
    amount: '₹0',
    per: 'forever',
    tag: 'For a first real hire — try the whole loop on us.',
    cta: { label: 'Start free', to: '/register' },
    features: [
      '1 user',
      '2 active positions',
      '50 candidates / month',
      'AI JD generation + apply chat',
      'Email simulation (no domain setup)',
    ],
  },
  {
    plan: 'professional',
    name: 'Professional',
    amount: '₹4,999',
    per: '/ month',
    tag: 'For a hiring team running multiple reqs at once.',
    featured: true,
    cta: { label: 'Start free trial', to: '/register' },
    features: [
      '5 users',
      '10 active positions',
      '500 candidates / month',
      'Real email outreach (your domain)',
      'Org-wide talent pool',
      'Panel feedback + AI debrief',
    ],
  },
  {
    plan: 'business',
    name: 'Business',
    amount: '₹14,999',
    per: '/ month',
    tag: 'For scaling orgs that need control and integrations.',
    cta: { label: 'Contact sales', href: BOOKING_URL },
    features: [
      '25 users',
      'Unlimited positions',
      'API access',
      'Custom career-page branding',
      'Audit logs + RLS isolation',
      'Priority support',
    ],
  },
]

export default function PricingPage() {
  return (
    <div className="mkt">
      <MarketingNav />

      <main className="mkt-main">
        <section className="mkt-hero" style={{ paddingBottom: 0 }}>
          <span className="mkt-eyebrow">Pricing</span>
          <h1>Start free. Pay when it <span className="grad">works.</span></h1>
          <p className="mkt-hero-sub">
            Every plan includes the full conversational hiring loop. Upgrade only when you
            outgrow the quotas — no feature paywalls on the core workflow.
          </p>
        </section>

        <section className="mkt-section" style={{ paddingTop: 'var(--space-10)' }}>
          <div className="mkt-pricing-grid">
            {TIERS.map((t) => (
              <article className={`mkt-price-card${t.featured ? ' featured' : ''}`} key={t.plan}>
                {t.featured && <span className="mkt-price-badge">Most popular</span>}
                <h3 className="mkt-price-name">{t.name}</h3>
                <div className="mkt-price-amount">
                  <span className="amt">{t.amount}</span>
                  <span className="per">{t.per}</span>
                </div>
                <p className="mkt-price-tag">{t.tag}</p>
                <ul className="mkt-price-features">
                  {t.features.map((f) => (
                    <li key={f}><Check /> <span>{f}</span></li>
                  ))}
                </ul>
                {t.cta.href ? (
                  <a href={t.cta.href} className={`mkt-btn ${t.featured ? 'mkt-btn-primary' : 'mkt-btn-ghost'}`}>
                    {t.cta.label}
                  </a>
                ) : (
                  <Link to={t.cta.to} className={`mkt-btn ${t.featured ? 'mkt-btn-primary' : 'mkt-btn-ghost'}`}>
                    {t.cta.label}
                  </Link>
                )}
              </article>
            ))}
          </div>

          <p className="mkt-price-note">
            Prices in INR, billed monthly via Razorpay. GST extra where applicable.
            Annual billing and a <strong>founder-pilot</strong> plan (3 slots) available —{' '}
            <a href={BOOKING_URL} style={{ color: 'var(--color-primary-hover)' }}>talk to us</a>.
          </p>
        </section>

        <section className="mkt-cta-band">
          <h2>Not sure which plan?</h2>
          <p>Start on the free plan and upgrade in-app the moment you hit a quota.</p>
          <div className="mkt-hero-cta">
            <Link to="/register" className="mkt-btn mkt-btn-primary mkt-btn-lg">Create a workspace</Link>
            <a href={BOOKING_URL} className="mkt-btn mkt-btn-ghost mkt-btn-lg">Book a demo</a>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
