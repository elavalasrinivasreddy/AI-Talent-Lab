/**
 * ScheduleInterviewModal.jsx – Create/edit interview round
 * Per docs/pages/10_interview_scheduling.md §2
 * Triggered from: KanbanCard menu, CandidateDetail Interviews tab
 */
import React, { useState, useEffect } from 'react'
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
  })
  const [panelInput, setPanelInput] = useState({ name: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(f => ({
        ...f,
        round_number: roundNumber,
        round_name: `Round ${roundNumber} — Technical`,
      }))
      setError('')
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
  }

  const handleRoundTypeChange = (type) => {
    const typeLabel = ROUND_TYPES.find(t => t.value === type)?.label || type
    setField('round_type', type)
    setField('round_name', `Round ${form.round_number} — ${typeLabel}`)
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
      const result = await interviewsApi.create({
        position_id: positionId,
        candidate_id: candidateId,
        application_id: applicationId,
        round_number: form.round_number,
        round_name: form.round_name,
        round_type: form.round_type,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_minutes: form.duration_minutes,
        meeting_link: form.meeting_link || null,
        notes: form.notes || null,
        panel_members: form.panel_members,
      })
      onCreated?.(result)
      onClose()
    } catch (e) {
      setError(e.message || 'Failed to schedule interview. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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

          {/* Date/Time/Duration */}
          <div className="sim-form-row">
            <div className="sim-form-group" style={{ flex: 2 }}>
              <label>Date & Time *</label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={e => setField('scheduled_at', e.target.value)}
                className="sim-input"
                required
              />
            </div>
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
          </div>

          {/* Meeting Link */}
          <div className="sim-form-group">
            <label>Meeting Link (optional)</label>
            <input
              type="url"
              value={form.meeting_link}
              onChange={e => setField('meeting_link', e.target.value)}
              className="sim-input"
              placeholder="https://meet.google.com/..."
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
