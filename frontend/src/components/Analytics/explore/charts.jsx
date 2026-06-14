/**
 * charts.jsx — dependency-free inline-SVG chart renderer for the Explore tab.
 *
 * One <Chart result={...} /> dispatcher renders the data shapes returned by
 * POST /api/v1/analytics/query:
 *   number     → big stat
 *   bar        → vertical bars
 *   line/area  → polyline (+ optional fill)
 *   time_series→ line over time buckets
 *   pie        → donut + legend
 *   scatter    → points scaled to x/y ranges (optional colour series)
 *   histogram  → client-side binning of raw values
 *   table      → HTML table (dimension + measures)
 *
 * Theming uses the app's design tokens; the series palette leads with the brand teal.
 */
import { useState } from 'react'

export const PALETTE = [
  '#0D9488', '#6366F1', '#F59E0B', '#EF4444', '#10B981',
  '#3B82F6', '#EC4899', '#8B5CF6', '#F97316', '#0EA5E9',
]

const AXIS = 'var(--color-text-secondary, #94A3B8)'
const GRID = 'var(--color-border, #1E3047)'
const TEXT = 'var(--color-text-primary, #F1F5F9)'

// ── value formatting ─────────────────────────────────────────────────────────
export function fmt(value, unit = '') {
  if (value == null || value === '') return '—'
  let n = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(n)) return String(value)
  const round = (x) => (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10)
  if (unit === '$') return '$' + round(n).toLocaleString()
  if (unit === '%') return round(n) + '%'
  if (unit === 'days') return round(n) + 'd'
  if (unit === 'tokens' || unit === 'ms') {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'k'
    return round(n).toLocaleString()
  }
  return round(n).toLocaleString()
}

// Sensible default footprint per chart type — widgets adapt to their data shape.
export function autoSize(viz) {
  if (viz === 'number') return { w: 1, h: 'sm' }
  if (viz === 'table') return { w: 2, h: 'lg' }
  return { w: 2, h: 'md' }
}

function labelText(v) {
  if (v == null) return '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return String(v)
}

function niceMax(v) {
  if (v <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const r = v / pow
  const step = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10
  return step * pow
}

// ── empty state ──────────────────────────────────────────────────────────────
function Empty({ msg = 'No data for these settings' }) {
  return <div className="exp-chart-empty">{msg}</div>
}

// ── number ───────────────────────────────────────────────────────────────────
function NumberStat({ result }) {
  const m = result.meta?.measures?.[0] || {}
  return (
    <div className="exp-number">
      <span className="exp-number-value">{fmt(result.value, m.unit)}</span>
      <span className="exp-number-label">{m.label}</span>
    </div>
  )
}

// ── bar ──────────────────────────────────────────────────────────────────────
function BarChart({ result }) {
  const data = result.data || []
  const mkey = result.meta?.measures?.[0]?.key
  const unit = result.meta?.measures?.[0]?.unit
  if (!data.length) return <Empty />
  const W = 520, H = 240, pad = { l: 44, r: 12, t: 12, b: 54 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const max = niceMax(Math.max(...data.map((d) => Number(d[mkey]) || 0), 0))
  const bw = iw / data.length
  const [hover, setHover] = useState(null)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="exp-svg" preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = pad.t + ih * (1 - t)
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke={GRID} strokeWidth="1" />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill={AXIS}>{fmt(max * t, unit)}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const v = Number(d[mkey]) || 0
        const h = max ? (v / max) * ih : 0
        const x = pad.l + i * bw + bw * 0.16
        const w = bw * 0.68
        const y = pad.t + ih - h
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={x} y={y} width={w} height={Math.max(h, 0)} rx="3"
              fill={PALETTE[0]} opacity={hover === null || hover === i ? 1 : 0.5} />
            {hover === i && (
              <text x={x + w / 2} y={y - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill={TEXT}>{fmt(v, unit)}</text>
            )}
            <text x={x + w / 2} y={H - pad.b + 14} textAnchor="end" fontSize="9" fill={AXIS}
              transform={`rotate(-35 ${x + w / 2} ${H - pad.b + 14})`}>
              {labelText(d.label).slice(0, 14)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── line / area / time_series ────────────────────────────────────────────────
function LineChart({ result, area }) {
  const data = result.data || []
  const mkey = result.meta?.measures?.[0]?.key
  const unit = result.meta?.measures?.[0]?.unit
  if (data.length < 2) return data.length === 1 ? <BarChart result={result} /> : <Empty />
  const W = 520, H = 240, pad = { l: 44, r: 14, t: 12, b: 48 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const max = niceMax(Math.max(...data.map((d) => Number(d[mkey]) || 0), 0))
  const x = (i) => pad.l + (iw * i) / (data.length - 1)
  const y = (v) => pad.t + ih - (max ? (Number(v) || 0) / max : 0) * ih
  const pts = data.map((d, i) => `${x(i)},${y(d[mkey])}`).join(' ')
  const areaPts = `${pad.l},${pad.t + ih} ${pts} ${x(data.length - 1)},${pad.t + ih}`
  const step = Math.ceil(data.length / 8)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="exp-svg" preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const yy = pad.t + ih * (1 - t)
        return (
          <g key={i}>
            <line x1={pad.l} y1={yy} x2={W - pad.r} y2={yy} stroke={GRID} strokeWidth="1" />
            <text x={pad.l - 6} y={yy + 3} textAnchor="end" fontSize="9" fill={AXIS}>{fmt(max * t, unit)}</text>
          </g>
        )
      })}
      {area && <polygon points={areaPts} fill={PALETTE[0]} opacity="0.13" />}
      <polyline points={pts} fill="none" stroke={PALETTE[0]} strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d[mkey])} r="2.6" fill={PALETTE[0]} />
      ))}
      {data.map((d, i) => i % step === 0 && (
        <text key={i} x={x(i)} y={H - pad.b + 16} textAnchor="middle" fontSize="9" fill={AXIS}>{labelText(d.label)}</text>
      ))}
    </svg>
  )
}

