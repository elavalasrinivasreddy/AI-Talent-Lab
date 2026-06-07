import './AnalyticsPage.css'

export function DualFunnel({ aiFunnel, humanFunnel }) {
  if (!aiFunnel || !humanFunnel) return null

  const stages = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected']

  const max = stages.reduce((m, s) => Math.max(m, aiFunnel[s] || 0, humanFunnel[s] || 0), 1)

  const convRate = (funnel) => {
    const sourced = funnel.sourced || 0
    const selected = funnel.selected || 0
    if (sourced === 0) return 0
    return Math.round((selected / sourced) * 100)
  }

  const aiConv = convRate(aiFunnel)
  const humanConv = convRate(humanFunnel)

  return (
    <div className="analytics-card analytics-grid-full">
      <h3 className="analytics-card-title">Pipeline Efficiency: AI vs Human</h3>

      <div className="dual-funnel-header-row">
        <div className="dual-funnel-header-human">Human Sourced</div>
        <div />
        <div className="dual-funnel-header-ai">AI Sourced</div>
      </div>

      <div className="dual-funnel-container">
        {stages.map((stage) => {
          const aiVal = aiFunnel[stage] || 0
          const humanVal = humanFunnel[stage] || 0

          return (
            <div key={stage} className="dual-funnel-row">
              <div className="dual-funnel-human">
                <span className="dual-funnel-val">{humanVal}</span>
                <div className="dual-funnel-bar-wrapper right">
                  <div
                    className="dual-funnel-bar dual-funnel-bar-human"
                    style={{ width: `${Math.max((humanVal / max) * 100, humanVal > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
              <div className="dual-funnel-label">
                {stage.charAt(0).toUpperCase() + stage.slice(1)}
              </div>
              <div className="dual-funnel-ai">
                <div className="dual-funnel-bar-wrapper">
                  <div
                    className="dual-funnel-bar dual-funnel-bar-ai"
                    style={{ width: `${Math.max((aiVal / max) * 100, aiVal > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span className="dual-funnel-val">{aiVal}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="dual-funnel-conversion-row">
        <div className="dual-funnel-conversion-stat right">
          <span className="dual-funnel-conv-value human">{humanConv}%</span>
          <span className="dual-funnel-conv-label">sourced-to-hire</span>
        </div>
        <div />
        <div className="dual-funnel-conversion-stat">
          <span className="dual-funnel-conv-value ai">{aiConv}%</span>
          <span className="dual-funnel-conv-label">sourced-to-hire</span>
        </div>
      </div>
    </div>
  )
}
