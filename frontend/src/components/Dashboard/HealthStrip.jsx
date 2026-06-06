/**
 * HealthStrip.jsx — Admin-only 4-card org health.
 * Uses <Stat> atom. Visible only to org_head / dept_admin via <RoleGate> in DashboardPage.
 *
 * Props:
 *   health  — stats object from dashboardApi.getStats
 *   loading — boolean
 *   error   — string | null
 */
import Stat from '../common/Stat'
import Icon from '../common/Icon'

function HealthSkeleton() {
  return (
    <div className="health-strip-skeleton" aria-hidden="true">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="shimmer" style={{ height: 90, borderRadius: 'var(--radius-lg, 14px)' }} />
      ))}
    </div>
  )
}

export default function HealthStrip({ health, loading, error, role }) {
  if (loading) return <HealthSkeleton />

  if (error) {
    return (
      <div className="health-strip-error">
        <Icon name="alert-triangle" size={14} />
        <span>Health stats unavailable.</span>
      </div>
    )
  }

  if (!health) return null

  const cards = [
    {
      label: role === 'dept_admin' ? 'Dept Open Reqs' : 'Org Open Reqs',
      value: health.active_positions ?? '—',
      accent: 'var(--color-info, #3B82F6)',
      icon: <Icon name="briefcase" size={16} />,
    },
    {
      label: 'Avg Time to Hire',
      value: health.avg_time_to_hire ? `${health.avg_time_to_hire}d` : '—',
      accent: 'var(--color-warning, #D97706)',
      icon: <Icon name="clock" size={16} />,
    },
    {
      label: 'Interviews Active',
      value: health.interviews_this_period ?? '—',
      accent: 'var(--color-primary, #0D9488)',
      icon: <Icon name="calendar" size={16} />,
    },
    {
      label: 'Offers Extended',
      value: health.offers_this_period ?? '—',
      accent: 'var(--color-success, #10B981)',
      icon: <Icon name="check-circle" size={16} />,
    },
  ]

  return (
    <div className="health-strip">
      {cards.map(c => (
        <Stat
          key={c.label}
          label={c.label}
          value={c.value}
          accent={c.accent}
          icon={c.icon}
          delta={c.delta}
        />
      ))}
    </div>
  )
}
