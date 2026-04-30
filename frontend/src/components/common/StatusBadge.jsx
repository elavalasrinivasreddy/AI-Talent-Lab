/**
 * components/common/StatusBadge.jsx
 * ONLY place pipeline status color logic lives. Never define status colors elsewhere.
 * Per docs/FRONTEND_PLAN.md §10 rule.
 */
import { PIPELINE_STAGES, POSITION_STATUSES } from '../../utils/constants'

export default function StatusBadge({ status, type = 'pipeline', size = 'sm' }) {
  const config =
    type === 'pipeline'
      ? PIPELINE_STAGES[status] || { label: status, color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' }
      : POSITION_STATUSES[status] || { label: status, color: '#9ca3af' }

  const bg = config.bg || `${config.color}1a`

  const sizes = {
    xs: { padding: '2px 6px', fontSize: '11px', borderRadius: '4px' },
    sm: { padding: '3px 8px', fontSize: '12px', borderRadius: '5px' },
    md: { padding: '4px 10px', fontSize: '13px', borderRadius: '6px' },
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontWeight: 500,
      letterSpacing: '0.01em',
      color: config.color,
      background: bg,
      border: `1px solid ${config.color}33`,
      ...sizes[size],
    }}>
      {config.label}
    </span>
  )
}
