import React from 'react'
import Chip from '../common/Chip'
import Icon from '../common/Icon'
import SparklineApplicants from './SparklineApplicants'
import StagePipeStrip from './StagePipeStrip'
import { positionsApi } from '../../utils/api'
import { timeAgo } from '../../utils/date'

const PRIORITY_CHIP = {
  urgent: { variant: 'danger',  label: 'Urgent' },
  high:   { variant: 'warning', label: 'High' },
}

const STATUS_CHIP = {
  open:     'success',
  draft:    'neutral',
  on_hold:  'warning',
  closed:   'neutral',
  archived: 'neutral',
}

function daysOpen(iso) {
  if (!iso) return 0
  const ds = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z'
  return Math.floor((Date.now() - new Date(ds).getTime()) / 86400000)
}

function getCardState(position) {
  if (position.status === 'closed' || position.status === 'archived') return 'closed'
  if (position.status === 'draft') return 'draft'
  const stageCounts = position.stageCounts || {}
  if ((stageCounts.interview || 0) > 0) return 'hot'
  if (position.last_search_at) {
    const ds = position.last_search_at.endsWith('Z') || position.last_search_at.includes('+') 
      ? position.last_search_at 
      : position.last_search_at + 'Z'
    const daysSince = (Date.now() - new Date(ds).getTime()) / 86400000
    if (daysSince > 7) return 'stalled'
  } else if (position.status === 'open') {
    return 'stalled'
  }
  return 'healthy'
}

const BORDER_BY_STATE = {
  stalled: '4px solid rgba(239,68,68,.4)',
  hot:     '4px solid rgba(245,158,11,.4)',
  draft:   '2px dashed #94A3B8',
  closed:  'none',
  healthy: '4px solid rgba(13,148,136,.3)',
}

export default function PositionCard({ position, onOpen }) {
  const state = getCardState(position)
  const priorityChip = PRIORITY_CHIP[position.priority]
  const statusVariant = STATUS_CHIP[position.status] || 'neutral'

  const comp = (position.comp_min && position.comp_max)
    ? `${(position.comp_min / 100000).toFixed(0)}-${(position.comp_max / 100000).toFixed(0)}L`
    : null

  const metaParts = [
    position.department_name,
    position.location,
    comp,
    `${daysOpen(position.created_at)}d open`,
  ].filter(Boolean)

  function handleRunNow(e) {
    e.stopPropagation()
    positionsApi.searchNow(position.id).catch(() => {})
  }

  function handleOpen(e) {
    e.stopPropagation()
    onOpen(position.id)
  }

  const statusLabel = position.status === 'on_hold'
    ? 'On Hold'
    : position.status.charAt(0).toUpperCase() + position.status.slice(1)

  return (
    <div
      className="position-card"
      style={{
        borderLeft: BORDER_BY_STATE[state],
        opacity: state === 'closed' ? 0.72 : 1,
      }}
      onClick={() => onOpen(position.id)}
    >
      {/* Header */}
      <div className="position-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="position-card-title">{position.role_name}</span>
          <Chip variant={statusVariant} dot size="xs">
            {statusLabel}
          </Chip>
        </div>
        {priorityChip && (
          <Chip variant={priorityChip.variant} size="xs">{priorityChip.label}</Chip>
        )}
      </div>

      {/* Meta line */}
      <div className="position-card-meta">
        {metaParts.join(' · ')}
        <span style={{ marginLeft: 8, color: 'var(--text-tertiary, #64748B)', fontSize: 11 }}>
          PLT-{position.id}
        </span>
      </div>

      {/* Sparkline */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #94A3B8)', marginBottom: 4 }}>
          Daily applications · last 30 days
        </div>
        <SparklineApplicants data={position.sparklineData || []} />
      </div>

      {/* Stage strip */}
      <StagePipeStrip counts={position.stageCounts || {}} />

      {/* Footer */}
      <div className="position-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="zap" size={12} style={{ color: 'var(--color-primary, #0D9488)' }} />
          <span>
            {position.last_search_at
              ? `AI sourcing · last run ${timeAgo(position.last_search_at)}`
              : 'AI sourcing not yet configured'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {position.status === 'open' && (
            <button className="btn-ghost-xs" onClick={handleRunNow}>Run now</button>
          )}
          <button className="btn-ghost-xs btn-primary-ghost" onClick={handleOpen}>Open</button>
        </div>
      </div>

      {/* Stalled warning */}
      {state === 'stalled' && (
        <div style={{
          marginTop: 8,
          padding: '6px 10px',
          background: 'rgba(239,68,68,0.08)',
          borderRadius: 6,
          fontSize: 11,
          color: '#EF4444',
        }}>
          AI search paused · JD may be too narrow
        </div>
      )}
    </div>
  )
}
