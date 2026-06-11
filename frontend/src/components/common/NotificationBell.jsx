/**
 * NotificationBell.jsx — v3 Right-Slide Drawer + Grouped Notifications
 * Redesigned 2026-05-29.
 *
 * Bell button → right drawer (not dropdown) → grouped by type → mark-read
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../../utils/api'
import { timeAgo } from '../../utils/date'
import Icon from './Icon'
import './NotificationBell.css'

const TYPE_META = {
  search_complete:       { icon: 'cpu',      label: 'AI Activity',    color: '#0D9488' },
  candidate_selected:    { icon: 'check',    label: 'Selections',     color: '#10B981' },
  application_received:  { icon: 'file-text',label: 'Applications',   color: '#3B82F6' },
  interview_scheduled:   { icon: 'calendar', label: 'Interviews',     color: '#6366F1' },
  feedback_submitted:    { icon: 'award',    label: 'Feedback',       color: '#D97706' },
  status_changed:        { icon: 'activity', label: 'Status Updates', color: '#06B6D4' },
  rejection_draft_ready: { icon: 'mail',     label: 'Rejection Draft',color: '#64748B' },
  debrief_ready:         { icon: 'file-text',label: 'Debrief',        color: '#8B5CF6' },
}

export default function NotificationBell() {
  const [data, setData] = useState({ notifications: [], unread_count: 0 })
  const [open, setOpen] = useState(false)
  const drawerRef = useRef(null)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const result = await notificationsApi.list()
      setData(result)
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setData(prev => ({
        ...prev,
        notifications: prev.notifications.map(n => ({ ...n, is_read: true })),
        unread_count: 0,
      }))
    } catch {}
  }

  const handleMarkRead = async (id) => {
    try {
      await notificationsApi.markRead(id)
      setData(prev => ({
        notifications: prev.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
        unread_count: Math.max(0, prev.unread_count - 1),
      }))
    } catch {}
  }

  // Group notifications by type
  const grouped = {}
  data.notifications.forEach(n => {
    const type = n.type || 'other'
    if (!grouped[type]) grouped[type] = []
    grouped[type].push(n)
  })

  return (
    <>
      {/* Bell Button */}
      <button
        className="notif-bell-btn"
        onClick={() => { setOpen(p => !p); if (!open) load() }}
        aria-label="Notifications"
      >
        <Icon name="bell" size={18} />
        {data.unread_count > 0 && (
          <span className="notif-badge">{data.unread_count > 99 ? '99+' : data.unread_count}</span>
        )}
      </button>

      {/* Backdrop + Drawer */}
      {open && createPortal(
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-drawer" ref={drawerRef}>
            {/* Drawer Header */}
            <div className="notif-drawer-header">
              <h2 className="notif-drawer-title">Notifications</h2>
              <div className="notif-drawer-actions">
                {data.unread_count > 0 && (
                  <button className="notif-mark-all" onClick={handleMarkAllRead}>
                    Mark all read
                  </button>
                )}
                <button className="notif-close-btn" onClick={() => setOpen(false)}>
                  <Icon name="x" size={16} />
                </button>
              </div>
            </div>

            {/* Unread count banner */}
            {data.unread_count > 0 && (
              <div className="notif-unread-banner">
                <Icon name="bell" size={14} />
                <span>{data.unread_count} unread notification{data.unread_count !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Grouped list */}
            <div className="notif-drawer-body">
              {data.notifications.length === 0 ? (
                <div className="notif-empty">
                  <Icon name="bell" size={32} style={{ opacity: 0.12 }} />
                  <p>No notifications yet</p>
                  <span>You're all caught up!</span>
                </div>
              ) : (
                Object.entries(grouped).map(([type, items]) => {
                  const meta = TYPE_META[type] || { icon: 'bell', label: type.replace(/_/g, ' '), color: '#64748B' }
                  const unreadInGroup = items.filter(n => !n.is_read).length
                  return (
                    <div key={type} className="notif-group">
                      <div className="notif-group-header">
                        <span className="notif-group-icon" style={{ color: meta.color }}>
                          <Icon name={meta.icon} size={13} />
                        </span>
                        <span className="notif-group-label">{meta.label}</span>
                        {unreadInGroup > 0 && (
                          <span className="notif-group-count">{unreadInGroup}</span>
                        )}
                      </div>
                      {items.map(n => (
                        <div
                          key={n.id}
                          className={`notif-item ${n.is_read ? '' : 'unread'}`}
                          onClick={() => {
                            if (!n.is_read) handleMarkRead(n.id)
                            if (n.action_url) {
                              setOpen(false)
                              if (n.action_url.startsWith('http')) {
                                window.open(n.action_url, '_blank', 'noopener,noreferrer')
                              } else {
                                navigate(n.action_url)
                              }
                            }
                          }}
                        >
                          <div className="notif-item-body">
                            <div className="notif-item-title">{n.title}</div>
                            <div className="notif-item-msg">{n.message}</div>
                          </div>
                          <div className="notif-item-meta">
                            <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                            {!n.is_read && <span className="notif-unread-dot" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
