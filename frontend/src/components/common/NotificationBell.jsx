/**
 * components/common/NotificationBell.jsx
 * Notification bell with unread count badge, dropdown list.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { notificationsApi } from '../../utils/api'
import './NotificationBell.css'

export default function NotificationBell() {
  const [data, setData] = useState({ notifications: [], unread_count: 0 })
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const load = useCallback(async () => {
    try {
      const result = await notificationsApi.list()
      setData(result)
    } catch { /* ignore — bell is non-critical */ }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setData(prev => ({
        ...prev,
        notifications: prev.notifications.map(n => ({ ...n, is_read: true })),
        unread_count: 0
      }))
    } catch {}
  }

  const handleMarkRead = async (id) => {
    try {
      await notificationsApi.markRead(id)
      setData(prev => ({
        notifications: prev.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
        unread_count: Math.max(0, prev.unread_count - 1)
      }))
    } catch {}
  }

  const ICONS = {
    search_complete: '🤖',
    candidate_selected: '⭐',
    application_received: '📝',
    interview_scheduled: '📅',
    feedback_submitted: '📋',
  }

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button
        className="notif-bell-btn"
        onClick={() => { setOpen(p => !p); if (!open) load() }}
        aria-label="Notifications"
      >
        🔔
        {data.unread_count > 0 && (
          <span className="notif-badge">{data.unread_count > 99 ? '99+' : data.unread_count}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">Notifications</span>
            {data.unread_count > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {data.notifications.length === 0 ? (
              <div className="notif-empty">No notifications yet</div>
            ) : (
              data.notifications.map(n => (
                <div
                  key={n.id}
                  className={`notif-item ${n.is_read ? '' : 'unread'}`}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                >
                  <span className="notif-item-icon">{ICONS[n.type] || '📌'}</span>
                  <div className="notif-item-body">
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-msg">{n.message}</div>
                    <div className="notif-item-time">
                      {new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!n.is_read && <span className="notif-unread-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
