import React from 'react'

/**
 * SkeletonCard — shimmer loading placeholder.
 * Used instead of spinners per docs/FRONTEND_PLAN.md §11.
 */
export default function SkeletonCard({
  lines = 3,
  height = 'auto',
  style = {},
}) {
  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border-light)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
      height,
      ...style,
    }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? '16px' : '12px',
            width: i === lines - 1 ? '60%' : '100%',
            borderRadius: '4px',
            marginBottom: i < lines - 1 ? 'var(--space-3)' : 0,
            background: 'linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-bg-hover) 50%, var(--color-bg-tertiary) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s infinite',
          }}
        />
      ))}
    </div>
  )
}
