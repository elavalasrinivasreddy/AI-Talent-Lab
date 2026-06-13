/**
 * OnboardingChecklist.jsx — first-run guide shown on an empty dashboard (F5).
 *
 * Scaffold: steps are guided actions with deep links. The "publish your first
 * job" / "file your first hire request" step is the primary action. Only that
 * step's completion is cheaply derivable here (a position exists); richer
 * per-step completion detection is intentionally deferred until we've watched a
 * real first pilot (per TODO F5).
 *
 * Props:
 *   role      — 'org_head' | 'dept_admin' | 'hr' | 'team_lead'
 *   positions — full positions list (used only to mark the publish step done)
 */
import { Link } from 'react-router-dom'
import Icon from '../common/Icon'

const STEP_SETS = {
  default: [
    { key: 'org',   icon: 'briefcase', title: 'Complete your organization profile', desc: 'Tell candidates who you are — this powers your JDs and career page.', to: '/settings/organization', cta: 'Edit profile' },
    { key: 'jd',    icon: 'plus',      title: 'Publish your first job',             desc: 'Create a position via AI chat — it drafts the JD, runs a bias check, and starts sourcing.', to: '/chat', cta: 'Create position', primary: true },
    { key: 'brand', icon: 'home',      title: 'Brand your career page',             desc: 'Add your colors, banner and tagline so your page feels like you.', to: '/settings/career-brand', cta: 'Customize' },
    { key: 'team',  icon: 'users',     title: 'Invite your team',                   desc: 'Bring in hiring managers and recruiters to collaborate.', to: '/settings/team', cta: 'Invite' },
  ],
  team_lead: [
    { key: 'req',     icon: 'plus', title: 'File your first hire request', desc: 'Kick off hiring — your request routes for approval, then HR builds the JD.', to: '/hire-requests/new', cta: 'File request', primary: true },
    { key: 'profile', icon: 'user', title: 'Complete your profile',        desc: 'Make sure your details are up to date so the team can reach you.', to: '/settings/profile', cta: 'Edit profile' },
  ],
}

export default function OnboardingChecklist({ role = 'hr', positions }) {
  const steps = STEP_SETS[role === 'team_lead' ? 'team_lead' : 'default']
  const hasPositions = Array.isArray(positions) && positions.length > 0
  // Only the "create work" step is cheaply known to be done.
  const isDone = (key) => (key === 'jd' || key === 'req') ? hasPositions : false
  const completed = steps.filter(s => isDone(s.key)).length
  const pct = Math.round((completed / steps.length) * 100)

  return (
    <div className="tb-onboarding">
      <div className="tb-onboarding-inner" style={{ maxWidth: 640, width: '100%' }}>
        <h2 className="tb-onboarding-title">Welcome — let’s get you set up</h2>
        <p className="tb-onboarding-desc">A few quick steps to get your first role live.</p>

        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Onboarding progress"
          style={{ height: 6, background: 'var(--color-bg-tertiary, rgba(255,255,255,0.08))', borderRadius: 999, overflow: 'hidden', margin: '12px 0 20px' }}
        >
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary, #0D9488)', transition: 'width .3s ease' }} />
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
          {steps.map(s => {
            const done = isDone(s.key)
            return (
              <li
                key={s.key}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '14px 16px', border: '1px solid var(--color-border)', borderRadius: 12,
                  background: s.primary && !done ? 'var(--color-bg-secondary)' : 'transparent',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0, width: 28, height: 28, borderRadius: 999,
                    display: 'grid', placeItems: 'center',
                    background: done ? 'var(--color-primary, #0D9488)' : 'var(--color-bg-tertiary, rgba(255,255,255,0.08))',
                    color: done ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  <Icon name={done ? 'check' : s.icon} size={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{s.desc}</div>
                </div>
                {done ? (
                  <span style={{ color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>Done</span>
                ) : (
                  <Link
                    to={s.to}
                    className={s.primary ? 'btn-primary' : 'btn-secondary'}
                    style={{ flexShrink: 0, fontSize: 13, padding: '6px 12px', whiteSpace: 'nowrap' }}
                  >
                    {s.cta}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
