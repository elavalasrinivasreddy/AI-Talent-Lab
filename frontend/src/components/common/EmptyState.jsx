import React from 'react'

/**
 * EmptyState — reusable empty state for list/collection pages.
 * See docs/FRONTEND_PLAN.md §11.
 */
export default function EmptyState({
  icon = '📋',
  title = 'Nothing here yet',
  description = '',
  action = null,
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-16) var(--space-8)',
      textAlign: 'center',
      animation: 'fadeIn 400ms ease both',
    }}>
      <span style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>{icon}</span>
      <h3 style={{
        fontSize: 'var(--font-size-lg)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-2)',
      }}>
        {title}
      </h3>
      {description && (
        <p style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          maxWidth: '360px',
          lineHeight: 'var(--line-height-relaxed)',
        }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 'var(--space-6)' }}>{action}</div>}
    </div>
  )
}
