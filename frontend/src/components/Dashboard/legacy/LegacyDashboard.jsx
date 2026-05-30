/**
 * DashboardPage.jsx — Premium role-adaptive hiring dashboard
 * Route: /dashboard
 *
 * Roles:
 *   admin      → Director view: org-wide stats, conversion rates, dept breakdown, top positions
 *   hiring_mgr → Manager view: dept stats, pipeline health, team workload
 *   recruiter  → Recruiter view: my positions, pending actions, productivity metrics
 */
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { dashboardApi, copilotApi, positionsApi, hireRequestsApi } from '../../../utils/api'
import StatusBadge from '../../common/StatusBadge'
import { timeAgo } from '../../utils/date'
import './LegacyDashboard.css'

export default function LegacyDashboard() {
  const { user, org } = useAuth()
  const navigate = useNavigate()
  const role = user?.role || 'hr'

  const [stats, setStats] = useState(null)
  const [positions, setPositions] = useState([])
  const [funnel, setFunnel] = useState(null)
  const [activity, setActivity] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [period, setPeriod] = useState('week')
  const [loading, setLoading] = useState(true)
  const [hireRequests, setHireRequests] = useState([])
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [drafts, setDrafts] = useState([])

  useEffect(() => { loadAll() }, [period])
  useEffect(() => { loadSuggestions() }, [])
  useEffect(() => { loadHireRequests() }, [role])
  useEffect(() => {
    if (role === 'dept_admin' || role === 'org_head') loadPendingApprovals()
  }, [role])
  useEffect(() => {
    if (role === 'hr' || role === 'dept_admin' || role === 'org_head') loadDrafts()
  }, [role])

  const loadHireRequests = async () => {
    try {
      const data = await hireRequestsApi.list()
      setHireRequests(data?.requests || [])
    } catch {
      // non-critical
    }
  }

  const loadPendingApprovals = async () => {
    try {
      const data = await hireRequestsApi.list({ status: 'pending' })
      setPendingApprovals(data?.requests || [])
    } catch {
      // non-critical
    }
  }

  const loadDrafts = async () => {
    try {
      const data = await positionsApi.list({ status: 'draft' })
      setDrafts(Array.isArray(data) ? data : data?.positions || [])
    } catch {
      // non-critical
    }
  }

  const loadSuggestions = async () => {
    try {
      const data = await copilotApi.getSuggestions()
      setSuggestions(Array.isArray(data) ? data : data?.suggestions || [])
    } catch (e) {
      // Copilot is optional — fail silently
      console.debug('Copilot suggestions unavailable:', e.message)
    }
  }

  const dismissSuggestion = async (id) => {
    setSuggestions(prev => prev.filter(s => s.id !== id))
    try { await copilotApi.dismiss(id) } catch {}
  }

  const dismissAllSuggestions = async () => {
    setSuggestions([])
    try { await copilotApi.dismissAll() } catch {}
  }

  const loadAll = async () => {
    setLoading(true)
    try {
      const [s, p, f, a] = await Promise.allSettled([
        dashboardApi.getStats(period),
        dashboardApi.getPositions(),
        dashboardApi.getFunnel(),
        dashboardApi.getActivity(null, 20),
      ])
      if (s.status === 'fulfilled') setStats(s.value)
      if (p.status === 'fulfilled') setPositions(Array.isArray(p.value) ? p.value : p.value?.positions || [])
      if (f.status === 'fulfilled') setFunnel(f.value)
      if (a.status === 'fulfilled') setActivity(Array.isArray(a.value) ? a.value : a.value?.events || [])
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }

  const greeting = getGreeting()
  const roleBadge = { org_head: 'Org Head', dept_admin: 'Dept Admin', hr: 'HR', team_lead: 'Team Lead' }[role] || role

  return (
    <div className="dash">
      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">
            Good {greeting}, {user?.name?.split(' ')[0] || 'there'}
            <span className="dash-role-pill">{roleBadge}</span>
          </h1>
          <p className="dash-subtitle">
            {role === 'org_head'
              ? `${org?.name || 'Organization'} hiring overview`
              : role === 'team_lead'
                ? 'Your department pipeline'
                : role === 'dept_admin'
                  ? 'Department hiring overview'
                  : 'Your assigned positions'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {role === 'team_lead' && (
            <button
              className="btn btn-primary"
              onClick={() => setShowRequestModal(true)}
              style={{ whiteSpace: 'nowrap', fontSize: 13 }}
            >
              + Request a Hire
            </button>
          )}
          <div className="dash-period-switcher">
            {['today', 'week', 'month'].map(p => (
              <button key={p} className={`dash-period-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hire Request Modal (team_lead) ── */}
      {showRequestModal && (
        <HireRequestModal
          onClose={() => setShowRequestModal(false)}
          onSubmitted={() => { setShowRequestModal(false); loadHireRequests() }}
        />
      )}

      {/* ── AI Copilot Bar ── */}
      {suggestions.length > 0 && (
        <CopilotBar
          suggestions={suggestions}
          onDismiss={dismissSuggestion}
          onDismissAll={dismissAllSuggestions}
          navigate={navigate}
        />
      )}

      {/* ── Stats Strip ── */}
      {loading ? <StatsSkeleton count={role === 'org_head' ? 6 : 4} /> : <StatsStrip stats={stats} role={role} />}

      {/* ── Org Head: Department Overview ── */}
      {role === 'org_head' && positions.length > 0 && (
        <DeptOverview positions={positions} />
      )}

      {/* ── Main Grid ── */}
      <div className="dash-grid">
        {/* Left Column */}
        <div className="dash-col-main">
          {/* Funnel Visualization */}
          {funnel && <FunnelViz funnel={funnel} role={role} />}

          {/* HR: Today's Focus */}
          {role === 'hr' && stats && (
            <TodaysFocus stats={stats} navigate={navigate} />
          )}

          {/* Positions Table */}
          <PositionsSection positions={positions} role={role} loading={loading} />
        </div>

        {/* Right Column */}
        <div className="dash-col-side">
          {/* Pipeline Health (org_head/dept_admin/team_lead) */}
          {(role === 'org_head' || role === 'dept_admin' || role === 'team_lead') && stats && (
            <PipelineHealth stats={stats} />
          )}

          {/* Activity Feed */}
          <ActivityFeed activity={activity} loading={loading} />

          {/* HR Quick Actions */}
          {role === 'hr' && <QuickActions navigate={navigate} />}

          {/* Draft Positions (hr / dept_admin / org_head) */}
          {(role === 'hr' || role === 'dept_admin' || role === 'org_head') && (
            <DraftsSection drafts={drafts} navigate={navigate} />
          )}

          {/* Pending Approvals (dept_admin / org_head) */}
          {(role === 'dept_admin' || role === 'org_head') && (
            <PendingApprovals
              requests={pendingApprovals}
              onActioned={() => { loadPendingApprovals(); loadHireRequests() }}
            />
          )}

          {/* Hire Requests Queue (hr / dept_admin / org_head) */}
          {(role === 'hr' || role === 'dept_admin' || role === 'org_head') && (
            <HireRequestsQueue
              requests={hireRequests}
              navigate={navigate}
              onAccepted={loadHireRequests}
            />
          )}

          {/* Team Lead: My Requests */}
          {role === 'team_lead' && (
            <MyHireRequests
              requests={hireRequests}
              onCancelled={loadHireRequests}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pending Approvals (dept_admin / org_head) ────────────────────────────────

function PendingApprovals({ requests, onActioned }) {
  const [acting, setActing] = useState(null)  // `${id}-approve` or `${id}-reject`
  const [rejectOpenId, setRejectOpenId] = useState(null)
  const [rejectReasons, setRejectReasons] = useState({})

  const handleApprove = async (req) => {
    setActing(`${req.id}-approve`)
    try {
      await hireRequestsApi.approve(req.id)
      onActioned()
    } catch {
      // silently reset — error surfacing can be added later
    } finally {
      setActing(null)
    }
  }

  const handleReject = async (req) => {
    const reason = (rejectReasons[req.id] || '').trim()
    if (!reason) return
    setActing(`${req.id}-reject`)
    try {
      await hireRequestsApi.reject(req.id, reason)
      setRejectOpenId(null)
      setRejectReasons(prev => { const n = { ...prev }; delete n[req.id]; return n })
      onActioned()
    } catch {
      // silently reset
    } finally {
      setActing(null)
    }
  }

  if (requests.length === 0) return null

  return (
    <div className="dash-card dash-card--compact">
      <div className="dash-card-head">
        <h3 className="dash-card-title">Pending Approvals</h3>
        <span className="dash-card-badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#D97706' }}>
          {requests.length} awaiting
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {requests.map(req => (
          <div
            key={req.id}
            style={{
              padding: '12px 14px', borderRadius: 8,
              background: 'rgba(245,158,11,0.04)',
              border: '1px solid rgba(245,158,11,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13, flex: 1, color: 'var(--color-text-primary)' }}>
                {req.role_name}
              </span>
              <Link
                to={`/hire-requests/${req.id}`}
                style={{ fontSize: 11, color: 'var(--color-primary)', textDecoration: 'none' }}
              >
                View →
              </Link>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
              {req.requested_by_name} · {req.department_name || 'No dept'} · {req.headcount} headcount
            </div>

            {rejectOpenId === req.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  rows={2}
                  placeholder="Reason for rejection…"
                  value={rejectReasons[req.id] || ''}
                  onChange={e => setRejectReasons(prev => ({ ...prev, [req.id]: e.target.value }))}
                  style={{
                    width: '100%', padding: '6px 8px', fontSize: 12,
                    borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)',
                    background: 'var(--color-bg-primary)', fontFamily: 'inherit',
                    color: 'var(--color-text-primary)', resize: 'none', boxSizing: 'border-box',
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 11, padding: '4px 10px', flex: 1, background: '#EF4444', borderColor: '#EF4444' }}
                    onClick={() => handleReject(req)}
                    disabled={!!acting || !(rejectReasons[req.id] || '').trim()}
                  >
                    {acting === `${req.id}-reject` ? '…' : 'Confirm rejection'}
                  </button>
                  <button
                    style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 6, flex: 1,
                      background: 'transparent', border: '1px solid var(--color-border)',
                      cursor: 'pointer', color: 'var(--color-text-secondary)',
                    }}
                    onClick={() => setRejectOpenId(null)}
                    disabled={!!acting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 11, padding: '5px 12px', flex: 1 }}
                  onClick={() => handleApprove(req)}
                  disabled={!!acting}
                >
                  {acting === `${req.id}-approve` ? '…' : 'Approve'}
                </button>
                <button
                  style={{
                    fontSize: 11, padding: '5px 12px', borderRadius: 6, flex: 1,
                    background: 'transparent', border: '1px solid rgba(239,68,68,0.4)',
                    cursor: 'pointer', color: '#EF4444',
                  }}
                  onClick={() => setRejectOpenId(req.id)}
                  disabled={!!acting}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Hire Requests Queue (recruiter / admin) ─────────────────────────────────

function HireRequestsQueue({ requests, navigate, onAccepted }) {
  const [accepting, setAccepting] = useState(null)

  const handlePickUp = async (req) => {
    setAccepting(req.id)
    try {
      await hireRequestsApi.accept(req.id)
      onAccepted()
      navigate('/chat', {
        state: {
          hireRequest: {
            id: req.id,
            role_name: req.role_name,
            department_name: req.department_name,
            headcount: req.headcount,
            work_type: req.work_type,
            experience_min: req.experience_min,
            experience_max: req.experience_max,
            target_start: req.target_start,
            requirements: req.requirements,
            requested_by_name: req.requested_by_name,
          },
        },
      })
    } catch {
      setAccepting(null)
    }
  }

  if (requests.length === 0) return null

  return (
    <div className="dash-card dash-card--compact">
      <div className="dash-card-head">
        <h3 className="dash-card-title">Hire Requests</h3>
        <span className="dash-card-badge">{requests.length} approved</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {requests.map(req => (
          <div
            key={req.id}
            style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {req.role_name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {req.requested_by_name} · {req.department_name || 'No dept'} · {req.headcount} headcount
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() => handlePickUp(req)}
              disabled={accepting === req.id}
            >
              {accepting === req.id ? '…' : 'Pick Up'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── My Hire Requests (hiring_manager) ───────────────────────────────────────

function MyHireRequests({ requests, onCancelled }) {
  const [cancelling, setCancelling] = useState(null)
  const [approving, setApproving] = useState(null)

  const handleCancel = async (id) => {
    setCancelling(id)
    try {
      await hireRequestsApi.cancel(id)
      onCancelled()
    } catch {
      setCancelling(null)
    }
  }

  const handleApproval = async (req, decision) => {
    setApproving(`${req.id}-${decision}`)
    try {
      await positionsApi.approvalDecision(req.position_id, decision)
      onCancelled() // reload
    } catch {
      setApproving(null)
    }
  }

  const lifecycleLabel = (req) => {
    if (req.status === 'cancelled') return { text: 'Cancelled', color: 'var(--color-text-secondary)' }
    if (!req.position_id) {
      if (req.status === 'accepted') return { text: 'JD in progress…', color: '#3b82f6' }
      return { text: 'Pending pickup', color: '#f59e0b' }
    }
    if (req.position_approval_status === 'pending') return { text: 'JD ready – awaiting approval', color: '#f59e0b' }
    if (req.position_approval_status === 'changes_requested') return { text: 'Changes requested', color: '#ef4444' }
    return { text: 'Active', color: '#22c55e' }
  }

  if (requests.length === 0) return (
    <div className="dash-card dash-card--compact">
      <h3 className="dash-card-title" style={{ marginBottom: 'var(--space-3)' }}>My Hire Requests</h3>
      <div className="dash-empty" style={{ padding: 'var(--space-4)' }}>
        <span className="dash-empty-icon">📋</span>
        <p className="dash-empty-desc">No requests yet. Use "Request a Hire" to get started.</p>
      </div>
    </div>
  )

  return (
    <div className="dash-card dash-card--compact">
      <h3 className="dash-card-title" style={{ marginBottom: 'var(--space-3)' }}>My Hire Requests</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {requests.map(req => {
          const { text: stateText, color: stateColor } = lifecycleLabel(req)
          const needsApproval = req.position_id && req.position_approval_status === 'pending'
          const isActive = req.position_id && req.position_approval_status === 'approved'
          return (
            <div
              key={req.id}
              style={{
                padding: '10px 12px', borderRadius: 8,
                background: needsApproval ? 'rgba(245,158,11,0.06)' : 'var(--color-bg-secondary)',
                border: `1px solid ${needsApproval ? 'rgba(245,158,11,0.3)' : 'var(--color-border)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{req.role_name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: stateColor }}>{stateText}</span>
              </div>

              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: needsApproval || isActive ? 8 : 0 }}>
                {req.headcount} headcount · {req.work_type}
                {req.target_start && ` · by ${req.target_start}`}
              </div>

              {/* Pipeline stats when position is active */}
              {isActive && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
                    <strong>{req.candidate_count ?? 0}</strong> candidates
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
                    <strong>{req.interview_count ?? 0}</strong> in interview
                  </span>
                </div>
              )}

              {/* JD approval actions */}
              {needsApproval && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 11, padding: '4px 10px', flex: 1 }}
                    onClick={() => handleApproval(req, 'approved')}
                    disabled={!!approving}
                  >
                    {approving === `${req.id}-approved` ? '…' : 'Approve JD'}
                  </button>
                  <button
                    style={{
                      fontSize: 11, padding: '4px 10px', flex: 1, borderRadius: 6,
                      background: 'transparent', border: '1px solid var(--color-border)',
                      cursor: 'pointer', color: 'var(--color-text-secondary)',
                    }}
                    onClick={() => handleApproval(req, 'changes_requested')}
                    disabled={!!approving}
                  >
                    {approving === `${req.id}-changes_requested` ? '…' : 'Request Changes'}
                  </button>
                </div>
              )}

              {/* Cancel option for pending requests */}
              {req.status === 'pending' && (
                <div style={{ marginTop: 4 }}>
                  <button
                    style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 6,
                      background: 'transparent', border: '1px solid var(--color-border)',
                      cursor: 'pointer', color: 'var(--color-danger)',
                    }}
                    onClick={() => handleCancel(req.id)}
                    disabled={cancelling === req.id}
                  >
                    {cancelling === req.id ? '…' : 'Cancel request'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Hire Request Modal ───────────────────────────────────────────────────────

function HireRequestModal({ onClose, onSubmitted }) {
  const [form, setForm] = useState({
    role_name: '',
    headcount: 1,
    work_type: 'onsite',
    experience_min: '',
    experience_max: '',
    target_start: '',
    requirements: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.role_name.trim()) { setError('Role name is required.'); return }
    setSaving(true)
    setError('')
    try {
      await hireRequestsApi.create({
        ...form,
        headcount: parseInt(form.headcount) || 1,
        experience_min: form.experience_min ? parseInt(form.experience_min) : null,
        experience_max: form.experience_max ? parseInt(form.experience_max) : null,
      })
      onSubmitted()
    } catch (err) {
      setError(err.message || 'Failed to submit request.')
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderRadius: 16, padding: 28, width: '100%', maxWidth: 480,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, flex: 1 }}>Request a Hire</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-text-secondary)', lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="settings-field">
            <label className="settings-label">Role Name *</label>
            <input className="settings-input" value={form.role_name} onChange={e => set('role_name', e.target.value)} placeholder="e.g. Senior Backend Engineer" autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="settings-field">
              <label className="settings-label">Headcount</label>
              <input className="settings-input" type="number" min="1" max="50" value={form.headcount} onChange={e => set('headcount', e.target.value)} />
            </div>
            <div className="settings-field">
              <label className="settings-label">Work Type</label>
              <select className="settings-input" value={form.work_type} onChange={e => set('work_type', e.target.value)}>
                <option value="onsite">Onsite</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="settings-field">
              <label className="settings-label">Min Experience (yrs)</label>
              <input className="settings-input" type="number" min="0" value={form.experience_min} onChange={e => set('experience_min', e.target.value)} placeholder="e.g. 3" />
            </div>
            <div className="settings-field">
              <label className="settings-label">Max Experience (yrs)</label>
              <input className="settings-input" type="number" min="0" value={form.experience_max} onChange={e => set('experience_max', e.target.value)} placeholder="e.g. 8" />
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">Target Start Date</label>
            <input className="settings-input" type="date" value={form.target_start} onChange={e => set('target_start', e.target.value)} />
          </div>

          <div className="settings-field">
            <label className="settings-label">Key Requirements</label>
            <textarea
              className="settings-input"
              rows={4}
              value={form.requirements}
              onChange={e => set('requirements', e.target.value)}
              placeholder="Skills, qualifications, or context the recruiter should know..."
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Draft Positions ──────────────────────────────────────────────────────────

function DraftsSection({ drafts, navigate }) {
  if (drafts.length === 0) return (
    <div className="dash-card dash-card--compact">
      <div className="dash-card-head">
        <h3 className="dash-card-title">Drafts</h3>
      </div>
      <div className="dash-empty" style={{ padding: 'var(--space-4)' }}>
        <span className="dash-empty-icon">📝</span>
        <p className="dash-empty-title">No drafts yet.</p>
        <p className="dash-empty-desc">Save a JD as draft from the chat to resume it here.</p>
      </div>
    </div>
  )

  return (
    <div className="dash-card dash-card--compact">
      <div className="dash-card-head">
        <h3 className="dash-card-title">Drafts</h3>
        <span className="dash-card-badge">{drafts.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {drafts.map(p => (
          <div
            key={p.id}
            style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer',
            }}
            onClick={() => p.session_id ? navigate(`/chat/${p.session_id}`) : navigate('/positions')}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.role_name || 'Untitled position'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {p.department_name || (p.department_id ? `Dept #${p.department_id}` : 'No dept')}
                {p.updated_at && ` · edited ${timeAgo(p.updated_at)}`}
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-primary)', flexShrink: 0 }}>Resume →</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

// ── Stats Strip ─────────────────────────────────────────────────────────────

function StatsStrip({ stats, role }) {
  if (!stats) return null

  const cards = [
    { key: 'positions', label: 'Open Positions', value: stats.active_positions ?? 0, icon: '💼', gradient: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)', roles: ['org_head', 'dept_admin', 'hr', 'team_lead'] },
    { key: 'candidates', label: 'Total Candidates', value: stats.total_candidates ?? 0, icon: '👥', gradient: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)', roles: ['org_head', 'dept_admin', 'team_lead'] },
    { key: 'applied', label: 'Applications', value: stats.applied_this_period ?? 0, icon: '📋', gradient: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)', roles: ['org_head', 'dept_admin', 'hr', 'team_lead'] },
    { key: 'interviews', label: 'Interviews', value: stats.interviews_this_period ?? 0, icon: '🎯', gradient: 'linear-gradient(135deg, #06B6D4 0%, #22D3EE 100%)', roles: ['org_head', 'dept_admin', 'hr', 'team_lead'] },
    { key: 'offers', label: 'Offers', value: stats.offers_this_period ?? 0, icon: '🎉', gradient: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)', roles: ['org_head', 'dept_admin', 'team_lead'] },
    { key: 'time', label: 'Avg. Time to Hire', value: stats.avg_time_to_hire ? `${stats.avg_time_to_hire}d` : '—', icon: '⏱', gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', roles: ['org_head', 'dept_admin'] },
  ].filter(c => c.roles.includes(role))

  return (
    <div className="dash-stats">
      {cards.map(c => (
        <div key={c.key} className="dash-stat-card">
          <div className="dash-stat-icon-wrap" style={{ background: c.gradient }}>
            <span className="dash-stat-icon">{c.icon}</span>
          </div>
          <div className="dash-stat-info">
            <div className="dash-stat-value">{c.value}</div>
            <div className="dash-stat-label">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Funnel Visualization ────────────────────────────────────────────────────

function FunnelViz({ funnel, role }) {
  const stages = [
    { key: 'sourced', label: 'Sourced', color: '#06B6D4', emoji: '🔍' },
    { key: 'emailed', label: 'Outreach', color: '#8B5CF6', emoji: '📧' },
    { key: 'applied', label: 'Applied', color: '#3B82F6', emoji: '📋' },
    { key: 'screening', label: 'Screening', color: '#0D9488', emoji: '🔎' },
    { key: 'interview', label: 'Interview', color: '#6366F1', emoji: '🎙' },
    { key: 'selected', label: 'Selected', color: '#10B981', emoji: '✅' },
  ]
  const maxVal = Math.max(...stages.map(s => funnel[s.key] || 0), 1)

  // Calculate conversion rates between stages
  const conversions = stages.slice(1).map((s, i) => {
    const prev = funnel[stages[i].key] || 0
    const curr = funnel[s.key] || 0
    return prev > 0 ? Math.round((curr / prev) * 100) : 0
  })

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3 className="dash-card-title">Hiring Funnel</h3>
        <span className="dash-card-badge">
          {role === 'org_head' ? 'Org-wide' : 'Department'}
        </span>
      </div>
      <div className="funnel-viz">
        {stages.map((s, idx) => {
          const val = funnel[s.key] || 0
          const pct = (val / maxVal) * 100
          return (
            <React.Fragment key={s.key}>
              <div className="funnel-stage">
                <div className="funnel-stage-label">
                  <span className="funnel-emoji">{s.emoji}</span>
                  <span>{s.label}</span>
                </div>
                <div className="funnel-bar-track">
                  <div className="funnel-bar-fill" style={{ width: `${Math.max(pct, 2)}%`, background: s.color }} />
                </div>
                <span className="funnel-count" style={{ color: s.color }}>{val}</span>
              </div>
              {idx < stages.length - 1 && conversions[idx] !== undefined && (
                <div className="funnel-conversion">
                  <span className="funnel-conv-arrow">↓</span>
                  <span className="funnel-conv-pct">{conversions[idx]}%</span>
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ── Pipeline Health (donut-style metric) ────────────────────────────────────

function PipelineHealth({ stats }) {
  const total = stats.total_candidates || 0
  const active = stats.active_positions || 0
  const applied = stats.applied_this_period || 0
  const ratio = active > 0 ? Math.round(total / active) : 0

  return (
    <div className="dash-card dash-card--compact">
      <h3 className="dash-card-title" style={{ marginBottom: 'var(--space-3)' }}>Pipeline Health</h3>
      <div className="health-metrics">
        <div className="health-metric">
          <div className="health-metric-value">{ratio}</div>
          <div className="health-metric-label">Candidates per position</div>
        </div>
        <div className="health-metric">
          <div className="health-metric-value">{applied}</div>
          <div className="health-metric-label">Applications this period</div>
        </div>
        <div className="health-metric">
          <div className="health-metric-value">{active}</div>
          <div className="health-metric-label">Active positions</div>
        </div>
      </div>
    </div>
  )
}

// ── Positions Section ───────────────────────────────────────────────────────

function PositionsSection({ positions, role, loading }) {
  const label = role === 'org_head' ? 'All Open Positions' : (role === 'team_lead' || role === 'dept_admin') ? 'Department Positions' : 'My Positions'

  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <h3 className="dash-card-title">{label}</h3>
        <Link to="/positions" className="dash-card-link">View all →</Link>
      </div>
      {loading ? (
        <div className="skeleton-block" style={{ height: 180, borderRadius: 10 }} />
      ) : positions.length === 0 ? (
        <div className="dash-empty">
          <span className="dash-empty-icon">💼</span>
          <p className="dash-empty-title">No open positions yet</p>
          <p className="dash-empty-desc">
            {role === 'hr' ? 'No positions assigned to you' : 'Create your first position to start hiring'}
          </p>
          {role !== 'hr' && (
            <Link to="/chat" className="dash-empty-cta">✨ Create position</Link>
          )}
        </div>
      ) : (
        <div className="dash-positions-table">
          <div className="dash-pos-header-row">
            <span>Position</span>
            <span>Department</span>
            <span>Status</span>
            <span>Candidates</span>
          </div>
          {positions.slice(0, 8).map(p => (
            <Link key={p.id} to={`/positions/${p.id}`} className="dash-pos-row">
              <span className="dash-pos-name">{p.role_name}</span>
              <span className="dash-pos-dept">{p.department_name || '—'}</span>
              <StatusBadge status={p.status} type="position" size="xs" />
              <span className="dash-pos-count">{p.total_candidates || 0}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Activity Feed ───────────────────────────────────────────────────────────

function ActivityFeed({ activity, loading }) {
  return (
    <div className="dash-card dash-card--feed">
      <h3 className="dash-card-title" style={{ padding: 'var(--space-4) var(--space-4) var(--space-2)' }}>Activity Feed</h3>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-3)' }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton-block" style={{ height: 44, borderRadius: 8 }} />)}
        </div>
      ) : activity.length === 0 ? (
        <div className="dash-empty" style={{ padding: 'var(--space-6)' }}>
          <span className="dash-empty-icon">📋</span>
          <p className="dash-empty-title">No recent activity</p>
          <p className="dash-empty-desc">Events appear as candidates move through the pipeline</p>
        </div>
      ) : (
        <div className="dash-activity-list">
          {activity.slice(0, 12).map(evt => (
            <div key={evt.id} className="dash-activity-row">
              <span className="dash-activity-dot" />
              <div className="dash-activity-body">
                <p className="dash-activity-text">{formatEvent(evt)}</p>
                <span className="dash-activity-time">{timeAgo(evt.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Quick Actions (recruiter) ───────────────────────────────────────────────

function QuickActions({ navigate }) {
  const actions = [
    { icon: '✨', label: 'New Hire', to: '/chat' },
    { icon: '🗃', label: 'Talent Pool', to: '/talent-pool' },
    { icon: '💼', label: 'Positions', to: '/positions' },
    { icon: '⚙️', label: 'Settings', to: '/settings' },
  ]

  return (
    <div className="dash-card dash-card--compact">
      <h3 className="dash-card-title" style={{ marginBottom: 'var(--space-3)' }}>Quick Actions</h3>
      <div className="dash-quick-grid">
        {actions.map(a => (
          <button key={a.to} className="dash-quick-btn" onClick={() => navigate(a.to)}>
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Dept Overview (admin only) ──────────────────────────────────────────────

function DeptOverview({ positions }) {
  // Derive dept summary from already-loaded positions
  const deptMap = {}
  for (const p of positions) {
    const dept = p.department_name || 'General'
    if (!deptMap[dept]) deptMap[dept] = { name: dept, positions: 0, candidates: 0 }
    deptMap[dept].positions += 1
    deptMap[dept].candidates += p.total_candidates || 0
  }
  const depts = Object.values(deptMap).sort((a, b) => b.candidates - a.candidates)
  if (depts.length === 0) return null

  return (
    <div className="dash-card" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="dash-card-head">
        <h3 className="dash-card-title">Department Overview</h3>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{depts.length} departments with open positions</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {depts.map(d => (
          <div key={d.name} style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--color-text-primary)' }}>{d.name}</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-secondary)' }}>
              <span>💼 {d.positions} open</span>
              <span>👥 {d.candidates} candidates</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Today's Focus (recruiter only) ──────────────────────────────────────────

function TodaysFocus({ stats, navigate }) {
  const items = [
    stats.applied_this_period > 0 && {
      icon: '📥', color: '#3B82F6',
      label: `${stats.applied_this_period} new application${stats.applied_this_period !== 1 ? 's' : ''} to review`,
      to: '/positions',
    },
    stats.interviews_this_period > 0 && {
      icon: '🎙', color: '#6366F1',
      label: `${stats.interviews_this_period} interview${stats.interviews_this_period !== 1 ? 's' : ''} scheduled`,
      to: '/positions',
    },
    stats.pending_feedback > 0 && {
      icon: '⏳', color: '#D97706',
      label: `${stats.pending_feedback} panel feedback${stats.pending_feedback !== 1 ? 's' : ''} still pending`,
      to: '/positions',
    },
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <div className="dash-card" style={{ marginBottom: 'var(--space-4)' }}>
      <h3 className="dash-card-title" style={{ marginBottom: 'var(--space-3)' }}>Today's Focus</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => navigate(item.to)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer', textAlign: 'left', width: '100%',
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>{item.label}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-secondary)' }}>View →</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Skeletons ───────────────────────────────────────────────────────────────

function StatsSkeleton({ count = 4 }) {
  return (
    <div className="dash-stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-block" style={{ height: 88, borderRadius: 14 }} />
      ))}
    </div>
  )
}

// ── Format helpers ──────────────────────────────────────────────────────────

function formatEvent(evt) {
  const c = evt.candidate_name || 'Candidate'
  const p = evt.position_title || 'position'
  const t = evt.event_type
  if (t === 'applied') return `${c} applied for ${p}`
  if (t === 'sourced') return `New candidate sourced for ${p}`
  if (t === 'status_changed') return `${c} moved to ${evt.event_data?.new_status || 'next stage'}`
  if (t === 'interview_scheduled') return `Interview scheduled for ${c}`
  if (t === 'selected') return `${c} selected for ${p}`
  return t.replace(/_/g, ' ')
}


// ── AI Copilot Bar ──────────────────────────────────────────────────────────

const SUGGESTION_ICONS = {
  uncontacted_high_score: { icon: '🔥', color: '#F97316' },
  overdue_feedback: { icon: '⏰', color: '#D97706' },
  stale_position: { icon: '📉', color: '#EF4444' },
  interview_today: { icon: '🎙', color: '#6366F1' },
  pending_rejection: { icon: '📤', color: '#8B5CF6' },
  pool_match: { icon: '🎯', color: '#10B981' },
  default: { icon: '💡', color: '#0D9488' },
}

function CopilotBar({ suggestions, onDismiss, onDismissAll, navigate }) {
  if (!suggestions || suggestions.length === 0) return null

  return (
    <div className="copilot-bar">
      <div className="copilot-header">
        <div className="copilot-badge">
          <span className="copilot-pulse" />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27A7 7 0 0 1 14 23h-4a7 7 0 0 1-6.73-4H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 12 2z"/>
            <circle cx="9" cy="15" r="1" fill="currentColor"/>
            <circle cx="15" cy="15" r="1" fill="currentColor"/>
          </svg>
          AI Copilot
        </div>
        <span className="copilot-count">{suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}</span>
        <button className="copilot-dismiss-all" onClick={onDismissAll}>Dismiss All</button>
      </div>

      <div className="copilot-suggestions">
        {suggestions.slice(0, 5).map(s => {
          const cfg = SUGGESTION_ICONS[s.type] || SUGGESTION_ICONS.default
          return (
            <div key={s.id} className="copilot-suggestion">
              <span className="copilot-suggestion-icon" style={{ color: cfg.color }}>
                {cfg.icon}
              </span>
              <div className="copilot-suggestion-body">
                <p className="copilot-suggestion-text">{s.title}</p>
                {s.created_at && (
                  <span className="copilot-suggestion-time">{timeAgo(s.created_at)}</span>
                )}
              </div>
              {s.action_url && (
                <button
                  className="copilot-action-btn"
                  onClick={() => navigate(s.action_url)}
                >
                  {s.action_label || 'View →'}
                </button>
              )}
              <button
                className="copilot-dismiss-btn"
                onClick={() => onDismiss(s.id)}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
