/**
 * BriefingRow.jsx
 * Single actionable row inside a BriefingLane.
 *
 * Props:
 *   row      — { id, title, meta_text, action_url, action_label, created_at, meta }
 *   kind     — 'bad' | 'warn' | 'ok'  → icon color tint
 *   onAction — optional click override (if absent, uses row.action_url via navigate)
 *
 * Layout: [icon] [title + meta] [right-aligned action label]
 */
import { useNavigate } from 'react-router-dom'
import Icon from '../common/Icon'
import { timeAgo } from '../../utils/date'

function formatEventTitle(t) {
  if (!t) return t
  return t
    .replace(/\bats\b/gi, 'ATS')
    .replace(/\bjd\b/gi, 'JD')
    .replace(/\bai\b/gi, 'AI')
    .replace(/\b\w/g, c => c.toUpperCase())
}

const KIND_COLORS = {
  bad:  'var(--color-danger, #EF4444)',
  warn: 'var(--color-warning, #D97706)',
  ok:   'var(--color-primary, #0D9488)',
}


export default function BriefingRow({ row, kind, onAction }) {
  const navigate = useNavigate()
  const color = KIND_COLORS[kind] || KIND_COLORS.ok
  const iconName = row.meta?.icon || 'cpu'
  const timeStr  = timeAgo(row.created_at)

  const handleAction = () => {
    if (onAction) { onAction(row); return }
    if (row.action_url) navigate(row.action_url)
  }

  return (
    <div className="tb-row">
      {/* Icon */}
      <span className="tb-row-icon" style={{ color }}>
        <Icon name={iconName} size={15} />
      </span>

      {/* Body */}
      <div className="tb-row-body">
        <span className="tb-row-title">{formatEventTitle(row.title)}</span>
        {(row.meta_text || timeStr) && (
          <span className="tb-row-meta">
            {row.meta_text}
            {row.meta_text && timeStr ? ' · ' : ''}
            {timeStr}
          </span>
        )}
      </div>

      {/* Action */}
      {(row.action_url || onAction) && (
        <button
          className="tb-row-action"
          style={{ color }}
          onClick={handleAction}
          type="button"
        >
          {row.action_label || 'View'}
        </button>
      )}
    </div>
  )
}
