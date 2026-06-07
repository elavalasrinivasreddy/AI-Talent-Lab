/**
 * VelocitySparkline.jsx
 * Inline SVG polyline sparkline from activity/stats data.
 * Hand-rolled — no new chart dependency.
 *
 * Props:
 *   activity — array of activity events (from useDashboardData)
 *   health   — stats object (may be null for non-admin)
 *   width    — default 280
 *   height   — default 52
 */

const DAYS = 7

function buildDailyBuckets(activity) {
  // Group activity events by day-of-week (last 7 days), oldest first
  const now = Date.now()
  const buckets = Array.from({ length: DAYS }, (_, i) => {
    const dayStart = now - (DAYS - 1 - i) * 86_400_000
    const dayEnd   = dayStart + 86_400_000
    return {
      count: activity.filter(e => {
        if (!e.created_at) return false
        const t = new Date(e.created_at).getTime()
        return t >= dayStart && t < dayEnd
      }).length,
    }
  })
  return buckets.map(b => b.count)
}

function buildPolylinePoints(values, svgWidth, svgHeight) {
  const max = Math.max(...values, 1)
  const padX = 6
  const padY = 6
  const w = svgWidth  - padX * 2
  const h = svgHeight - padY * 2
  const n = values.length - 1

  return values.map((v, i) => {
    const x = padX + (n === 0 ? w / 2 : (i / n) * w)
    const y = padY + h - (v / max) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

export default function VelocitySparkline({
  activity = [],
  health   = null,
  width    = 280,
  height   = 52,
}) {
  const values = buildDailyBuckets(activity)
  const allZero = values.every(v => v === 0)
  const points  = buildPolylinePoints(values, width, height)

  // Day labels (Mon, Tue, …)
  const now = new Date()
  const dayLabels = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(now.getTime() - (DAYS - 1 - i) * 86_400_000)
    return d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 3)
  })

  // Summary stat
  const total  = values.reduce((a, b) => a + b, 0)
  const n = health?.active_positions
  const metric = n != null ? `${n} open req${n !== 1 ? 's' : ''}` : `${total} events`

  return (
    <div className="velocity-sparkline">
      <div className="velocity-spark-header">
        <span className="velocity-spark-label">Pipeline Velocity</span>
        <span className="velocity-spark-metric">{metric}</span>
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        className="velocity-spark-svg"
      >
        {/* Subtle fill area */}
        {!allZero && (
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--color-primary, #0D9488)" stopOpacity="0.20" />
              <stop offset="100%" stopColor="var(--color-primary, #0D9488)" stopOpacity="0.00" />
            </linearGradient>
          </defs>
        )}
        {!allZero && (() => {
          // Build filled polygon path: line + drop to baseline
          const pts = points.split(' ')
          const first = pts[0]
          const last  = pts[pts.length - 1]
          const [lx] = last.split(',')
          const [fx] = first.split(',')
          const baseline = height - 2
          const fillPath = `M ${fx},${baseline} L ${points.replace(/,/g, ' ')} L ${lx},${baseline} Z`
          return <path d={fillPath} fill="url(#spark-fill)" />
        })()}

        {allZero ? (
          <text
            x={width / 2}
            y={height / 2 + 4}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-text-muted, #475569)"
          >
            No activity yet
          </text>
        ) : (
          <polyline
            points={points}
            fill="none"
            stroke="var(--color-primary, #0D9488)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {/* Day labels */}
      <div className="velocity-spark-labels" style={{ width }}>
        {dayLabels.map((d, i) => (
          <span key={i} className="velocity-spark-day">{d}</span>
        ))}
      </div>
    </div>
  )
}
