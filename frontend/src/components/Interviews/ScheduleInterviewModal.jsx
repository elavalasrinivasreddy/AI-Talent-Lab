/**
 * ScheduleInterviewModal.jsx – Create/edit interview round
 * Per docs/design/pages/15_interview_scheduling.md §2
 * Triggered from: KanbanCard menu, CandidateDetail Interviews tab
 */
import { useState, useEffect } from 'react'
import { interviewsApi } from '../../utils/api'
import './ScheduleInterviewModal.css'

const ROUND_TYPES = [
  { value: 'technical', label: 'Technical' },
  { value: 'managerial', label: 'Manager' },
  { value: 'hr', label: 'HR' },
  { value: 'final', label: 'Final' },
  { value: 'system_design', label: 'System Design' },
  { value: 'culture', label: 'Culture Fit' },
  { value: 'custom', label: 'Custom' },
]

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
  { value: 120, label: '2 hours' },
]

function groupSlotsByDay(slots) {
  const map = {}
  for (const s of slots) {
    const day = s.start.slice(0, 10)
    if (!map[day]) map[day] = []
    map[day].push(s)
  }
  return map
}

function formatDay(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function toLocalDatetimeInput(iso) {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ScheduleInterviewModal({
  open,
  onClose,
  onCreated,
  positionId,
  candidateId,
  applicationId,
  candidateName,
  positionTitle,
  roundNumber = 1,
}) {
  const [form, setForm] = useState({
    round_number: roundNumber,
    round_name: `Round ${roundNumber} — Technical`,
    round_type: 'technical',
    scheduled_at: '',
    duration_minutes: 60,
    meeting_link: '',
    notes: '',
    panel_members: [],
    send_candidate_invite: true,
    send_panel_links: true,
    send_reminders: true,
    create_calendar_event: true,
  })
  const [panelInput, setPanelInput] = useState({ name: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Calendar slot picker state
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slots, setSlots] = useState(null)  // null = not fetched yet
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [slotsError, setSlotsError] = useState('')
  const [showSlots, setShowSlots] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(f => ({
        ...f,
        round_number: roundNumber,
        round_name: `Round ${roundNumber} — Technical`,
      }))
      setError('')
      setSlots(null)
      setSelectedSlot(null)
      setShowSlots(false)
    }
  }, [open, roundNumber])

  if (!open) return null

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addPanelMember = () => {
    if (!panelInput.name.trim() || !panelInput.email.trim()) return
    if (!panelInput.email.includes('@')) {
      setError('Please enter a valid panel member email')
      return
    }
    setForm(f => ({
      ...f,
      panel_members: [...f.panel_members, { ...panelInput }],
    }))
    setPanelInput({ name: '', email: '' })
    setError('')
  }

  const removePanelMember = (idx) => {
    setForm(f => ({
      ...f,
      panel_members: f.panel_members.filter((_, i) => i !== idx),
    }))
    setSlots(null)
    setSelectedSlot(null)
    setShowSlots(false)
  }

  const handleRoundTypeChange = (type) => {
    const typeLabel = ROUND_TYPES.find(t => t.value === type)?.label || type
    setField('round_type', type)
    setField('round_name', `Round ${form.round_number} — ${typeLabel}`)
  }

  const fetchAvailability = async () => {
    if (form.panel_members.length === 0) {
      setSlotsError('Add at least one panel member first')
      return
    }
    setSlotsLoading(true)
    setSlotsError('')
    try {
      const res = await interviewsApi.getCalendarAvailability({
        panelist_emails: form.panel_members.map(p => p.email),
        duration_minutes: form.duration_minutes,
        days_ahead: 5,
      })
      setSlots(res.slots || [])
      setShowSlots(true)
    } catch (e) {
      setSlotsError(e.message || 'Failed to fetch availability')
    } finally {
      setSlotsLoading(false)
    }
  }

  const pickSlot = (slot) => {
    setSelectedSlot(slot)
    setField('scheduled_at', toLocalDatetimeInput(slot.start))
    setShowSlots(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.scheduled_at) {
      setError('Please select a date and time')
      return
    }
    if (form.panel_members.length === 0) {
      setError('Please add at least one panel member')
      return
    }

    setLoading(true)
    try {
      const scheduledAt = new Date(form.scheduled_at).toISOString()

      if (form.create_calendar_event) {
        // Create interview first, then wire up calendar event
        const created = await interviewsApi.create({
          position_id: positionId,
          candidate_id: candidateId,
          application_id: applicationId,
          round_number: form.round_number,
          round_name: form.round_name,
          round_type: form.round_type,
          scheduled_at: scheduledAt,
          duration_minutes: form.duration_minutes,
          meeting_link: form.meeting_link || null,
          notes: form.notes || null,
          panel_members: form.panel_members,
        })

        const calResult = await interviewsApi.scheduleWithCalendar({
          interview_id: created.id,
          scheduled_at: scheduledAt,
          duration_minutes: form.duration_minutes,
          panelist_emails: form.panel_members.map(p => p.email),
          create_calendar_event: true,
        })

        onCreated?.({ ...created, meeting_link: calResult.meeting_link })
      } else {
        const result = await interviewsApi.create({
          position_id: positionId,
          candidate_id: candidateId,
          application_id: applicationId,
          round_number: form.round_number,
          round_name: form.round_name,
          round_type: form.round_type,
          scheduled_at: scheduledAt,
          duration_minutes: form.duration_minutes,
          meeting_link: form.meeting_link || null,
          notes: form.notes || null,
          panel_members: form.panel_members,
        })
        onCreated?.(result)
      }

      onClose()
    } catch (err) {
      setError(err.message || 'Failed to schedule interview. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const slotsByDay = slots ? groupSlotsByDay(slots.filter(s => s.all_available)) : {}
  const availableDays = Object.keys(slotsByDay).sort()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="sim-modal" onClick={e => e.stopPropagation()}>
        <div className="sim-modal-header">
          <div>
            <h2 className="sim-modal-title">📅 Schedule Interview</h2>
            <p className="sim-modal-sub">
              {candidateName} · {positionTitle}
            </p>
          </div>
          <button className="sim-modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="sim-modal-body" onSubmit={handleSubmit}>
          {/* Round details */}
          <div className="sim-form-row">
            <div className="sim-form-group">
              <label>Round Number *</label>
              <input
                type="number"
                min={1} max={10}
                value={form.round_number}
                onChange={e => {
                  const n = parseInt(e.target.value) || 1
                  setField('round_number', n)
                  setField('round_name', `Round ${n} — ${ROUND_TYPES.find(t => t.value === form.round_type)?.label || 'Technical'}`)
                }}
                className="sim-input"
              />
            </div>
            <div className="sim-form-group" style={{ flex: 2 }}>
              <label>Round Type *</label>
              <select
                value={form.round_type}
                onChange={e => handleRoundTypeChange(e.target.value)}
                className="sim-input"
              >
                {ROUND_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="sim-form-group">
            <label>Round Name</label>
            <input
              type="text"
              value={form.round_name}
              onChange={e => setField('round_name', e.target.value)}
              className="sim-input"
              placeholder="e.g. Round 1 — Technical"
            />
          </div>

          {/* Panel Members */}
          <div className="sim-form-group">
            <label>Panel Members *</label>
            <div className="sim-panel-input-row">
              <input
                type="text"
                placeholder="Name"
                value={panelInput.name}
                onChange={e => setPanelInput(p => ({ ...p, name: e.target.value }))}
                className="sim-input"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPanelMember())}
              />
              <input
                type="email"
                placeholder="Email"
                value={panelInput.email}
                onChange={e => setPanelInput(p => ({ ...p, email: e.target.value }))}
                className="sim-input"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPanelMember())}
              />
              <button type="button" className="sim-add-btn" onClick={addPanelMember}>+ Add</button>
            </div>
            <p className="sim-hint">Each panel member gets a unique feedback magic link</p>
            {form.panel_members.length > 0 && (
              <div className="sim-panel-chips">
                {form.panel_members.map((pm, idx) => (
                  <div key={idx} className="sim-panel-chip">
                    <span className="sim-chip-avatar">{pm.name[0]?.toUpperCase()}</span>
                    <div className="sim-chip-info">
                      <span className="sim-chip-name">{pm.name}</span>
                      <span className="sim-chip-email">{pm.email}</span>
                    </div>
                    <button
                      type="button"
                      className="sim-chip-remove"
                      onClick={() => removePanelMember(idx)}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="sim-form-row">
            <div className="sim-form-group">
              <label>Duration</label>
              <select
                value={form.duration_minutes}
                onChange={e => setField('duration_minutes', parseInt(e.target.value))}
                className="sim-input"
              >
                {DURATION_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="sim-form-group" style={{ flex: 2, justifyContent: 'flex-end' }}>
              <label style={{ visibility: 'hidden' }}>Action</label>
              <button
                type="button"
                className="sim-find-slots-btn"
                onClick={fetchAvailability}
                disabled={slotsLoading || form.panel_members.length === 0}
              >
                {slotsLoading ? '⏳ Checking…' : '🗓 Find Available Slots'}
              </button>
            </div>
          </div>

          {slotsError && <div className="sim-slots-error">{slotsError}</div>}

          {/* Slot picker */}
          {showSlots && slots !== null && (
            <div className="sim-slot-picker">
              <div className="sim-slot-picker-header">
                <span>Available slots (all panelists free)</span>
                <button type="button" className="sim-slot-picker-close" onClick={() => setShowSlots(false)}>✕</button>
              </div>
              {availableDays.length === 0 ? (
                <p className="sim-slot-empty">No slots where all panelists are free in the next 5 days.</p>
              ) : (
                availableDays.map(day => (
                  <div key={day} className="sim-slot-day">
                    <div className="sim-slot-day-label">{formatDay(day)}</div>
                    <div className="sim-slot-row">
                      {slotsByDay[day].map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          className="sim-slot-chip"
                          onClick={() => pickSlot(s)}
                        >
                          {formatTime(s.start)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Date/Time — manual or pre-filled from slot */}
          <div className="sim-form-group">
            <label>
              Date &amp; Time *
              {selectedSlot && (
                <span className="sim-slot-selected-badge">
                  ✓ Slot selected
                </span>
              )}
            </label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={e => {
                setField('scheduled_at', e.target.value)
                setSelectedSlot(null)
              }}
              className="sim-input"
              required
            />
          </div>

          {/* Meeting Link */}
          <div className="sim-form-group">
            <label>Meeting Link (optional)</label>
            <input
              type="url"
              value={form.meeting_link}
              onChange={e => setField('meeting_link', e.target.value)}
              className="sim-input"
              placeholder="https://meet.google.com/… (auto-generated if calendar event enabled)"
            />
          </div>

          {/* Notes */}
          <div className="sim-form-group">
            <label>Notes for Panel (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              className="sim-input sim-textarea"
              placeholder="Visible to panel members with their magic link"
              rows={3}
            />
          </div>

          {/* Checkboxes */}
          <div className="sim-checks">
            {[
              ['send_candidate_invite', '☑ Send interview invitation to candidate'],
              ['send_panel_links', '☑ Send feedback magic links to panel members'],
              ['send_reminders', '☑ Auto-send reminders 24h before interview'],
            ].map(([key, label]) => (
              <label key={key} className="sim-check-label">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={e => setField(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
            <label className="sim-check-label sim-check-calendar">
              <input
                type="checkbox"
                checked={form.create_calendar_event}
                onChange={e => setField('create_calendar_event', e.target.checked)}
              />
              🗓 Create calendar event &amp; auto-generate Meet link
              <span className="sim-badge-mock">mock</span>
            </label>
          </div>

          {error && <div className="sim-error">{error}</div>}

          {/* Actions */}
          <div className="sim-modal-actions">
            <button type="button" className="sim-btn-cancel" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="sim-btn-primary" disabled={loading}>
              {loading ? 'Scheduling…' : '📅 Schedule Interview'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
