import React from 'react'
import Icon from '../common/Icon'

const SEGMENTS = [
  { key: '',         label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'active',   label: 'Active' },
  { key: 'stable',   label: 'Stable' },
  { key: 'draft',    label: 'Drafts' },
  { key: 'closed',   label: 'Closed' },
]

export default function PositionsToolbar({
  search, onSearch,
  segment, onSegment,
  dept, onDept,
  sort, onSort,
  segmentCounts = {},
  departments = [],
  isAdmin,
}) {
  return (
    <div className="positions-toolbar">
      {/* Search */}
      <div className="positions-search-wrap">
        <span className="positions-search-icon"><Icon name="search" size={16} /></span>
        <input
          className="positions-search-input"
          type="text"
          placeholder="Search positions, roles, skills..."
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      {/* Segment */}
      <div className="positions-segment-bar">
        {SEGMENTS.map(s => (
          <button
            key={s.key}
            className={`positions-seg-btn ${segment === s.key ? 'active' : ''}`}
            onClick={() => onSegment(s.key)}
          >
            {s.label}
            {segmentCounts[s.key] != null && (
              <span className="positions-seg-count">{segmentCounts[s.key]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="positions-toolbar-right">
        {/* Dept filter — admin only */}
        {isAdmin && departments.length > 0 && (
          <select
            className="positions-select"
            value={dept}
            onChange={e => onDept(e.target.value)}
          >
            <option value="">All depts</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        {/* Sort */}
        <div className="positions-sort-wrap">
          <span className="positions-sort-label">Sort:</span>
          <select
            className="positions-select"
            value={sort}
            onChange={e => onSort(e.target.value)}
          >
            <option value="urgency">Urgency</option>
            <option value="newest">Newest</option>
            <option value="activity">Activity</option>
          </select>
        </div>
      </div>
    </div>
  )
}
