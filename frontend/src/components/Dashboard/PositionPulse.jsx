/**
 * PositionPulse.jsx — Position mini-card list (right column, bottom).
 *
 * Props:
 *   positions — from dashboardApi.getPositions
 *   loading   — boolean
 *   error     — string | null
 */
import { Link } from 'react-router-dom'
import Icon from '../common/Icon'

// Stage color map (reuses globals.css --color-stage-* tokens)
const STATUS_COLORS = {
  open:     'var(--color-success, #10B981)',
  active:   'var(--color-success, #10B981)',
  draft:    'var(--color-text-secondary, #94A3B8)',
  on_hold:  'var(--color-warning, #D97706)',
  closed:   'var(--color-text-muted, #475569)',
  archived: 'var(--color-text-muted, #475569)',
}

function PulseSkeleton() {
  return (
    <div className="position-pulse-skeleton" aria-hidden="true">
      {[1, 2, 3].map(i => (
        <div key={i} className="shimmer" style={{ height: 58, borderRadius: 'var(--radius-md, 10px)' }} />
      ))}
    </div>
  )
}

export default function PositionPulse({ positions = [], loading, error }) {
  const open = positions.filter(p => p.status === 'open' || p.status === 'active')
  const show = open.length > 0 ? open : positions
  const visible = show.slice(0, 6)

  return (
    <div className="position-pulse">
      <div className="position-pulse-header">
        <span className="position-pulse-title">Open Positions</span>
        <Link to="/positions" className="position-pulse-viewall">
          View all <Icon name="chevron-right" size={12} />
        </Link>
      </div>

      {loading ? (
        <PulseSkeleton />
      ) : error ? (
        <div className="position-pulse-error">
          <Icon name="alert-triangle" size={13} />
          <span>Failed to load positions.</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="position-pulse-empty">
          <p>No positions yet.</p>
          <Link to="/chat" className="position-pulse-cta">
            <Icon name="plus" size={13} />
            Create a position
          </Link>
        </div>
      ) : (
        <div className="position-pulse-list">
          {visible.map(p => {
            const dotColor = STATUS_COLORS[p.status] || STATUS_COLORS.draft
            const candidates = p.total_candidates || p.candidate_count || 0
            return (
              <Link key={p.id} to={`/positions/${p.id}`} className="position-pulse-card">
                <span
                  className="position-pulse-dot"
                  style={{ background: dotColor }}
                  aria-hidden="true"
                />
                <div className="position-pulse-info">
                  <span className="position-pulse-name">{p.role_name}</span>
                  <span className="position-pulse-meta">
                    {p.department_name || '—'} · {candidates} candidate{candidates !== 1 ? 's' : ''}
                  </span>
                </div>
                <Icon name="chevron-right" size={13} style={{ color: 'var(--color-text-muted, #475569)', flexShrink: 0 }} />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
