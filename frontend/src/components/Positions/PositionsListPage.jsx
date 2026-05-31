/**
 * PositionsListPage.jsx — v3 Pipeline Garden
 * Route: /positions
 * Redesigned 2026-05-29 per docs/design/pages/02_positions_list.md
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { positionsApi } from '../../utils/api'
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
  const isAdmin = user?.role === 'admin' || user?.role === 'org_admin' || user?.role === 'org_head'

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
      const raw = await positionsApi.list({})
      const list = Array.isArray(raw) ? raw : (raw.positions || [])

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

      // Extract unique departments for admin filter
      const deptMap = {}
      enriched.forEach(p => {
        if (p.department_id && p.department_name) {
          deptMap[p.department_id] = p.department_name
        }
      })
      setDepartments(Object.entries(deptMap).map(([id, name]) => ({ id, name })))
    } catch (e) {
      setError('Failed to load positions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Compute segment counts
  const segmentCounts = {
    '':       positions.length,
    critical: positions.filter(p => p.priority === 'urgent' && p.status === 'open').length,
    active:   positions.filter(p => p.status === 'open').length,
    stable:   positions.filter(p => p.status === 'open' && !isStalled(p)).length,
    closed:   positions.filter(p => p.status === 'closed' || p.status === 'archived').length,
  }

  // Filter
  const filtered = positions.filter(p => {
    if (search && !p.role_name.toLowerCase().includes(search.toLowerCase())) return false
    if (dept && String(p.department_id) !== String(dept)) return false
    if (segment === 'critical') return p.priority === 'urgent' && p.status === 'open'
    if (segment === 'active')   return p.status === 'open'
    if (segment === 'stable')   return p.status === 'open' && !isStalled(p)
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
            Pipeline Garden{openCount > 0 ? ` · ${openCount} active roles` : ''}
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
        isAdmin={isAdmin}
      />

      {error && (
        <div className="positions-error">
          {error} <button onClick={load}>Retry</button>
        </div>
      )}

      {!loading && sorted.length === 0 && !error && (
        <EmptyPositions segment={segment} onClear={() => setSegment('')} />
      )}

      <PositionGarden
        positions={sorted}
        loading={loading}
        onOpen={id => navigate(`/positions/${id}`)}
      />
    </div>
  )
}

function EmptyPositions({ segment, onClear }) {
  return (
    <div className="positions-empty">
      <h3>{segment ? 'No positions in this filter.' : 'No positions found.'}</h3>
      {segment
        ? <button className="btn-ghost" onClick={onClear}>Clear filters</button>
        : <p className="text-secondary">Positions are created via approved hire requests.</p>
      }
    </div>
  )
}
