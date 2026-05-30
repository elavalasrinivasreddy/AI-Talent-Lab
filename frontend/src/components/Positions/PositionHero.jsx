/**
 * Positions/PositionHero.jsx — v3 position hero header
 * Title, status chip, meta line (dept · location · comp · days open · owner),
 * tags row, action buttons (Share, Run Search, Add Candidate).
 * Per docs/design/pages/03_position_detail.md §3.
 */
import React from 'react'
import { Link } from 'react-router-dom'
import Chip from '../common/Chip'
import Icon from '../common/Icon'

const PRIORITY_CHIP = {
  urgent: { variant: 'danger',  label: 'Urgent' },
  high:   { variant: 'warning', label: 'High' },
  normal: { variant: 'primary', label: 'Normal' },
  low:    { variant: 'neutral', label: 'Low' },
}

const STATUS_CHIP = {
  open:     { variant: 'success', label: 'Active' },
  draft:    { variant: 'neutral', label: 'Draft' },
  on_hold:  { variant: 'warning', label: 'On Hold' },
  closed:   { variant: 'danger',  label: 'Closed' },
  archived: { variant: 'neutral', label: 'Archived' },
}

function daysOpen(iso) {
  if (!iso) return '?'
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function compRange(min, max) {
  if (!min && !max) return null
  const fmt = v => v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${v?.toLocaleString()}`
  if (min && max) return `${fmt(min)}–${fmt(max)}`
  return min ? `${fmt(min)}+` : `Up to ${fmt(max)}`
}

export default function PositionHero({
  position,
  searching,
  searchMsg,
  onSearchNow,
  onStatusChange,
}) {
  const status = STATUS_CHIP[position.status] || STATUS_CHIP.draft
  const priority = PRIORITY_CHIP[position.priority] || PRIORITY_CHIP.normal

  const comp = compRange(position.comp_min, position.comp_max)

  const metaParts = [
    position.department_name,
    position.location,
    position.work_type && position.work_type !== 'onsite' ? position.work_type : null,
    comp,
    `${daysOpen(position.created_at)}d open`,
    position.assigned_to_name ? `by ${position.assigned_to_name}` : null,
  ].filter(Boolean)

  // Tags from JD (if available)
  const tags = []
  if (position.jd_content) tags.push('AI-generated JD')
  if (position.work_type === 'remote') tags.push('Remote-friendly')
  if (position.priority === 'urgent') tags.push('Urgent hire')

  return (
    <div className="pd-hero">
      <Link to="/positions" className="pd-breadcrumb">
        <Icon name="chevron-right" size={12} style={{ transform: 'rotate(180deg)' }} />
        Positions
      </Link>
      <span className="pd-breadcrumb-sep">›</span>
      <span className="pd-breadcrumb-current">{position.role_name}</span>

      <div className="pd-hero-main">
        <div className="pd-hero-left">
          <div className="pd-hero-title-row">
            <h1 className="pd-hero-title">{position.role_name}</h1>
            <Chip variant={status.variant} dot size="sm">{status.label}</Chip>
          </div>

          <div className="pd-hero-meta">
            {metaParts.map((p, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="pd-meta-dot">·</span>}
                <span>{p}</span>
              </React.Fragment>
            ))}
          </div>

          {tags.length > 0 && (
            <div className="pd-hero-tags">
              {tags.map(t => (
                <Chip key={t} variant="primary" size="xs">{t}</Chip>
              ))}
              <span className="pd-hero-headcount">
                <Icon name="users" size={13} />
                Headcount: {position.headcount || 1}
              </span>
            </div>
          )}
        </div>

        <div className="pd-hero-actions">
          <button
            className="pd-btn pd-btn-outline"
            onClick={onSearchNow}
            disabled={searching || position.status !== 'open'}
          >
            <Icon name="search" size={14} />
            {searching ? 'Searching…' : 'Run Search'}
          </button>

          <select
            className="pd-status-select"
            value={position.status}
            onChange={e => onStatusChange(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="on_hold">On Hold</option>
            <option value="closed">Close</option>
            <option value="archived">Archive</option>
          </select>
        </div>
      </div>

      {searchMsg && <div className="pd-search-toast">{searchMsg}</div>}

      {/* Approval banner */}
      {position.approval_status === 'pending' && (
        <div className="pd-approval-banner">
          <Icon name="clock" size={14} />
          <span>
            <strong>Awaiting team-lead approval.</strong> Candidate sourcing is paused until the JD is approved.
          </span>
        </div>
      )}
    </div>
  )
}
