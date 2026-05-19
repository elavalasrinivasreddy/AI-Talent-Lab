import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hireRequestsApi } from '../../utils/api'
import HireRequestCard from './HireRequestCard'
import { PlusIcon, InboxIcon, AlertIcon, SpinnerIcon } from './icons'
import './HireRequests.css'

const FILTERS = [
  { key: 'queue',     label: 'Pending pickup', scopeStatus: { scope: 'all', status: 'pending' }, roles: ['admin', 'recruiter'] },
  { key: 'mine',      label: 'Mine',           scopeStatus: { scope: 'mine' },                    roles: ['admin', 'recruiter', 'hiring_manager', 'dept_admin'] },
  { key: 'accepted',  label: 'In progress',    scopeStatus: { scope: 'all', status: 'accepted' }, roles: ['admin', 'recruiter'] },
  { key: 'fulfilled', label: 'Fulfilled',      scopeStatus: { scope: 'all', status: 'fulfilled' },roles: ['admin', 'recruiter'] },
  { key: 'cancelled', label: 'Cancelled',      scopeStatus: { scope: 'all', status: 'cancelled' },roles: ['admin', 'recruiter'] },
  { key: 'all',       label: 'All',            scopeStatus: { scope: 'all' },                     roles: ['admin', 'recruiter'] },
]

/**
 * /hire-requests
 * Lists requests with role-aware filter chips. Hiring managers default to
 * "Mine"; admins/recruiters default to the pending work queue.
 */
export default function HireRequestListPage() {
  const { user } = useAuth()
  const role = user?.role || 'recruiter'
  const canFile = ['hiring_manager', 'dept_admin', 'admin'].includes(role)

  const availableFilters = useMemo(
    () => FILTERS.filter(f => f.roles.includes(role)),
    [role],
  )
  const defaultFilter = role === 'hiring_manager' ? 'mine' : (availableFilters[0]?.key || 'mine')

  const [activeFilter, setActiveFilter] = useState(defaultFilter)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const filter = availableFilters.find(f => f.key === activeFilter) || availableFilters[0]
    if (!filter) return
    let cancelled = false
    setLoading(true)
    setError('')
    hireRequestsApi.list(filter.scopeStatus)
      .then(res => {
        if (!cancelled) setRequests(res?.requests || [])
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || 'Couldn\'t load hire requests.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [activeFilter, availableFilters])

  return (
    <div className="hr-page">
      <header className="hr-page-head">
        <div>
          <h1 className="hr-page-title">Hire requests</h1>
          <p className="hr-page-sub">
            {role === 'hiring_manager'
              ? 'Your open requests and their status.'
              : 'Requests filed across the org — pick one up to start the JD.'}
          </p>
        </div>
        {canFile && (
          <Link to="/hire-requests/new" className="hr-btn hr-btn-primary">
            <PlusIcon /> New request
          </Link>
        )}
      </header>

      {availableFilters.length > 1 && (
        <nav className="hr-filters" aria-label="Filter hire requests">
          {availableFilters.map(f => (
            <button
              key={f.key}
              type="button"
              className="hr-filter-chip"
              data-active={activeFilter === f.key || undefined}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </nav>
      )}

      {error && (
        <div className="hr-banner tone-danger" role="alert">
          <AlertIcon /> <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="hr-skeleton-list">
          {[0, 1, 2].map(i => <div key={i} className="hr-skeleton-card" />)}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState canFile={canFile} filter={activeFilter} />
      ) : (
        <ul className="hr-card-list">
          {requests.map(r => (
            <li key={r.id}><HireRequestCard request={r} /></li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyState({ canFile, filter }) {
  const message = filter === 'mine'
    ? 'You haven\'t filed any hire requests yet.'
    : 'Nothing here right now.'
  return (
    <div className="hr-empty">
      <span className="hr-empty-icon"><InboxIcon size={28} /></span>
      <h3>{message}</h3>
      {canFile && (
        <>
          <p>File one to get the AI started on the JD.</p>
          <Link to="/hire-requests/new" className="hr-btn hr-btn-primary">
            <PlusIcon /> File first request
          </Link>
        </>
      )}
    </div>
  )
}
