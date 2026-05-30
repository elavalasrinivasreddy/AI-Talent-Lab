import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hireRequestsApi } from '../../utils/api'
import RelayVisualization from './RelayVisualization'
import {
  statusLabel, statusTone, timeAgo, formatCompBand, formatExperience,
  WORK_TYPE_LABEL,
} from './helpers'
import {
  ArrowLeftIcon, AlertIcon, SpinnerIcon, CheckIcon, XIcon,
} from './icons'
import './HireRequests.css'

/**
 * /hire-requests/:id — detail with relay viz, role-aware action bar.
 */
export default function HireRequestDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [req, setReq] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await hireRequestsApi.get(id)
      setReq(res?.request || null)
      setError('')
    } catch (err) {
      setError(err?.message || 'Couldn\'t load request.')
      setReq(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [id])

  if (loading) return <div className="hr-page"><div className="hr-card-skeleton-large" /></div>
  if (!req) {
    return (
      <div className="hr-page">
        <Link to="/hire-requests" className="hr-back-link"><ArrowLeftIcon /> Hire requests</Link>
        <div className="hr-banner tone-danger" role="alert">
          <AlertIcon /> <span>{error || 'Not found.'}</span>
        </div>
      </div>
    )
  }

  const role = user?.role
  const isOwner = req.requested_by === user?.id
  const isAdmin = role === 'org_head' || role === 'dept_admin'
  const isRecruiter = role === 'hr' || role === 'org_head'

  const canEdit = (isOwner || isAdmin) && req.status === 'pending'
  const canCancel = (isOwner || isAdmin) && !['cancelled', 'fulfilled', 'rejected'].includes(req.status)
  const canPickup = isRecruiter && req.status === 'approved'
  const canApprove = isAdmin && req.status === 'pending'

  const handleApprove = async () => {
    setBusy('approve')
    try {
      const res = await hireRequestsApi.approve(req.id)
      setReq(res?.request || null)
      setError('')
    } catch (err) {
      setError(err?.message || 'Couldn\'t approve request.')
    } finally {
      setBusy(null)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('Please enter a reason for rejection.')
      return
    }
    setBusy('reject')
    try {
      const res = await hireRequestsApi.reject(req.id, rejectReason.trim())
      setReq(res?.request || null)
      setRejectOpen(false)
      setRejectReason('')
      setError('')
    } catch (err) {
      setError(err?.message || 'Couldn\'t reject request.')
    } finally {
      setBusy(null)
    }
  }

  const handlePickup = async () => {
    setBusy('pickup')
    try {
      await hireRequestsApi.accept(req.id)
      // Hand off to JD chat with full context (existing pattern in ChatContext).
      navigate('/chat', {
        state: {
          hireRequest: {
            id: req.id,
            role_name: req.role_name,
            department_name: req.department_name,
            headcount: req.headcount,
            work_type: req.work_type,
            location: req.location,
            experience_min: req.experience_min,
            experience_max: req.experience_max,
            comp_min: req.comp_min,
            comp_max: req.comp_max,
            target_start: req.target_start,
            requirements: req.requirements,
            requested_by_name: req.requested_by_name,
          },
        },
      })
    } catch (err) {
      setError(err?.message || 'Couldn\'t pick up.')
      setBusy(null)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel this hire request? You can\'t undo this.')) return
    setBusy('cancel')
    try {
      await hireRequestsApi.cancel(req.id)
      await load()
    } catch (err) {
      setError(err?.message || 'Couldn\'t cancel.')
    } finally {
      setBusy(null)
    }
  }

  const tone = statusTone(req)
  const comp = formatCompBand(req)
  const exp = formatExperience(req)

  return (
    <div className="hr-page">
      <header className="hr-page-head">
        <div>
          <Link to="/hire-requests" className="hr-back-link"><ArrowLeftIcon /> Hire requests</Link>
          <h1 className="hr-page-title">{req.role_name}</h1>
          <p className="hr-page-sub">
            Filed by {req.requested_by_name || 'Someone'} · {timeAgo(req.created_at)}
          </p>
        </div>
        <span className={`hr-status-pill tone-${tone} hr-status-pill-lg`}>{statusLabel(req)}</span>
      </header>

      <RelayVisualization request={req} />

      {error && (
        <div className="hr-banner tone-danger" role="alert">
          <AlertIcon /> <span>{error}</span>
        </div>
      )}

      <div className="hr-detail-grid">
        <section className="hr-detail-section">
          <h2 className="hr-form-section-title">The role</h2>
          <dl className="hr-meta-grid">
            <Meta label="Department">{req.department_name || '—'}</Meta>
            <Meta label="Location">{req.location || '—'}</Meta>
            <Meta label="Work type">{WORK_TYPE_LABEL[req.work_type] || req.work_type || '—'}</Meta>
            <Meta label="Headcount">{req.headcount}</Meta>
            <Meta label="Experience">{exp || '—'}</Meta>
            <Meta label="Compensation">{comp || '—'}</Meta>
            <Meta label="Target start">{req.target_start || '—'}</Meta>
            {req.position_role_name && (
              <Meta label="Linked position">
                <Link to={`/positions/${req.position_id}`} className="hr-text-link">
                  {req.position_role_name}
                </Link>
              </Meta>
            )}
          </dl>

          {req.requirements && (
            <>
              <h3 className="hr-form-subsection-title">Key requirements</h3>
              <p className="hr-requirements-body">{req.requirements}</p>
            </>
          )}
        </section>

        <aside className="hr-detail-side">
          <div className="hr-side-card">
            <h3>Pipeline impact</h3>
            <ul className="hr-side-stats">
              <li>
                <span className="hr-side-num">{req.candidate_count ?? 0}</span>
                <span className="hr-side-label">candidates</span>
              </li>
              <li>
                <span className="hr-side-num">{req.interview_count ?? 0}</span>
                <span className="hr-side-label">in interview</span>
              </li>
            </ul>
            {req.position_id && (
              <Link to={`/positions/${req.position_id}`} className="hr-btn hr-btn-secondary hr-btn-block">
                Open position →
              </Link>
            )}
          </div>

          <div className="hr-side-card hr-side-card-actions">
            <h3>Actions</h3>

            {/* dept_admin / org_head: approve or reject while pending */}
            {canApprove && (
              <>
                <button
                  type="button"
                  className="hr-btn hr-btn-primary hr-btn-block"
                  onClick={handleApprove}
                  disabled={busy !== null}
                >
                  {busy === 'approve' ? <><SpinnerIcon /> Approving…</> : <><CheckIcon /> Approve request</>}
                </button>

                {rejectOpen ? (
                  <div className="hr-reject-inline">
                    <label className="hr-reject-label">Reason for rejection</label>
                    <textarea
                      className="hr-reject-textarea"
                      rows={3}
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Explain why the request isn't approved…"
                      autoFocus
                    />
                    <div className="hr-reject-actions">
                      <button
                        type="button"
                        className="hr-btn hr-btn-ghost-danger"
                        onClick={handleReject}
                        disabled={busy !== null || !rejectReason.trim()}
                      >
                        {busy === 'reject' ? <><SpinnerIcon /> Rejecting…</> : 'Confirm rejection'}
                      </button>
                      <button
                        type="button"
                        className="hr-btn hr-btn-ghost"
                        onClick={() => { setRejectOpen(false); setRejectReason('') }}
                        disabled={busy !== null}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="hr-btn hr-btn-ghost-danger hr-btn-block"
                    onClick={() => setRejectOpen(true)}
                    disabled={busy !== null}
                  >
                    <XIcon /> Reject request
                  </button>
                )}
              </>
            )}

            {/* HR / org_head: pick up after dept approval */}
            {canPickup && (
              <button
                type="button"
                className="hr-btn hr-btn-primary hr-btn-block"
                onClick={handlePickup}
                disabled={busy !== null}
              >
                {busy === 'pickup' ? <><SpinnerIcon /> Picking up…</> : <><CheckIcon /> Pick up & start JD chat</>}
              </button>
            )}

            {canEdit && (
              <Link to={`/hire-requests/${req.id}/edit`} className="hr-btn hr-btn-secondary hr-btn-block">
                Edit request
              </Link>
            )}
            {canCancel && (
              <button
                type="button"
                className="hr-btn hr-btn-ghost-danger hr-btn-block"
                onClick={handleCancel}
                disabled={busy !== null}
              >
                {busy === 'cancel' ? <><SpinnerIcon /> Cancelling…</> : <><XIcon /> Cancel request</>}
              </button>
            )}
            {!canApprove && !canPickup && !canEdit && !canCancel && (
              <p className="hr-side-empty">No actions available for this request.</p>
            )}

            {/* Rejection reason display (read-only, once rejected) */}
            {req.status === 'rejected' && req.rejection_reason && (
              <div className="hr-rejection-display">
                <p className="hr-rejection-label">Rejection reason</p>
                <p className="hr-rejection-body">{req.rejection_reason}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Meta({ label, children }) {
  return (
    <div className="hr-meta-cell">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
