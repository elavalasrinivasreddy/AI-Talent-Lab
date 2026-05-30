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

const KIND_COLORS = {
  bad:  'var(--color-danger, #EF4444)',
  warn: 'var(--color-warning, #D97706)',
  ok:   'var(--color-primary, #0D9488)',
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
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
        <span className="tb-row-title">{row.title}</span>
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
