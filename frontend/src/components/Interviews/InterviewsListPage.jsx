/**
 * InterviewsListPage.jsx – All interviews across all positions
 * Shows upcoming, today's, and past interviews with filtering.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { interviewsApi } from '../../utils/api'
import './InterviewsListPage.css'

const STATUS_MAP = {
  pending: { label: 'Pending', color: '#f59e0b' },
  scheduled: { label: 'Scheduled', color: '#3b82f6' },
  completed: { label: 'Completed', color: '#22c55e' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
  no_show: { label: 'No Show', color: '#64748b' },
}

const TABS = ['upcoming', 'today', 'past', 'all']

export default function InterviewsListPage() {
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [search, setSearch] = useState('')
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

  const filtered = interviews.filter(iv => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      iv.candidate_name?.toLowerCase().includes(q) ||
      iv.role_name?.toLowerCase().includes(q) ||
      iv.round_name?.toLowerCase().includes(q)
    )
  })

  const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  const formatTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="interviews-page">
      <header className="interviews-header">
        <div>
          <h1>Interviews</h1>
          <p className="interviews-subtitle">
            {interviews.length} interview{interviews.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="interviews-search">
          <input
            type="text"
            placeholder="Search candidates, roles…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </header>

      {/* Tabs */}
      <div className="interviews-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`interviews-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="interviews-loading">
          <div className="interviews-skeleton" /><div className="interviews-skeleton" />
          <div className="interviews-skeleton" /><div className="interviews-skeleton" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="interviews-empty">
          <span className="interviews-empty-icon">🎙</span>
          <h3>{search ? 'No matching interviews' : 'No interviews yet'}</h3>
          <p>
            {search
              ? 'Try a different search term.'
              : 'Interviews will appear here when you schedule them from the candidate pipeline.'}
          </p>
        </div>
      ) : (
        <div className="interviews-list">
          {filtered.map(iv => {
            const status = STATUS_MAP[iv.status] || STATUS_MAP.pending
            return (
              <div
                key={iv.id}
                className="interview-card"
                onClick={() => navigate(`/positions/${iv.position_id}?tab=candidates`)}
              >
                <div className="iv-card-left">
                  <div className="iv-card-avatar">
                    {(iv.candidate_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="iv-card-info">
                    <h4 className="iv-card-name">{iv.candidate_name || 'Unknown'}</h4>
                    <p className="iv-card-role">
                      {iv.role_name || 'Position'} · {iv.round_name || `Round ${iv.round_number}`}
                    </p>
                    <p className="iv-card-type">{iv.round_type}</p>
                  </div>
                </div>
                <div className="iv-card-center">
                  <span className="iv-card-date">{formatDate(iv.scheduled_at)}</span>
                  <span className="iv-card-time">{formatTime(iv.scheduled_at)}</span>
                  {iv.duration_minutes && (
                    <span className="iv-card-duration">{iv.duration_minutes} min</span>
                  )}
                </div>
                <div className="iv-card-right">
                  <span
                    className="iv-card-status"
                    style={{ background: `${status.color}15`, color: status.color }}
                  >
                    {status.label}
                  </span>
                  {iv.panel_count != null && (
                    <span className="iv-card-panel">
                      {iv.feedback_count || 0}/{iv.panel_count} feedback
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
