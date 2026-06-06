/**
 * Positions/PositionHero.jsx — v3 position hero header
 * Title, status chip, meta line (dept · location · comp · days open · owner),
 * tags row, action buttons (Share, Run Search, Add Candidate).
 * Per docs/design/pages/03_position_detail.md §3.
 */
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Chip from '../common/Chip'
import Icon from '../common/Icon'
import { useAuth } from '../../context/AuthContext'
import OriginalRequestDrawer from './OriginalRequestDrawer'
import ConfirmModal from '../common/ConfirmModal'
import Toast from '../common/Toast'

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
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  const canEditStatus = ['org_head', 'hr', 'dept_admin'].includes(user?.role) || user?.id === position?.created_by || user?.id === position?.assigned_to

  const handleStatusClick = (newStatus) => {
    if (newStatus === position.status) return
    setPendingStatus(newStatus)
    setStatusModalOpen(true)
  }

  const handleStatusConfirm = () => {
    if (pendingStatus) {
      onStatusChange(pendingStatus)
      setToastMessage(`Position status updated to ${STATUS_CHIP[pendingStatus]?.label || pendingStatus}`)
      setPendingStatus(null)
    }
  }
  const status = position.approval_status === 'pending'
    ? { variant: 'warning', label: 'Pending Review' }
    : STATUS_CHIP[position.status] || STATUS_CHIP.draft
  const priority = PRIORITY_CHIP[position.priority] || PRIORITY_CHIP.normal

  const comp = compRange(position.salary_min || position.comp_min, position.salary_max || position.comp_max)

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

      <div className="pd-hero-main">
        <div className="pd-hero-left">
          <div className="pd-hero-title-row">
            <h1 className="pd-hero-title">{position.role_name}</h1>
            <button className="pd-hero-info-btn" onClick={() => setDrawerOpen(true)} title="View Original Request">
              <Icon name="info" size={16} />
            </button>
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
        <div className="pd-hero-right">
          {canEditStatus ? (
            <select
              className="pd-status-select"
              value={position.status || 'draft'}
              onChange={(e) => handleStatusClick(e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="open">Active (Open)</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          ) : (
            <div className="pd-status-locked">
              <Icon name="lock" size={14} /> {status.label}
            </div>
          )}

          <div className="pd-hero-actions">
            <button className="pd-btn pd-btn-outline" title="Share Position">
              <Icon name="share" size={14} />
              Share
            </button>
            <button className="pd-btn pd-btn-outline" title="Add Candidate Manually">
              <Icon name="user-plus" size={14} />
              Add Candidate
            </button>
            {position.status === 'open' && (
              <button
                className="pd-btn pd-btn-primary"
                onClick={onSearchNow}
                disabled={searching}
              >
                {searching ? <Icon name="loader" size={14} className="spin" /> : <Icon name="search" size={14} />}
                {searching ? 'Sourcing...' : 'Run Search'}
              </button>
            )}
          </div>
          {searchMsg && <div className="pd-search-msg">{searchMsg}</div>}
        </div>
      </div>

      {drawerOpen && (
        <OriginalRequestDrawer
          position={position}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      <ConfirmModal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onConfirm={handleStatusConfirm}
        title="Confirm Status Change"
        message={`Are you sure you want to change the position status to '${STATUS_CHIP[pendingStatus]?.label}'? This may affect candidates and automated search workflows.`}
        confirmText="Yes, Change Status"
        confirmVariant={pendingStatus === 'closed' || pendingStatus === 'archived' ? 'danger' : 'primary'}
      />

      <Toast 
        message={toastMessage} 
        onClose={() => setToastMessage(null)} 
        type="success" 
      />
    </div>
  )
}
