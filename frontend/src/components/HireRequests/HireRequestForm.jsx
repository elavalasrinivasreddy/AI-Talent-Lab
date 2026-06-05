import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hireRequestsApi } from '../../utils/api'
import api from '../../utils/api'
import RelayVisualization from './RelayVisualization'
import {
  ArrowLeftIcon, ArrowRightIcon, AlertIcon, SpinnerIcon,
} from './icons'
import './HireRequests.css'

const BLANK = {
  role_name: '',
  department_id: '',
  headcount: 1,
  priority: 'normal',
  work_type: 'onsite',
  location: '',
  experience_min: '',
  experience_max: '',
  comp_min: '',
  comp_max: '',
  target_start: '',
  requirements: '',
  notes: '',
}

const toNum = (v) => (v === '' || v == null ? null : Number(v))

/**
 * Shared wizard for /hire-requests/new and /hire-requests/:id/edit.
 * When `mode === 'edit'`, the form prefills from the loaded request and
 * PATCHes on submit. Only the requester (or an admin) can edit, and only
 * while the request is still `pending` — the backend enforces this too.
 */
export default function HireRequestForm({ mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEdit = mode === 'edit'

  const [form, setForm] = useState({ ...BLANK, department_id: user?.department_id ?? user?.dept_id ?? '' })
  const [existing, setExisting] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [depts, setDepts] = useState([])

  const fetchDepts = useCallback(async () => {
    try {
      const res = await api.get('/settings/departments')
      setDepts(res.data.departments || [])
    } catch (e) { console.error('Failed to load departments:', e) }
  }, [])

  useEffect(() => { fetchDepts() }, [fetchDepts])

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    setLoading(true)
    hireRequestsApi.get(id)
      .then(res => {
        if (cancelled) return
        const r = res?.request
        if (!r) {
          setError('Request not found.')
          return
        }
        setExisting(r)
        setForm({
          role_name: r.role_name || '',
          department_id: r.department_id ?? '',
          headcount: r.headcount ?? 1,
          priority: r.priority || 'normal',
          work_type: r.work_type || 'onsite',
          location: r.location || '',
          experience_min: r.experience_min ?? '',
          experience_max: r.experience_max ?? '',
          comp_min: r.comp_min ?? '',
          comp_max: r.comp_max ?? '',
          target_start: r.target_start || '',
          requirements: r.requirements || '',
          notes: r.notes || '',
        })
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || 'Couldn\'t load request.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, isEdit])

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.role_name.trim()) {
      setError('Role name is required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        role_name: form.role_name.trim(),
        department_id: form.department_id ? Number(form.department_id) : null,
        headcount: Number(form.headcount) || 1,
        priority: form.priority,
        work_type: form.work_type,
        location: form.location.trim() || null,
        experience_min: toNum(form.experience_min),
        experience_max: toNum(form.experience_max),
        comp_min: toNum(form.comp_min),
        comp_max: toNum(form.comp_max),
        target_start: form.target_start || null,
        requirements: form.requirements.trim() || null,
      }
      if (isEdit && form.notes.trim()) {
        payload.notes = form.notes.trim()
      }
      const res = isEdit
        ? await hireRequestsApi.update(id, payload)
        : await hireRequestsApi.create(payload)
      const r = res?.request
      navigate(r?.id ? `/hire-requests/${r.id}` : '/hire-requests', { replace: true })
    } catch (err) {
      setError(err?.message || 'Couldn\'t save request. Try again.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="hr-page">
        <div className="hr-card-skeleton-large" />
      </div>
    )
  }

  return (
    <div className="hr-page">
      <header className="hr-page-head">
        <div>
          <Link to="/hire-requests" className="hr-back-link">
            <ArrowLeftIcon /> Hire requests
          </Link>
          <h1 className="hr-page-title">
            {isEdit ? `Edit ${existing?.role_name || 'request'}` : 'New hire request'}
          </h1>
          <p className="hr-page-sub">
            {isEdit
              ? 'Make changes while the request is still pending pickup.'
              : 'Tell the AI what you\'re hiring for. Recruiters will pick it up and the JD chat opens pre-filled.'}
          </p>
        </div>
      </header>

      {/* Relay viz — for new, it's a preview of the path the request will take */}
      <RelayVisualization request={existing || {
        status: 'draft',
        requested_by_name: user?.name || 'You',
      }} />

      {error && (
        <div className="hr-banner tone-danger" role="alert">
          <AlertIcon /> <span>{error}</span>
        </div>
      )}

      <form className="hr-form" onSubmit={submit} noValidate>
        <div className="hr-form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <section className="hr-form-section">
            <h2 className="hr-form-section-title">Role Basics</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '-10px 0 16px' }}>
              Define the core position details. The AI recruiter will use this as the foundation.
            </p>

            <div className="hr-field" style={{ marginBottom: '16px' }}>
              <label htmlFor="hr-role">Role title <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                id="hr-role"
                type="text"
                value={form.role_name}
                onChange={e => set('role_name', e.target.value)}
                placeholder="e.g. Senior Backend Engineer (Go)"
                autoFocus
                maxLength={200}
                required
              />
            </div>

            {user?.role === 'org_head' && (
              <div className="hr-field">
                <label htmlFor="hr-dept">Department</label>
                <select
                  id="hr-dept"
                  value={form.department_id}
                  onChange={e => set('department_id', e.target.value)}
                >
                  <option value="">— None —</option>
                  {depts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
          </section>

          <section className="hr-form-section">
            <h2 className="hr-form-section-title">Logistics & Compensation</h2>

            <div className="hr-field-row" style={{ marginBottom: '16px' }}>
              <div className="hr-field">
                <label htmlFor="hr-headcount">Headcount</label>
                <input
                  id="hr-headcount"
                  type="number" min={1} max={100}
                  value={form.headcount}
                  onChange={e => set('headcount', e.target.value)}
                />
              </div>
              <div className="hr-field">
                <label htmlFor="hr-priority">Priority</label>
                <select id="hr-priority" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="hr-field">
                <label htmlFor="hr-worktype">Work type</label>
                <select id="hr-worktype" value={form.work_type} onChange={e => set('work_type', e.target.value)}>
                  <option value="onsite">Onsite</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                </select>
              </div>
            </div>

            <div className="hr-field-row" style={{ marginBottom: '16px' }}>
              <div className="hr-field">
                <label htmlFor="hr-start">Target start</label>
                <input
                  id="hr-start" type="date"
                  value={form.target_start}
                  onChange={e => set('target_start', e.target.value)}
                />
              </div>
              <div className="hr-field">
                <label htmlFor="hr-loc">Location</label>
                <input
                  id="hr-loc" type="text"
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="Bangalore, India"
                />
              </div>
            </div>

            <div className="hr-field-row" style={{ marginBottom: '16px' }}>
              <div className="hr-field">
                <label htmlFor="hr-emin">Min experience (years)</label>
                <input
                  id="hr-emin" type="number" min={0} max={50}
                  value={form.experience_min}
                  onChange={e => set('experience_min', e.target.value)}
                  placeholder="3"
                />
              </div>
              <div className="hr-field">
                <label htmlFor="hr-emax">Max experience (years)</label>
                <input
                  id="hr-emax" type="number" min={0} max={50}
                  value={form.experience_max}
                  onChange={e => set('experience_max', e.target.value)}
                  placeholder="8"
                />
              </div>
            </div>

            <div className="hr-field-row">
              <div className="hr-field">
                <label htmlFor="hr-cmin">Comp min (LPA)</label>
                <input
                  id="hr-cmin" type="number" min={0}
                  value={form.comp_min}
                  onChange={e => set('comp_min', e.target.value)}
                  placeholder="30"
                />
              </div>
              <div className="hr-field">
                <label htmlFor="hr-cmax">Comp max (LPA)</label>
                <input
                  id="hr-cmax" type="number" min={0}
                  value={form.comp_max}
                  onChange={e => set('comp_max', e.target.value)}
                  placeholder="55"
                />
              </div>
            </div>
          </section>

          <section className="hr-form-section">
            <h2 className="hr-form-section-title">Requirements & Scope</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '-10px 0 16px' }}>
              Tell the AI exactly what you're looking for. Be concrete about must-haves, constraints, and daily responsibilities.
            </p>
            <div className="hr-field">
              <label htmlFor="hr-req">Context for the AI</label>
              <textarea
                id="hr-req"
                rows={6}
                value={form.requirements}
                onChange={e => set('requirements', e.target.value)}
                placeholder="We need someone who has scaled Postgres in a fast-paced environment. Must have experience with event-driven architectures..."
              />
            </div>
          </section>

          {isEdit && (
            <section className="hr-form-section" style={{ borderLeftColor: 'var(--color-primary)' }}>
              <h2 className="hr-form-section-title">Edit Notes</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '-10px 0 16px' }}>
                If you are modifying this request, explain what was changed so the requester knows why.
              </p>
              <div className="hr-field">
                <label htmlFor="hr-notes">Notes for Team Lead</label>
                <textarea
                  id="hr-notes"
                  rows={3}
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="e.g. Adjusted headcount to 2 as per Q3 budget. Raised max comp slightly."
                />
              </div>
            </section>
          )}
        </div>

        <div className="hr-form-actions">
          <Link to="/hire-requests" className="hr-btn hr-btn-ghost">Cancel</Link>
          <button type="submit" className="hr-btn hr-btn-primary" disabled={saving}>
            {saving
              ? <><SpinnerIcon /> Saving…</>
              : <>{isEdit ? 'Save changes' : 'Submit for pickup'} <ArrowRightIcon /></>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
