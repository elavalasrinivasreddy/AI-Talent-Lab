/**
 * components/common/ScoreCircle.jsx
 * Arc-style ATS score display per docs/FRONTEND_PLAN.md §11.4
 */
import { getScoreStyle } from '../../utils/constants'

export default function ScoreCircle({ score, size = 80 }) {
  if (score === null || score === undefined) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--color-bg-tertiary)',
        border: '2px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.17, color: 'var(--color-text-muted)',
      }}>
        —
      </div>
    )
  }

  const { color, label } = getScoreStyle(score)
  const radius = (size / 2) - 5
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - score / 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="var(--color-bg-tertiary)"
            strokeWidth={size * 0.1}
          />
          {/* Score arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={color}
            strokeWidth={size * 0.1}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: size * 0.22, fontWeight: 700, color, lineHeight: 1 }}>
            {Math.round(score)}
          </span>
          <span style={{ fontSize: size * 0.13, color: 'var(--color-text-muted)', lineHeight: 1 }}>
            %
          </span>
        </div>
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>
    </div>
  )
}
