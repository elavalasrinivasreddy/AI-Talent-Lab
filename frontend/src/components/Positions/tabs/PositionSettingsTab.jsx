/**
 * PositionSettingsTab.jsx – Position-level settings (ATS threshold, search interval, headcount, etc.)
 */
import React, { useState } from 'react'
import { positionsApi } from '../../../utils/api'
import './PositionSettingsTab.css'

export default function PositionSettingsTab({ position, onUpdate }) {
  const [form, setForm] = useState({
    headcount: position?.headcount || 1,
    priority: position?.priority || 'normal',
    ats_threshold: position?.ats_threshold || 80,
    search_interval_hours: position?.search_interval_hours || 24,
    is_on_career_page: position?.is_on_career_page ?? true,
    deadline: position?.deadline || '',
    work_type: position?.work_type || 'onsite',
    employment_type: position?.employment_type || 'full_time',
    location: position?.location || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const updated = await positionsApi.update(position.id, form)
      onUpdate(prev => ({ ...prev, ...updated }))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      alert(`Save failed: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="psettings-tab">
      <div className="psettings-grid">
        {/* Left column */}
        <div className="psettings-section">
          <h4 className="psettings-heading">Position Details</h4>

          <label className="psettings-field">
            <span>Role Location</span>
            <input className="psettings-input" value={form.location}
              onChange={e => set('location', e.target.value)} placeholder="e.g. Bangalore" />
          </label>

          <label className="psettings-field">
            <span>Work Type</span>
            <select className="psettings-select" value={form.work_type} onChange={e => set('work_type', e.target.value)}>
              <option value="onsite">On-site</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>

          <label className="psettings-field">
            <span>Employment Type</span>
            <select className="psettings-select" value={form.employment_type} onChange={e => set('employment_type', e.target.value)}>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </label>

          <label className="psettings-field">
            <span>Headcount</span>
            <input className="psettings-input" type="number" min={1} max={100}
              value={form.headcount} onChange={e => set('headcount', parseInt(e.target.value) || 1)} />
          </label>

          <label className="psettings-field">
            <span>Priority</span>
            <select className="psettings-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="normal">🟡 Normal</option>
              <option value="low">🟢 Low</option>
            </select>
          </label>

          <label className="psettings-field">
            <span>Deadline</span>
            <input className="psettings-input" type="date" value={form.deadline}
              onChange={e => set('deadline', e.target.value)} />
          </label>

          <label className="psettings-field psettings-toggle">
            <span>Show on Career Page</span>
            <input type="checkbox" checked={form.is_on_career_page}
              onChange={e => set('is_on_career_page', e.target.checked)} />
          </label>
        </div>

        {/* Right column */}
        <div className="psettings-section">
          <h4 className="psettings-heading">Candidate Sourcing</h4>

          <label className="psettings-field">
            <span>ATS Score Threshold</span>
            <div className="psettings-range-row">
              <input type="range" min={0} max={100} step={5}
                value={form.ats_threshold} onChange={e => set('ats_threshold', parseFloat(e.target.value))} />
              <span className="psettings-range-val">{form.ats_threshold}%</span>
            </div>
            <small className="psettings-hint">Only candidates above this score get outreach emails.</small>
          </label>

          <label className="psettings-field">
            <span>Auto-Search Interval</span>
            <select className="psettings-select" value={form.search_interval_hours}
              onChange={e => set('search_interval_hours', parseInt(e.target.value))}>
              <option value={6}>Every 6 hours</option>
              <option value={12}>Every 12 hours</option>
              <option value={24}>Daily</option>
              <option value={48}>Every 2 days</option>
              <option value={168}>Weekly</option>
            </select>
          </label>
        </div>
      </div>

      <div className="psettings-footer">
        {saved && <span className="psettings-saved">✅ Settings saved</span>}
        <button className="psettings-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
