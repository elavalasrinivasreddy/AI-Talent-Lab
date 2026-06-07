/**
 * BriefingLane.jsx
 * Generic NOW / NEXT / PULSE lane.
 *
 * Props:
 *   label        — 'NOW' | 'NEXT' | 'PULSE'
 *   tint         — CSS color for the left accent + subtle bg tint
 *   rows         — array of row objects
 *   loading      — boolean (first-load skeleton)
 *   error        — string | null
 *   onRetry      — fn() called when the in-lane retry button is clicked
 *   emptyMessage — string shown when rows is empty
 *   maxRows      — default 8
 */
import BriefingRow from './BriefingRow'

const SKELETON_COUNT = 4

function LaneSkeleton() {
  return (
    <div className="tb-lane-skeleton" aria-hidden="true">
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <div key={i} className="tb-skeleton-row shimmer" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  )
}

export default function BriefingLane({
  label,
  tint,
  rows = [],
  loading = false,
  error = null,
  onRetry,
  emptyMessage,
  maxRows = 8,
}) {
  const visible = rows.slice(0, maxRows)
  const isEmpty = !loading && !error && rows.length === 0
  const effectiveTint = isEmpty ? 'var(--color-success, #10B981)' : tint

  return (
    <div
      className={`tb-lane${isEmpty ? ' tb-lane--empty' : ''}`}
      style={{
        '--lane-tint': effectiveTint,
        borderTop: `3px solid ${effectiveTint}`,
      }}
    >
      {/* Lane header */}
      <div className="tb-lane-header">
        <span className="tb-lane-label" style={{ color: effectiveTint }}>{label}</span>
        {!loading && !error && (
          <span className="tb-lane-count" style={{ background: `${effectiveTint}22`, color: effectiveTint }}>
            {rows.length}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <LaneSkeleton />
      ) : error ? (
        <div className="tb-lane-error">
          <span>Failed to load.</span>
          {onRetry && (
            <button className="tb-retry-btn" onClick={onRetry} type="button">
              Retry
            </button>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className="tb-lane-empty">
          <span className="tb-lane-empty-text">{emptyMessage}</span>
        </div>
      ) : (
        <div className="tb-lane-rows">
          {visible.map(row => (
            <BriefingRow
              key={row.id}
              row={row}
              kind={row.meta?.kind || 'ok'}
            />
          ))}
          {rows.length > maxRows && (
            <div className="tb-lane-overflow">
              +{rows.length - maxRows} more
            </div>
          )}
        </div>
      )}
    </div>
  )
}
