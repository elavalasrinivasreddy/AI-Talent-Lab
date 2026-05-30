/**
 * InterviewsListPage.jsx — v3 Calendar-First Interview Hub
 * Route: /interviews
 * Redesigned 2026-05-29.
 *
 * Layout: header → day-selector strip → day timeline → list fallback
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { interviewsApi } from '../../utils/api'
import Icon from '../common/Icon'
import Chip from '../common/Chip'
import './InterviewsListPage.css'

const STATUS_MAP = {
  pending:   { label: 'Pending',   variant: 'warning' },
  scheduled: { label: 'Scheduled', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  no_show:   { label: 'No Show',   variant: 'neutral' },
}

const TABS = [
  { key: 'upcoming', label: 'Upcoming', icon: 'calendar' },
  { key: 'today',    label: 'Today',    icon: 'clock' },
  { key: 'past',     label: 'Past',     icon: 'check' },
  { key: 'all',      label: 'All',      icon: 'layers' },
]

export default function InterviewsListPage() {
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await interviewsApi.list({ filter: tab })
      setInterviews(data.interviews || [])
    } catch (err) {
      console.error('Failed to load interviews:', err)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return interviews.filter(iv => {
      if (search) {
        const q = search.toLowerCase()
        if (!(iv.candidate_name?.toLowerCase().includes(q) ||
              iv.role_name?.toLowerCase().includes(q) ||
              iv.round_name?.toLowerCase().includes(q))) return false
      }
      if (selectedDate) {
        const ivDate = iv.scheduled_at ? new Date(iv.scheduled_at).toDateString() : null
        if (ivDate !== selectedDate.toDateString()) return false
      }
      return true
    })
  }, [interviews, search, selectedDate])

  // Generate day-selector for next/past 7 days
  const dayCells = useMemo(() => {
    const today = new Date()
    const cells = []
    const offset = tab === 'past' ? -7 : -1
    const end = tab === 'past' ? 0 : 6
    for (let i = offset; i <= end; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const count = interviews.filter(iv => {
        if (!iv.scheduled_at) return false
        return new Date(iv.scheduled_at).toDateString() === d.toDateString()
      }).length
      cells.push({ date: new Date(d), count, isToday: d.toDateString() === today.toDateString() })
    }
    return cells
  }, [interviews, tab])

  // Group filtered by time slot
  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach(iv => {
      const key = iv.scheduled_at
        ? new Date(iv.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : 'Unscheduled'
      if (!groups[key]) groups[key] = []
      groups[key].push(iv)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const todayCount = interviews.filter(iv => {
    if (!iv.scheduled_at) return false
    return new Date(iv.scheduled_at).toDateString() === new Date().toDateString()
  }).length
  const pendingFeedback = interviews.filter(iv => iv.status === 'completed' && iv.feedback_count < iv.panel_count).length

  return (
    <div className="iv-page">
      {/* Header */}
      <div className="iv-header">
        <div className="iv-header-left">
          <div className="iv-header-icon"><Icon name="calendar" size={18} /></div>
          <div>
            <h1 className="iv-header-title">Interviews</h1>
            <p className="iv-header-sub">
              {todayCount} today · {pendingFeedback > 0 && `${pendingFeedback} awaiting feedback · `}
              {interviews.length} total
            </p>
          </div>
        </div>
        <div className="iv-header-actions">
          <div className="iv-search">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="Search candidates, roles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="iv-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`iv-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => { setTab(t.key); setSelectedDate(null) }}
          >
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Day Selector Strip */}
      <div className="iv-day-strip">
        <button
          className={`iv-day-cell ${!selectedDate ? 'active' : ''}`}
          onClick={() => setSelectedDate(null)}
        >
          <span className="iv-day-label">All</span>
          <span className="iv-day-count">{interviews.length}</span>
        </button>
        {dayCells.map((cell, i) => (
          <button
            key={i}
            className={`iv-day-cell ${selectedDate?.toDateString() === cell.date.toDateString() ? 'active' : ''} ${cell.isToday ? 'today' : ''}`}
            onClick={() => setSelectedDate(cell.date)}
          >
            <span className="iv-day-dow">{cell.date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
            <span className="iv-day-num">{cell.date.getDate()}</span>
            {cell.count > 0 && <span className="iv-day-dot">{cell.count}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <InterviewSkeleton />
      ) : filtered.length === 0 ? (
        <div className="iv-empty">
          <Icon name="calendar" size={40} style={{ opacity: 0.12 }} />
          <h3>{search ? 'No matching interviews' : 'No interviews scheduled'}</h3>
          <p>{search ? 'Try a different search.' : 'Schedule interviews from the candidate pipeline.'}</p>
        </div>
      ) : (
        <div className="iv-timeline">
          {grouped.map(([time, items]) => (
            <div key={time} className="iv-time-group">
              <div className="iv-time-label">
                <Icon name="clock" size={12} />
                {time}
              </div>
              <div className="iv-time-cards">
                {items.map(iv => (
                  <InterviewCard key={iv.id} iv={iv} navigate={navigate} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InterviewCard({ iv, navigate }) {
  const status = STATUS_MAP[iv.status] || STATUS_MAP.pending
  const hasTime = !!iv.scheduled_at

  return (
    <div
      className="iv-card"
      onClick={() => navigate(`/positions/${iv.position_id}?tab=candidates`)}
    >
      <div className="iv-card-left">
        <div className="iv-card-avatar" style={{ background: `hsl(${(iv.candidate_id || 42) * 47 % 360}, 55%, 45%)` }}>
          {(iv.candidate_name || '?')[0].toUpperCase()}
        </div>
        <div className="iv-card-info">
          <h4 className="iv-card-name">{iv.candidate_name || 'Unknown'}</h4>
          <p className="iv-card-role">
            {iv.role_name || 'Position'} · {iv.round_name || `Round ${iv.round_number || '—'}`}
          </p>
          {iv.round_type && <span className="iv-card-type">{iv.round_type}</span>}
        </div>
      </div>

      <div className="iv-card-center">
        {hasTime && (
          <>
            <span className="iv-card-date">
              {new Date(iv.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <span className="iv-card-time">
              {new Date(iv.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
        {iv.duration_minutes && (
          <span className="iv-card-duration"><Icon name="clock" size={10} /> {iv.duration_minutes}m</span>
        )}
      </div>

      <div className="iv-card-right">
        <Chip variant={status.variant} size="xs">{status.label}</Chip>
        {iv.panel_count != null && (
          <span className="iv-card-panel">
            {iv.feedback_count || 0}/{iv.panel_count} feedback
          </span>
        )}
      </div>
    </div>
  )
}

function InterviewSkeleton() {
  return (
    <div className="iv-skel">
      {[1,2,3,4].map(i => <div key={i} className="skeleton-block" style={{ height: 72, borderRadius: 12 }} />)}
    </div>
  )
}
