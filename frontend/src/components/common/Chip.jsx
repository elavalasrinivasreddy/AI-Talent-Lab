/**
 * components/common/Chip.jsx
 * Pill-shaped status / tag chip with optional leading dot.
 * Replaces ad-hoc inline-styled spans across the app.
 * Spec: docs/design/00_design_system.md §5.
 *
 * NOTE: pipeline *status* badges stay in <StatusBadge> (the single source of
 * pipeline color truth). <Chip> is for everything else (tags, generic labels,
 * semantic states).
 *
 * Usage: <Chip variant="success" dot>Approved</Chip>
 */

// Hex fallbacks match the design tokens exactly, so chips render correctly even
// where the v3 CSS vars aren't wired into globals.css yet.
const VARIANTS = {
  primary: { color: 'var(--color-primary, #0D9488)', bg: 'var(--color-primary-bg, rgba(13,148,136,0.12))' },
  success: { color: 'var(--color-success, #10B981)', bg: 'rgba(16,185,129,0.12)' },
  warning: { color: 'var(--color-warning, #D97706)', bg: 'rgba(217,119,6,0.12)' },
  danger:  { color: 'var(--color-danger, #EF4444)',  bg: 'rgba(239,68,68,0.12)' },
  info:    { color: 'var(--color-info, #3B82F6)',    bg: 'rgba(59,130,246,0.12)' },
  neutral: { color: 'var(--color-text-secondary, #94A3B8)', bg: 'rgba(148,163,184,0.12)' },
}

const SIZES = {
  xs: { fontSize: '11px', padding: '2px 7px', gap: '4px' },
  sm: { fontSize: '12px', padding: '3px 9px', gap: '5px' },
  md: { fontSize: '13px', padding: '4px 11px', gap: '6px' },
}

export default function Chip({ variant = 'neutral', dot = false, size = 'sm', children, style, ...rest }) {
  const v = VARIANTS[variant] || VARIANTS.neutral
  const s = SIZES[size] || SIZES.sm
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 600,
        lineHeight: 1.4,
        borderRadius: '9999px',
        color: v.color,
        background: v.bg,
        border: `1px solid ${v.color}33`,
        ...s,
        ...style,
      }}
      {...rest}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: v.color }} />}
      {children}
    </span>
  )
}
