import React from 'react'
import { PIPELINE_STAGES } from '../../utils/constants'

/**
 * StatusBadge — THE ONLY place pipeline status color logic lives.
 * See docs/FRONTEND_PLAN.md §2 rule 10.
 */
export default function Badge({ status, size = 'sm' }) {
  const stage = PIPELINE_STAGES[status] || { label: status, color: '#6b7280', bg: 'rgba(107,114,128,0.12)' }

  const sizeStyles = {
    xs: { fontSize: '0.6875rem', padding: '2px 6px' },
    sm: { fontSize: '0.75rem', padding: '3px 8px' },
    md: { fontSize: '0.8125rem', padding: '4px 10px' },
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontWeight: 500,
        borderRadius: '6px',
        color: stage.color,
        backgroundColor: stage.bg,
        textTransform: 'capitalize',
        letterSpacing: '0.02em',
        ...sizeStyles[size],
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: stage.color }} />
      {stage.label}
    </span>
  )
}
