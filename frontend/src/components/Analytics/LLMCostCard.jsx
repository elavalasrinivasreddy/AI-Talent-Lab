const OP_LABELS = {
  jd_generation:        'JD Generation',
  ats_scoring:          'ATS Scoring',
  outreach_draft:       'Outreach Draft',
  candidate_evaluation: 'Candidate Eval',
  interview_debrief:    'Interview Debrief',
  interview_kit:        'Interview Kit',
  rejection_draft:      'Rejection Draft',
  interview_summary:    'Interview Summary',
  benchmarking:         'Benchmarking',
  market_intelligence:  'Market Intel',
  internal_analysis:    'Internal Analysis',
  interview_conduct:    'Interview Conduct',
  unknown:              'Other',
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function LLMCostCard({ data, loading }) {
  if (loading) {
    return (
      <div className="analytics-card ops-card">
        <h3 className="analytics-card-title">LLM Usage &amp; Cost</h3>
        <div className="skeleton-block" style={{ height: 200, marginTop: 12, borderRadius: 8 }} />
      </div>
    )
  }
  if (!data) return null

  const totalCost = data.total_cost_usd ?? 0
  const ops = data.by_operation || []
  const maxCost = Math.max(...ops.map(o => o.cost_usd), 0.0001)
  const trend = data.monthly_cost_trend || []

  return (
    <div className="analytics-card ops-card">
      <h3 className="analytics-card-title">LLM Usage &amp; Cost</h3>

      <div className="ops-llm-summary">
        <div className="ops-llm-stat">
          <span className="ops-llm-val">${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(2)}</span>
          <span className="ops-llm-lbl">Total cost</span>
        </div>
        <div className="ops-llm-stat">
          <span className="ops-llm-val">{fmt(data.total_input_tokens + data.total_output_tokens)}</span>
          <span className="ops-llm-lbl">Total tokens</span>
        </div>
        <div className="ops-llm-stat">
          <span className="ops-llm-val">{data.total_calls}</span>
          <span className="ops-llm-lbl">Calls</span>
        </div>
      </div>

      <div className="ops-token-row">
        <span className="ops-token-in">&#8595; {fmt(data.total_input_tokens)} in</span>
        <span className="ops-token-out">&#8593; {fmt(data.total_output_tokens)} out</span>
      </div>

      {ops.length > 0 && (
        <div className="ops-op-list">
          {ops.map(op => (
            <div key={op.operation} className="ops-op-row">
              <span className="ops-op-name">
                {OP_LABELS[op.operation] || op.operation}
              </span>
              <div className="ops-op-bar-wrap">
                <div className="ops-op-bar">
                  <div
                    className="ops-op-fill"
                    style={{ width: `${(op.cost_usd / maxCost) * 100}%` }}
                  />
                </div>
              </div>
              <span className="ops-op-cost">
                ${op.cost_usd < 0.01 ? op.cost_usd.toFixed(4) : op.cost_usd.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}

      {trend.length > 0 && (
        <div className="ops-monthly-table" style={{ marginTop: 16 }}>
          <div className="ops-section-label">Monthly Cost Trend</div>
          <table className="ops-table">
            <thead>
              <tr><th>Month</th><th>Cost</th><th>Tokens</th><th>Calls</th></tr>
            </thead>
            <tbody>
              {trend.map(m => (
                <tr key={m.month}>
                  <td>{m.month ? new Date(m.month).toLocaleDateString('en', { month: 'short', year: '2-digit' }) : '—'}</td>
                  <td>${m.cost_usd < 0.01 ? m.cost_usd.toFixed(4) : m.cost_usd.toFixed(2)}</td>
                  <td>{fmt(m.total_tokens)}</td>
                  <td>{m.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ops.length === 0 && (
        <p className="analytics-empty">No LLM calls logged yet. Calls are recorded automatically once the LLM callback is active.</p>
      )}
    </div>
  )
}
