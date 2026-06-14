import './AnalyticsPage.css'

export function BottleneckRadar({ current, previous }) {
  if (!current) return null

  const axes = [
    { key: 'sourcing',   label: 'Sourcing' },
    { key: 'screening',  label: 'Screening' },
    { key: 'interview',  label: 'Interview Speed' },
    { key: 'offer',      label: 'Offer Accept' },
    { key: 'ai_accept',  label: 'AI Accept' },
    { key: 'quality',    label: 'Match Quality' },
  ]

  const size = 300
  const center = size / 2
  const radius = center - 40

  const getPoint = (value, index) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2
    const r = value * radius
    return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`
  }

  const isRegressed = (key) => {
    if (!previous) return false
    const curr = current[key] || 0
    const prev = previous[key] || 0
    return prev > 0 && curr < prev - 0.1
  }

  const currentPoints = axes.map((a, i) => getPoint(current[a.key] || 0, i)).join(' ')
  const previousPoints = previous
    ? axes.map((a, i) => getPoint(previous[a.key] || 0, i)).join(' ')
    : ''

  return (
    <div className="analytics-card bottleneck-radar-card">
      <h3 className="analytics-card-title">Bottleneck Radar</h3>

      <div className="radar-info-wrapper">
        <span className="radar-info-icon">i</span>
        <div className="radar-tooltip">
          <strong>Sourcing:</strong> Volume of new candidates<br />
          <strong>Screening:</strong> % of applicants passing screening<br />
          <strong>Interview Speed:</strong> Speed of interview phase (faster = better)<br />
          <strong>Offer Accept:</strong> Interview-to-hire conversion rate<br />
          <strong>AI Accept:</strong> AI Copilot suggestions acted on (not dismissed)<br />
          <strong>Match Quality:</strong> Avg ATS/skill-match score of sourced candidates
        </div>
      </div>

      <div className="radar-container">
        <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((r, i) => (
            <circle key={i} cx={center} cy={center} r={r * radius} className="radar-grid" />
          ))}
          {axes.map((_, i) => {
            const end = getPoint(1, i)
            const [ex, ey] = end.split(',')
            return (
              <line key={i} x1={center} y1={center} x2={ex} y2={ey} className="radar-grid" />
            )
          })}

          {previous && <polygon points={previousPoints} className="radar-poly-prev" />}
          <polygon points={currentPoints} className="radar-poly-current" />

          {axes.map((a, i) => {
            const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2
            const r = radius + 25
            const x = center + r * Math.cos(angle)
            const y = center + r * Math.sin(angle)
            const regressed = isRegressed(a.key)
            return (
              <text
                key={a.key}
                x={x}
                y={y}
                className={regressed ? 'radar-label radar-label-regressed' : 'radar-label'}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {a.label}{regressed ? ' ↓' : ''}
              </text>
            )
          })}
        </svg>
      </div>

      <div className="radar-legend">
        <span>
          <span className="radar-legend-dot-current" />
          Current period
        </span>
        {previous && (
          <span>
            <span className="radar-legend-dot-prev" />
            Previous period
          </span>
        )}
      </div>
    </div>
  )
}
