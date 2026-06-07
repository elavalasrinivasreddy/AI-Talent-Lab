/**
 * components/common/StatusBadge.jsx
 * ONLY place pipeline status color logic lives. Never define status colors elsewhere.
 * Per docs/architecture/05_frontend.md §10 rule.
 *
 * Palette reconciliation: the component reads CSS custom properties
 * (--color-stage-*) from globals.css as the primary source, falling back to
 * the hex values in PIPELINE_STAGES / POSITION_STATUSES constants.
 * This keeps design-token edits in globals.css automatically reflected here.
 */
import { PIPELINE_STAGES, POSITION_STATUSES } from '../../utils/constants'

/**
 * Maps pipeline stage keys to the CSS custom property name defined in globals.css.
 * If a var isn't defined the fallback hex from constants.js kicks in via the
 * `var(--token, #hex)` pattern used in the inline style.
 */
const STAGE_CSS_VARS = {
  sourced:   '--color-stage-sourced',
  emailed:   '--color-stage-emailed',
  applied:   '--color-stage-applied',
  screening: '--color-stage-screening',
  interview: '--color-stage-interview',
  offer:     '--color-stage-offer',
  selected:  '--color-stage-selected',
  rejected:  '--color-stage-rejected',
}

export default function StatusBadge({ status, type = 'pipeline', size = 'sm' }) {
  const config =
    type === 'pipeline'
      ? PIPELINE_STAGES[status] || { label: status, color: 'var(--color-text-muted, #9ca3af)', bg: 'rgba(156,163,175,0.12)' }
      : POSITION_STATUSES[status] || { label: status, color: 'var(--color-text-muted, #9ca3af)' }

  // Prefer design-system CSS var; fall back to constants.js hex.
  const cssVar = type === 'pipeline' ? STAGE_CSS_VARS[status] : null
  const colorValue = cssVar
    ? `var(${cssVar}, ${config.color})`
    : config.color

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
      color: colorValue,
      background: bg,
      border: `1px solid ${config.color}33`,
      ...sizes[size],
    }}>
      {config.label}
    </span>
  )
}
