/**
 * PositionsListPage.jsx — v3 Pipeline Garden
 * Route: /positions
 * Redesigned 2026-05-29 per docs/design/pages/02_positions_list.md
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { positionsApi, settingsApi } from '../../utils/api'
import { useAuth } from '../../context/AuthContext'
import PositionGarden from './PositionGarden'
import PositionsToolbar from './PositionsToolbar'
import './PositionsListPage.css'

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 }

function isStalled(p) {
  if (p.status !== 'open') return false
  if (!p.last_search_at) return true
  return (Date.now() - new Date(p.last_search_at).getTime()) / 86400000 > 7
}

function totalCount(p) {
  const sc = p.stageCounts || {}
  return Object.values(sc).reduce((a, b) => a + b, 0)
}

export default function PositionsListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  // Only show department filters if the user has cross-department visibility
  const canFilterByDept = user?.role === 'org_head' || (user?.role === 'hr' && !user?.department_id)

  const [positions, setPositions]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [search, setSearch]           = useState('')
  const [segment, setSegment]         = useState('')
  const [dept, setDept]               = useState('')
  const [sort, setSort]               = useState('urgency')
  const [departments, setDepartments] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rawPositions, rawDepts] = await Promise.all([
        positionsApi.list({}),
        canFilterByDept ? settingsApi.getDepartments() : Promise.resolve({ departments: [] })
      ])
      
      const list = Array.isArray(rawPositions) ? rawPositions : (rawPositions.positions || [])
      
      if (canFilterByDept && rawDepts.departments) {
        setDepartments(rawDepts.departments.map(d => ({ id: d.id, name: d.name })))
      }

      // Enrich each card with sparkline + stage counts in parallel
      const enriched = await Promise.all(
        list.map(async p => {
          const [sparkResult, stageResult] = await Promise.allSettled([
            positionsApi.applicantsDaily(p.id),
            positionsApi.stageCounts(p.id),
          ])
          return {
            ...p,
            sparklineData: sparkResult.status === 'fulfilled' ? sparkResult.value : [],
            stageCounts:   stageResult.status === 'fulfilled' ? stageResult.value : {},
          }
        })
      )
      setPositions(enriched)
    } catch (e) {
      setError('Failed to load positions.')
    } finally {
      setLoading(false)
    }
  }, [canFilterByDept])

  useEffect(() => { load() }, [load])

  // Compute segment counts
  const segmentCounts = {
    '':       positions.length,
    critical: positions.filter(p => p.priority === 'urgent' && p.status === 'open').length,
    active:   positions.filter(p => p.status === 'open').length,
    stable:   positions.filter(p => p.status === 'open' && !isStalled(p)).length,
    draft:    positions.filter(p => p.status === 'draft').length,
    closed:   positions.filter(p => p.status === 'closed' || p.status === 'archived').length,
  }

  // Filter
  const filtered = positions.filter(p => {
    if (search && !p.role_name.toLowerCase().includes(search.toLowerCase())) return false
    if (dept && String(p.department_id) !== String(dept)) return false
    if (segment === 'critical') return p.priority === 'urgent' && p.status === 'open'
    if (segment === 'active')   return p.status === 'open'
    if (segment === 'stable')   return p.status === 'open' && !isStalled(p)
    if (segment === 'draft')    return p.status === 'draft'
    if (segment === 'closed')   return p.status === 'closed' || p.status === 'archived'
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'newest') return new Date(b.created_at) - new Date(a.created_at)
    if (sort === 'activity') return totalCount(b) - totalCount(a)
    // urgency: stalled first, then priority, then newest
    const aSt = isStalled(a) ? 0 : 1
    const bSt = isStalled(b) ? 0 : 1
    if (aSt !== bSt) return aSt - bSt
    const ap = PRIORITY_ORDER[a.priority] ?? 2
    const bp = PRIORITY_ORDER[b.priority] ?? 2
    if (ap !== bp) return ap - bp
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const openCount = positions.filter(p => p.status === 'open').length

  return (
    <div className="positions-list-page">
      <div className="positions-list-header">
        <div>
          <h1 className="positions-list-title">Positions</h1>
          <p className="positions-list-sub">
            Pipeline Garden{openCount > 0 ? ` · ${openCount} active role${openCount !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
      </div>

      <PositionsToolbar
        search={search}        onSearch={setSearch}
        segment={segment}      onSegment={setSegment}
        dept={dept}            onDept={setDept}
        sort={sort}            onSort={setSort}
        segmentCounts={segmentCounts}
        departments={departments}
        isAdmin={canFilterByDept}
      />

      {error && (
        <div className="positions-error">
          {error} <button onClick={load}>Retry</button>
        </div>
      )}

      {!loading && sorted.length === 0 && !error && (
        <EmptyPositions segment={segment} onClear={() => setSegment('')} role={user?.role} />
      )}

      <PositionGarden
        positions={sorted}
        loading={loading}
        onOpen={id => navigate(`/positions/${id}`)}
      />
    </div>
  )
}

const SEGMENT_LABELS = {
  critical: 'Critical', active: 'Active', stable: 'Stable', draft: 'Drafts', closed: 'Closed',
}

function EmptyPositions({ segment, onClear, role }) {
  const segmentLabel = segment ? (SEGMENT_LABELS[segment] || segment) : null

  return (
    <div className="positions-empty">
      <div className="positions-empty-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      </div>

      <h3 className="positions-empty-title">
        {segmentLabel ? `No ${segmentLabel} positions` : 'No positions yet'}
      </h3>

      {segmentLabel ? (
        <>
          <p className="positions-empty-desc">
            There are no positions in the <strong>{segmentLabel}</strong> category right now.
          </p>
          <button className="positions-empty-cta positions-empty-cta--ghost" onClick={onClear}>
            Show all positions
          </button>
        </>
      ) : (
        <>
          <p className="positions-empty-desc">
            {role === 'team_lead'
              ? 'Positions are created by HR once a hire request is approved.'
              : 'Start a hire conversation with the AI to create your first position.'}
          </p>
          {role !== 'team_lead' && (
            <Link to="/chat" className="positions-empty-cta positions-empty-cta--primary">
              Start a hire conversation
            </Link>
          )}
          {role === 'team_lead' && (
            <Link to="/hire-requests/new" className="positions-empty-cta positions-empty-cta--primary">
              File a hire request
            </Link>
          )}
        </>
      )}
    </div>
  )
}
