/**
 * components/common/Stat.jsx
 * Stat card with a left accent bar and optional delta line.
 * Used in dashboard hero, analytics KPI strip, position detail stage strip.
 * Spec: docs/design/00_design_system.md §5.
 *
 * Usage:
 *   <Stat label="Open positions" value={12} />
 *   <Stat label="Time to fill" value="18d" delta={{ value: '-3d', direction: 'down', good: true }} accent="#3B82F6" />
 */

export default function Stat({
  label,
  value,
  delta,            // { value: string, direction: 'up'|'down', good?: boolean } | string
  accent = 'var(--color-primary, #0D9488)',
  icon = null,      // optional <Icon> element
  style,
  ...rest
}) {
  // Delta color: explicit `good` wins; otherwise up=positive(green), down=red.
  let deltaColor = 'var(--color-text-secondary, #94A3B8)'
  let deltaText = delta
  if (delta && typeof delta === 'object') {
    deltaText = delta.value
    const good = delta.good ?? delta.direction === 'up'
    deltaColor = good ? 'var(--color-success, #10B981)' : 'var(--color-danger, #EF4444)'
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '16px 16px 16px 18px',
        background: 'var(--color-bg-card, #111827)',
        border: '1px solid var(--color-border, #1E3047)',
        borderRadius: 'var(--radius-lg, 12px)',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.02em', color: 'var(--color-text-secondary, #94A3B8)' }}>
          {label}
        </span>
        {icon && <span style={{ color: accent, display: 'inline-flex' }}>{icon}</span>}
      </div>
      <span style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.1, color: 'var(--color-text-primary, #F1F5F9)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      {delta != null && (
        <span style={{ fontSize: '12px', fontWeight: 600, color: deltaColor }}>{deltaText}</span>
      )}
    </div>
  )
}
