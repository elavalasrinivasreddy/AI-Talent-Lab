/**
 * ActivityTab.jsx – Timeline of all pipeline events for this position.
 */
import React, { useState, useEffect } from 'react'
import { dashboardApi } from '../../../utils/api'
import { PIPELINE_EVENT_ICONS } from '../../../utils/constants'
import './ActivityTab.css'

export default function ActivityTab({ positionId }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.getActivity(positionId).then(data => {
      setEvents(data.events || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [positionId])

  if (loading) return (
    <div className="act-skeleton">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="skeleton-block" style={{ height: 62, borderRadius: 8, marginBottom: 8 }} />
      ))}
    </div>
  )

  if (!events.length) {
    return (
      <div className="act-empty">
        <span>📜</span>
        <h3>No Activity Yet</h3>
        <p>Events will appear here as candidates move through the pipeline.</p>
      </div>
    )
  }

  return (
    <div className="act-timeline">
      {events.map((evt, idx) => {
        const icon = PIPELINE_EVENT_ICONS[evt.event_type] || '📌'
        const data = evt.event_data || {}
        const ts = new Date(evt.created_at)
        const dateStr = ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        const timeStr = ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

        return (
          <div key={evt.id || idx} className="act-event">
            <div className="act-icon">{icon}</div>
            <div className="act-body">
              <div className="act-main">
                <span className="act-type">{formatEventType(evt.event_type)}</span>
                {evt.candidate_name && (
                  <span className="act-candidate"> — {evt.candidate_name}</span>
                )}
                {evt.user_name && (
                  <span className="act-user"> by {evt.user_name}</span>
                )}
              </div>
              {data.new_status && (
                <div className="act-detail">Moved to <strong>{data.new_status}</strong></div>
              )}
              {data.score != null && (
                <div className="act-detail">ATS Score: <strong>{Math.round(data.score)}%</strong></div>
              )}
              {data.candidates_found != null && (
                <div className="act-detail">
                  Found {data.candidates_found} candidates · {data.above_threshold} above threshold
                </div>
              )}
            </div>
            <div className="act-time">{dateStr} {timeStr}</div>
          </div>
        )
      })}
    </div>
  )
}

function formatEventType(type) {
  return (type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
