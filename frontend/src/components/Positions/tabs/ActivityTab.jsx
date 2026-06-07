/**
 * ActivityTab.jsx – Vertical timeline of all pipeline events for this position.
 */
import React, { useState, useEffect } from 'react'
import { dashboardApi } from '../../../utils/api'
import { PIPELINE_EVENT_ICONS } from '../../../utils/constants'
import Icon from '../../common/Icon'
import './ActivityTab.css'

export default function ActivityTab({ position }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!position?.id) return;
    
    dashboardApi.getActivity(position.id).then(data => {
      let fetchedEvents = data.events || [];
      
      // Infer "Hire Request & Position Created" event if not explicitly present
      const hasCreation = fetchedEvents.some(e => e.event_type === 'position_created');
      if (!hasCreation && position.created_at) {
        fetchedEvents.push({
          id: 'inferred-creation',
          event_type: 'position_created',
          created_at: position.created_at,
          user_name: position.created_by_name || 'System',
          event_data: {
            details: 'Hire Request Approved and JD Generated'
          }
        });
      }
      
      // Sort descending (newest first)
      fetchedEvents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      setEvents(fetchedEvents)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [position?.id])

  if (loading) return (
    <div className="act-skeleton">
      {[1,2,3].map(i => (
        <div key={i} className="skeleton-block" style={{ height: 80, borderRadius: 8 }} />
      ))}
    </div>
  )

  if (!events.length) {
    return (
      <div className="act-empty">
        <Icon name="clock" size={48} color="var(--color-text-muted)" />
        <h3>No Activity Yet</h3>
        <p>Events will appear here as candidates move through the pipeline.</p>
      </div>
    )
  }

  return (
    <div className="act-timeline">
      {events.map((evt, idx) => {
        // Special case icon
        let icon = PIPELINE_EVENT_ICONS[evt.event_type] || '📌'
        if (evt.event_type === 'position_created') icon = '✨'
        
        const data = evt.event_data || {}
        const ts = new Date(evt.created_at)
        const dateStr = ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        const timeStr = ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

        return (
          <div key={evt.id || idx} className="act-event">
            <div className="act-node">{icon}</div>
            <div className="act-content-box">
              <div className="act-header">
                <div className="act-main">
                  <span className="act-type">{formatEventType(evt.event_type)}</span>
                  {evt.candidate_name && (
                    <span className="act-candidate"> — {evt.candidate_name}</span>
                  )}
                  {evt.user_name && (
                    <span className="act-user"> by {evt.user_name}</span>
                  )}
                </div>
                <div className="act-time-badge">
                  {dateStr} {timeStr}
                </div>
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
              {data.details && (
                <div className="act-detail">{data.details}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatEventType(type) {
  return (type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
