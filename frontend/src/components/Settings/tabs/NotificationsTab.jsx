import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../utils/api'
import Icon from '../../common/Icon'
import Toast from '../../common/Toast'
import '../Settings.css'

const NOTIFICATION_EVENTS = [
  {
    category: 'Hire Requests',
    events: [
      { id: 'hire_request_submitted', label: 'New hire request submitted (by HR)' },
      { id: 'hire_request_decision', label: 'Hire request approved or rejected' },
    ]
  },
  {
    category: 'Job Descriptions',
    events: [
      { id: 'jd_drafted', label: 'JD draft ready for review' },
    ]
  },
  {
    category: 'Candidates',
    events: [
      { id: 'new_candidate', label: 'New candidate applied' },
      { id: 'candidate_stage_change', label: 'Candidate stage changed' },
    ]
  },
  {
    category: 'Interviews & Feedback',
    events: [
      { id: 'interview_scheduled', label: 'Interview scheduled' },
      { id: 'panel_feedback', label: 'Panel feedback submitted' },
    ]
  }
]

export default function NotificationsTab() {
  const { user, setUser } = useAuth()
  const [preferences, setPreferences] = useState(user?.notification_preferences || {})
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleToggle = async (eventId, channel, currentVal) => {
    const newVal = !currentVal
    
    // Optimistic update
    const newPreferences = {
      ...preferences,
      [eventId]: {
        ...(preferences[eventId] || { in_app: true, email: true }),
        [channel]: newVal
      }
    }
    setPreferences(newPreferences)

    try {
      const res = await api.patch('/auth/profile', {
        notification_preferences: newPreferences
      })
      setUser(res.user) // Update global user state
      showToast('Notification preferences updated')
    } catch (err) {
      setPreferences(preferences) // Rollback
      showToast(err.message || 'Failed to update preferences', 'error')
    }
  }

  const isChecked = (eventId, channel) => {
    const pref = preferences[eventId]
    if (!pref) return true // default to true if not set
    return pref[channel] !== false
  }

  return (
    <div className="settings-form relative">
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h2 className="settings-card-title">Notification Preferences</h2>
            <p className="settings-card-desc">
              Control how you receive updates for different events in the platform.
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="pb-3 font-medium text-[var(--color-text-muted)] w-1/2">Event</th>
                  <th className="pb-3 font-medium text-[var(--color-text-muted)] text-center w-1/4">In-App</th>
                  <th className="pb-3 font-medium text-[var(--color-text-muted)] text-center w-1/4">Email</th>
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_EVENTS.map((category, idx) => (
                  <React.Fragment key={idx}>
                    <tr>
                      <td colSpan={3} className="pt-6 pb-2 font-semibold text-[var(--color-text)]">
                        {category.category}
                      </td>
                    </tr>
                    {category.events.map(event => (
                      <tr key={event.id} className="border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-bg-subtle)] transition-colors">
                        <td className="py-4 text-sm text-[var(--color-text-primary)]">
                          {event.label}
                        </td>
                        <td className="py-4 text-center">
                          <label className="toggle relative inline-block w-10 h-6 cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={isChecked(event.id, 'in_app')}
                              onChange={() => handleToggle(event.id, 'in_app', isChecked(event.id, 'in_app'))}
                            />
                            <div className="w-10 h-6 bg-[var(--color-bg-alt)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                          </label>
                        </td>
                        <td className="py-4 text-center">
                          <label className="toggle relative inline-block w-10 h-6 cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer"
                              checked={isChecked(event.id, 'email')}
                              onChange={() => handleToggle(event.id, 'email', isChecked(event.id, 'email'))}
                            />
                            <div className="w-10 h-6 bg-[var(--color-bg-alt)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
