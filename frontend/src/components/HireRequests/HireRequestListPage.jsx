import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { hireRequestsApi } from '../../utils/api'
import HireRequestCard from './HireRequestCard'
import { PlusIcon, InboxIcon, AlertIcon, SpinnerIcon } from './icons'
import './HireRequests.css'

const FILTERS = [
  { key: 'queue_approval', label: 'Pending approval', scopeStatus: { scope: 'default', status: 'pending' },  roles: ['dept_admin', 'org_head'] },
  { key: 'queue_pickup',   label: 'Pending pickup',   scopeStatus: { scope: 'default', status: 'approved' }, roles: ['hr', 'org_head'] },
  { key: 'mine',           label: 'Mine',             scopeStatus: { scope: 'mine' },                    roles: ['org_head', 'hr', 'team_lead', 'dept_admin'] },
  { key: 'accepted',       label: 'In progress',      scopeStatus: { scope: 'default', status: 'accepted' }, roles: ['org_head', 'hr', 'dept_admin'] },
  { key: 'fulfilled',      label: 'Fulfilled',        scopeStatus: { scope: 'default', status: 'fulfilled' },roles: ['org_head', 'hr', 'dept_admin'] },
  { key: 'cancelled',      label: 'Cancelled',        scopeStatus: { scope: 'default', status: 'cancelled' },roles: ['org_head', 'hr', 'dept_admin'] },
  { key: 'all',            label: 'All',              scopeStatus: { scope: 'default', status: 'all' },      roles: ['org_head', 'hr', 'dept_admin'] },
]

/**
 * /hire-requests
 * Lists requests with role-aware filter chips. Hiring managers default to
 * "Mine"; admins/recruiters default to the pending work queue.
 */
export default function HireRequestListPage() {
  const { user } = useAuth()
  const role = user?.role || 'hr'
  const canFile = ['team_lead', 'dept_admin', 'org_head'].includes(role)

  const availableFilters = useMemo(
    () => FILTERS.filter(f => f.roles.includes(role)),
    [role],
  )
  const defaultFilter = role === 'team_lead' ? 'mine' : (availableFilters[0]?.key || 'mine')

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
            {role === 'team_lead'
              ? 'Your open requests and their status.'
              : role === 'org_head'
                ? 'Requests filed across the org — pick one up to start the JD.'
                : 'Requests filed in your department — pick one up to start the JD.'}
          </p>
        </div>
        {canFile && (requests.length > 0 || loading) && (
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
