import React, { useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../utils/api'
import Icon from '../../common/Icon'
import Toast from '../../common/Toast'

export default function NotificationsTab() {
  const { user, setUser } = useAuth()
  
  // Default values or parsed from user preferences
  const defaultPrefs = user?.notification_preferences || {}
  
  const [preferences, setPreferences] = useState({
    email_critical: defaultPrefs.email_critical ?? true,
    email_digest: defaultPrefs.email_digest ?? false,
    email_mentions: defaultPrefs.email_mentions ?? true,
    email_ai_activity: defaultPrefs.email_ai_activity ?? false,
    inapp_all_events: defaultPrefs.inapp_all_events ?? true,
    inapp_status_changes: defaultPrefs.inapp_status_changes ?? false,
    inapp_ai_grouped: defaultPrefs.inapp_ai_grouped ?? true,
    quiet_start: defaultPrefs.quiet_start ?? '22:00',
    quiet_end: defaultPrefs.quiet_end ?? '07:00'
  })

  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const updatePreferences = async (newPrefs) => {
    const previous = { ...preferences }
    setPreferences(newPrefs)

    try {
      const res = await api.patch('/auth/profile', {
        notification_preferences: newPrefs
      })
      setUser(res.data.user)
      showToast('Notification preferences saved')
    } catch (err) {
      setPreferences(previous)
      showToast(err.message || 'Failed to save preferences', 'error')
    }
  }

  const handleToggle = (key) => {
    const newPrefs = { ...preferences, [key]: !preferences[key] }
    updatePreferences(newPrefs)
  }

  const handleTimeChange = (key, value) => {
    const newPrefs = { ...preferences, [key]: value }
    updatePreferences(newPrefs)
  }

  const ToggleRow = ({ prefKey, label, desc }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--color-border-light)' }}>
      <div>
        <h4 style={{ margin: '0 0 4px', fontSize: '15px', color: 'var(--color-text-primary)' }}>{label}</h4>
        {desc && <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>{desc}</p>}
      </div>
      <label className="toggle" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
        <input 
          type="checkbox" 
          style={{ display: 'none' }}
          checked={preferences[prefKey]}
          onChange={() => handleToggle(prefKey)}
        />
        <div style={{
          width: '44px',
          height: '24px',
          background: preferences[prefKey] ? 'var(--color-primary)' : 'var(--color-bg-alt)',
          borderRadius: '12px',
          position: 'relative',
          transition: 'all var(--transition-base)'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            background: 'white',
            borderRadius: '50%',
            position: 'absolute',
            top: '2px',
            left: preferences[prefKey] ? '22px' : '2px',
            transition: 'all var(--transition-base)',
            boxShadow: 'var(--shadow-sm)'
          }} />
        </div>
      </label>
    </div>
  )

  const timeOptions = [
    { value: '18:00', label: '6 PM' },
    { value: '19:00', label: '7 PM' },
    { value: '20:00', label: '8 PM' },
    { value: '21:00', label: '9 PM' },
    { value: '22:00', label: '10 PM' },
    { value: '23:00', label: '11 PM' },
    { value: '00:00', label: '12 AM' },
    { value: '01:00', label: '1 AM' },
    { value: '06:00', label: '6 AM' },
    { value: '07:00', label: '7 AM' },
    { value: '08:00', label: '8 AM' },
    { value: '09:00', label: '9 AM' },
    { value: '10:00', label: '10 AM' }
  ]

  return (
    <div className="settings-form relative">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Email Settings */}
        <div className="settings-card" style={{ padding: '24px', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="mail" size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Email</h3>
          </div>
          <div>
            <ToggleRow 
              prefKey="email_critical" 
              label="Critical alerts" 
              desc="Panel feedback overdue, candidate ghosts, etc." 
            />
            <ToggleRow 
              prefKey="email_digest" 
              label="Daily digest" 
              desc="One email summarizing pulse and pending items" 
            />
            <ToggleRow 
              prefKey="email_mentions" 
              label="Mentions in notes" 
              desc="When someone @tags you in a candidate note" 
            />
            <ToggleRow 
              prefKey="email_ai_activity" 
              label="AI activity summaries" 
              desc="Summaries of candidates sourced by AI" 
            />
          </div>
        </div>

        {/* In-App Settings */}
        <div className="settings-card" style={{ padding: '24px', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.1)', color: '#EC4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bell" size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>In-app (drawer)</h3>
          </div>
          <div>
            <ToggleRow 
              prefKey="inapp_all_events" 
              label="All event types" 
              desc="Receive notifications for major platform events" 
            />
            <ToggleRow 
              prefKey="inapp_status_changes" 
              label="Status changes" 
              desc="Alerts for minor status transitions (Warning: can be very noisy)" 
            />
            <ToggleRow 
              prefKey="inapp_ai_grouped" 
              label="AI activity grouped" 
              desc="Bundle multiple AI sourcing events into a single notification (Recommended)" 
            />
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="settings-card" style={{ padding: '24px', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="moon" size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Quiet hours</h3>
          </div>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Mute all email and in-app notifications during these hours.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>from</span>
              <select 
                value={preferences.quiet_start} 
                onChange={(e) => handleTimeChange('quiet_start', e.target.value)}
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>to</span>
              <select 
                value={preferences.quiet_end} 
                onChange={(e) => handleTimeChange('quiet_end', e.target.value)}
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>
        </div>

      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
