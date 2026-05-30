import React, { useMemo } from 'react'

export default function SparklineApplicants({ data = [], width = 300, height = 36 }) {
  const points = useMemo(() => {
    // Fill 30 days
    const end = new Date()
    const filled = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(end)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const found = data.find(r => r.date === key)
      filled.push(found ? found.count : 0)
    }
    return filled
  }, [data])

  const max = Math.max(...points, 1)
  const pad = 4
  const w = width - pad * 2
  const h = height - pad * 2

  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * w
    const y = pad + h - (v / max) * h
    return [x, y]
  })

  const polyline = coords.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `${pad},${pad + h} ` + coords.map(([x, y]) => `${x},${y}`).join(' ') + ` ${pad + w},${pad + h}`

  const last7avg = points.slice(-7).reduce((a, b) => a + b, 0) / 7
  const first7avg = points.slice(0, 7).reduce((a, b) => a + b, 0) / 7
  const trend = last7avg > first7avg * 1.2 ? 'trending up' : last7avg < first7avg * 0.8 ? 'declining' : 'stable'
  const trendLabel = trend === 'trending up' ? '↑ trending' : trend === 'declining' ? '↓ declining' : '→ stable'

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Daily applicants trend"
        style={{ display: 'block', width: '100%', height: height }}
      >
        <polygon points={area} fill="rgba(13,148,136,0.15)" />
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--color-primary, #0D9488)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <span style={{
        position: 'absolute', bottom: 2, right: 4,
        fontSize: 10, color: 'var(--color-primary, #0D9488)', fontWeight: 600,
      }}>{trendLabel}</span>
    </div>
  )
}
