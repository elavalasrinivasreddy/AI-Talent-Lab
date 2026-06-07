/**
 * PositionSettingsTab.jsx – Premium card-based settings.
 * ATS slider (thin-line in card), dropdown interval, compact toggles.
 */
import { useState } from 'react'
import { positionsApi } from '../../../utils/api'
import Icon from '../../common/Icon'
import Toast from '../../common/Toast'
import './PositionSettingsTab.css'

export default function PositionSettingsTab({ position, onUpdate }) {
  const [form, setForm] = useState({
    ats_threshold: position?.ats_threshold || 80,
    search_interval_hours: position?.search_interval_hours || 24,
    is_on_career_page: position?.is_on_career_page ?? true,
    requires_approval: position?.requires_approval ?? false,
  })
  const [toastMsg, setToastMsg] = useState(null)
  const [approvalAction, setApprovalAction] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await positionsApi.update(position.id, form)
      onUpdate(prev => ({ ...prev, ...updated }))
      setToastMsg('Settings saved successfully')
    } catch (e) {
      setToastMsg(`Save failed: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmitForApproval = async () => {
    setApprovalAction('submitting')
    try {
      await positionsApi.submitForApproval(position.id)
      onUpdate(prev => ({ ...prev, approval_status: 'pending' }))
      setApprovalAction('submitted')
    } catch (e) {
      setToastMsg(`Submit failed: ${e.message}`)
      setApprovalAction(null)
    }
  }

  const atsColor = form.ats_threshold >= 80 ? 'var(--color-success)' :
                   form.ats_threshold >= 60 ? 'var(--color-warning)' :
                   'var(--color-danger)'

  return (
    <div className="pset">
      {/* ATS Score Threshold — thin slider in card */}
      <div className="pset-card">
        <div className="pset-card-row">
          <div className="pset-card-info">
            <h4 className="pset-card-title">ATS Score Threshold</h4>
            <p className="pset-card-desc">Only candidates above this score get outreach emails</p>
          </div>
          <span className="pset-ats-value" style={{ color: atsColor }}>
            {form.ats_threshold}%
          </span>
        </div>
        <div className="pset-slider-wrap">
          <input
            type="range"
            min={0} max={100} step={5}
            value={form.ats_threshold}
            onChange={e => set('ats_threshold', parseFloat(e.target.value))}
            className="pset-slider"
            style={{ '--slider-progress': `${form.ats_threshold}%`, '--slider-color': atsColor }}
          />
          <div className="pset-slider-labels">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Auto-Search Interval — dropdown in card */}
      <div className="pset-card">
        <div className="pset-card-row">
          <div className="pset-card-info">
            <h4 className="pset-card-title">Auto-Search Interval</h4>
            <p className="pset-card-desc">How often the AI searches for new candidates</p>
          </div>
          <select
            className="pset-select"
            value={form.search_interval_hours}
            onChange={e => set('search_interval_hours', parseInt(e.target.value))}
          >
            <option value={6}>Every 6 hours</option>
            <option value={12}>Every 12 hours</option>
            <option value={24}>Daily</option>
            <option value={48}>Every 2 days</option>
            <option value={168}>Weekly</option>
          </select>
        </div>
      </div>

      {/* Toggles Row — compact side-by-side */}
      <div className="pset-toggles-row">
        {/* Career Page */}
        <div className="pset-card pset-card--tight">
          <div className="pset-card-row">
            <div className="pset-card-info">
              <h4 className="pset-card-title">Career Page Listing</h4>
              <p className="pset-card-desc">Show on public career page</p>
            </div>
            <label className="pset-switch">
              <input
                type="checkbox"
                checked={form.is_on_career_page}
                onChange={e => set('is_on_career_page', e.target.checked)}
              />
              <span className="pset-switch-slider" />
            </label>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="pset-footer">
        <button className="pset-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : '✓ Save Settings'}
        </button>
      </div>

      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />
    </div>
  )
}
