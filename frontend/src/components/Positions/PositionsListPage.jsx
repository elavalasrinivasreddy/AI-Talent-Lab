/**
 * PositionsListPage.jsx — View all open positions across the org
 * Route: /positions
 * Per docs/pages/04_position_detail.md and FRONTEND_PLAN.md
 */
import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { positionsApi } from '../../utils/api'
import { POSITION_STATUSES, PRIORITY_LABELS } from '../../utils/constants'
import StatusBadge from '../common/StatusBadge'
import './PositionsListPage.css'

export default function PositionsListPage() {
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const navigate = useNavigate()

  useEffect(() => {
    load()
  }, [filter])

  const load = async () => {
    setLoading(true)
    try {
      const data = await positionsApi.list({ status: filter || undefined })
      setPositions(Array.isArray(data) ? data : data.positions || [])
    } catch (e) {
      console.error('Failed to load positions:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="positions-list-page">
      {/* ── Header ── */}
      <div className="positions-list-header">
        <div>
          <h1 className="positions-list-title">Positions</h1>
          <p className="positions-list-sub">Manage your open roles and hiring pipeline</p>
        </div>
        <Link to="/chat" className="btn-primary positions-new-btn">
          + New Position
        </Link>
      </div>

      {/* ── Filters ── */}
      <div className="positions-filter-bar">
        {['', 'open', 'draft', 'on_hold', 'closed', 'archived'].map(s => (
          <button
            key={s}
            className={`positions-filter-btn ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s ? (POSITION_STATUSES[s]?.label || s) : 'All'}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <PositionsSkeleton />
      ) : positions.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="positions-table-wrap">
          <table className="positions-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Candidates</th>
                <th>Applied</th>
                <th>Interview</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => {
                const priority = PRIORITY_LABELS[p.priority] || PRIORITY_LABELS.normal
                return (
                  <tr
                    key={p.id}
                    className="positions-table-row"
                    onClick={() => navigate(`/positions/${p.id}`)}
                    title="Click to view position"
                  >
                    <td className="positions-col-role">
                      <div className="positions-role-name">{p.role_name}</div>
                      {p.location && (
                        <div className="positions-role-meta">📍 {p.location}</div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={p.status} type="position" size="sm" />
                    </td>
                    <td>
                      <span className="positions-priority" style={{ color: priority.color }}>
                        {priority.label}
                      </span>
                    </td>
                    <td className="positions-col-num">{p.total_candidates || 0}</td>
                    <td className="positions-col-num">{p.applied_count || 0}</td>
                    <td className="positions-col-num">{p.interview_count || 0}</td>
                    <td className="positions-col-date">
                      {new Date(p.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td>
                      <Link
                        to={`/positions/${p.id}`}
                        className="positions-view-link"
                        onClick={e => e.stopPropagation()}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EmptyState({ filter }) {
  return (
    <div className="positions-empty">
      <span className="positions-empty-icon">💼</span>
      <h3>No {filter || ''} positions found</h3>
      <p>
        {filter === 'open'
          ? 'Create your first open position by starting a new chat.'
          : 'Try a different status filter.'}
      </p>
      <Link to="/chat" className="btn-primary">+ Create New Position</Link>
    </div>
  )
}

function PositionsSkeleton() {
  return (
    <div className="positions-table-wrap">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton-block" style={{ height: 60, marginBottom: 8, borderRadius: 10 }} />
      ))}
    </div>
  )
}
