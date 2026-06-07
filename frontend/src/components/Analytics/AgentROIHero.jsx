import './AgentROIHero.css'

export function AgentROIHero({ data, loading }) {
  if (loading) return <div className="roi-hero-skeleton" aria-hidden="true" />
  if (!data) return null

  const share = data.ai_sourcing_share ?? 0
  const delta = data.share_delta ?? null
  const hours = data.hours_saved ?? 0
  const aiCandidates = data.ai_candidates ?? 0
  const totalCandidates = data.total_candidates ?? 0

  const deltaClass =
    delta == null ? 'neutral'
    : delta > 0.5 ? 'positive'
    : delta < -0.5 ? 'negative'
    : 'neutral'

  const deltaLabel =
    delta == null ? null
    : delta > 0
      ? `+${Math.abs(delta).toFixed(1)}pp vs last period`
      : `${delta.toFixed(1)}pp vs last period`

  return (
    <div className="roi-hero" role="region" aria-label={`AI sourcing share: ${share}%`}>
      <div className="roi-hero-body">
        <div className="roi-hero-left">
          <p className="roi-hero-eyebrow">AI Sourcing Impact</p>
          <div className="roi-hero-share-display">
            <span className="roi-hero-share-num">{share}</span>
            <span className="roi-hero-share-unit">%</span>
          </div>
          <p className="roi-hero-share-context">of total pipeline handled by AI this period</p>

          {deltaLabel && (
            <div className={`roi-delta-chip ${deltaClass}`}>
              {deltaLabel}
            </div>
          )}

          {share > 0 && share < 20 && (
            <div className="roi-alert" role="alert">
              AI contribution is low — verify the sourcing agent is enabled in Settings
            </div>
          )}
        </div>

        <div className="roi-hero-right">
          <div className="roi-stat-block">
            <span className="roi-stat-num roi-stat-num-primary">{hours}h</span>
            <span className="roi-stat-label">Recruiter hours saved</span>
          </div>
          <div className="roi-stat-block">
            <span className="roi-stat-num">{aiCandidates}</span>
            <span className="roi-stat-label">AI-sourced candidates</span>
          </div>
          {totalCandidates > 0 && (
            <div className="roi-stat-block">
              <span className="roi-stat-num roi-stat-num-muted">{totalCandidates}</span>
              <span className="roi-stat-label">Total candidates</span>
            </div>
          )}
        </div>
      </div>

      <div className="roi-share-bar-section" aria-hidden="true">
        <div
          className="roi-share-bar"
          role="progressbar"
          aria-valuenow={share}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="roi-share-fill" style={{ width: `${Math.min(share, 100)}%` }} />
        </div>
        <div className="roi-share-bar-labels">
          <span className="roi-bar-label-ai">AI {share}%</span>
          <span className="roi-bar-label-human">Human {Math.max(0, 100 - share)}%</span>
        </div>
      </div>
    </div>
  )
}