// ── pie / donut ──────────────────────────────────────────────────────────────
function PieChart({ result }) {
  const data = result.data || []
  const mkey = result.meta?.measures?.[0]?.key
  const unit = result.meta?.measures?.[0]?.unit
  const total = data.reduce((s, d) => s + (Number(d[mkey]) || 0), 0)
  if (!total) return <Empty />
  const cx = 110, cy = 120, r = 92, ri = 52
  let acc = -Math.PI / 2
  const arcs = data.slice(0, 10).map((d, i) => {
    const frac = (Number(d[mkey]) || 0) / total
    const a0 = acc, a1 = acc + frac * Math.PI * 2
    acc = a1
    const large = a1 - a0 > Math.PI ? 1 : 0
    const p = (ang, rad) => `${cx + rad * Math.cos(ang)},${cy + rad * Math.sin(ang)}`
    const path = `M ${p(a0, r)} A ${r} ${r} 0 ${large} 1 ${p(a1, r)} L ${p(a1, ri)} A ${ri} ${ri} 0 ${large} 0 ${p(a0, ri)} Z`
    return { path, color: PALETTE[i % PALETTE.length], label: labelText(d.label), val: Number(d[mkey]) || 0, frac }
  })
  return (
    <div className="exp-pie-wrap">
      <svg viewBox="0 0 220 240" className="exp-svg-pie">
        {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} stroke="var(--color-bg-elevated,#1A2236)" strokeWidth="1.5" />)}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="700" fill={TEXT}>{fmt(total, unit)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill={AXIS}>Total</text>
      </svg>
      <div className="exp-legend">
        {arcs.map((a, i) => (
          <div key={i} className="exp-legend-row">
            <span className="exp-legend-dot" style={{ background: a.color }} />
            <span className="exp-legend-label">{a.label}</span>
            <span className="exp-legend-val">{Math.round(a.frac * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── scatter ──────────────────────────────────────────────────────────────────
function ScatterChart({ result }) {
  const pts = result.points || []
  if (!pts.length) return <Empty />
  const W = 520, H = 250, pad = { l: 46, r: 14, t: 14, b: 40 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const xs = pts.map((p) => Number(p.x)), ys = pts.map((p) => Number(p.y))
  const xmin = Math.min(...xs), xmax = niceMax(Math.max(...xs))
  const ymax = niceMax(Math.max(...ys))
  const sx = (v) => pad.l + (iw * (v - xmin)) / ((xmax - xmin) || 1)
  const sy = (v) => pad.t + ih - (ih * v) / (ymax || 1)
  const seriesKeys = [...new Set(pts.map((p) => p.series).filter((s) => s != null))]
  const color = (p) => seriesKeys.length ? PALETTE[seriesKeys.indexOf(p.series) % PALETTE.length] : PALETTE[0]
  const xl = result.meta?.x || {}, yl = result.meta?.y || {}
  return (
    <div className="exp-pie-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="exp-svg" preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const yy = pad.t + ih * (1 - t)
          return (
            <g key={i}>
              <line x1={pad.l} y1={yy} x2={W - pad.r} y2={yy} stroke={GRID} strokeWidth="1" />
              <text x={pad.l - 6} y={yy + 3} textAnchor="end" fontSize="9" fill={AXIS}>{fmt(ymax * t, yl.unit)}</text>
            </g>
          )
        })}
        {pts.map((p, i) => (
          <circle key={i} cx={sx(Number(p.x))} cy={sy(Number(p.y))} r="3.2" fill={color(p)} opacity="0.72" />
        ))}
        <text x={pad.l + iw / 2} y={H - 6} textAnchor="middle" fontSize="9" fill={AXIS}>{xl.label}</text>
      </svg>
      {seriesKeys.length > 0 && (
        <div className="exp-legend">
          {seriesKeys.slice(0, 10).map((s, i) => (
            <div key={i} className="exp-legend-row">
              <span className="exp-legend-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="exp-legend-label">{labelText(s)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── histogram (client-side binning) ──────────────────────────────────────────
function Histogram({ result }) {
  const values = (result.values || []).map(Number).filter((v) => !Number.isNaN(v))
  if (!values.length) return <Empty />
  const bins = Math.max(2, Math.min(50, result.meta?.bins || 12))
  const min = Math.min(...values), max = Math.max(...values)
  const width = (max - min) / bins || 1
  const counts = new Array(bins).fill(0)
  values.forEach((v) => {
    let idx = Math.floor((v - min) / width)
    if (idx >= bins) idx = bins - 1
    if (idx < 0) idx = 0
    counts[idx] += 1
  })
  const data = counts.map((c, i) => ({ label: Math.round((min + i * width) * 10) / 10, count: c }))
  const W = 520, H = 240, pad = { l: 40, r: 12, t: 12, b: 40 }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b
  const cmax = niceMax(Math.max(...counts))
  const bw = iw / bins
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="exp-svg" preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = pad.t + ih * (1 - t)
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke={GRID} strokeWidth="1" />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill={AXIS}>{Math.round(cmax * t)}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const h = cmax ? (d.count / cmax) * ih : 0
        return (
          <g key={i}>
            <rect x={pad.l + i * bw + 1} y={pad.t + ih - h} width={bw - 2} height={Math.max(h, 0)} fill={PALETTE[0]} opacity="0.85" />
            {i % Math.ceil(bins / 8) === 0 && (
              <text x={pad.l + i * bw} y={H - pad.b + 15} fontSize="8" fill={AXIS}>{d.label}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── table ────────────────────────────────────────────────────────────────────
function DataTable({ result }) {
  const data = result.data || []
  const dim = result.meta?.dimension || { label: 'Group' }
  const measures = result.meta?.measures || []
  if (!data.length) return <Empty />
  return (
    <div className="exp-table-wrap">
      <table className="exp-table">
        <thead>
          <tr>
            <th>{dim.label}</th>
            {measures.map((m) => <th key={m.key} className="exp-num">{m.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{labelText(d.label)}</td>
              {measures.map((m) => <td key={m.key} className="exp-num">{fmt(d[m.key], m.unit)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── dispatcher ───────────────────────────────────────────────────────────────
export function Chart({ result }) {
  if (!result) return <Empty msg="No result" />
  switch (result.viz) {
    case 'number': return <NumberStat result={result} />
    case 'bar': return <BarChart result={result} />
    case 'line': return <LineChart result={result} />
    case 'area': return <LineChart result={result} area />
    case 'time_series': return <LineChart result={result} area />
    case 'pie': return <PieChart result={result} />
    case 'scatter': return <ScatterChart result={result} />
    case 'histogram': return <Histogram result={result} />
    case 'table': return <DataTable result={result} />
    default: return <Empty msg={`Unsupported chart: ${result.viz}`} />
  }
}
