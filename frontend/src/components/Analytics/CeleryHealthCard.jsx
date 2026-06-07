const TASK_LABELS = {
  candidate_search: 'Candidate Search',
  ats_scoring:      'ATS Scoring',
  outreach_send:    'Outreach',
}

function RateBar({ rate }) {
  const color = rate >= 90
    ? 'var(--color-success, #10B981)'
    : rate >= 70
    ? 'var(--color-warning, #D97706)'
    : 'var(--color-danger, #EF4444)'
  return (
    <div className="ops-rate-bar-wrap">
      <div className="ops-rate-bar">
        <div className="ops-rate-fill" style={{ width: `${rate}%`, background: color }} />
      </div>
      <span className="ops-rate-label" style={{ color }}>{rate}%</span>
    </div>
  )
}

export default function CeleryHealthCard({ data, loading }) {
  if (loading) {
    return (
      <div className="analytics-card ops-card">
        <h3 className="analytics-card-title">Background Tasks</h3>
        <div className="skeleton-block" style={{ height: 160, marginTop: 12, borderRadius: 8 }} />
      </div>
    )
  }

  const tasks = data?.tasks || []

  return (
    <div className="analytics-card ops-card">
      <h3 className="analytics-card-title">Background Tasks</h3>
      {tasks.length === 0 ? (
        <p className="analytics-empty">No task runs recorded yet. Tasks log after the first pipeline run.</p>
      ) : (
        <div className="ops-task-list">
          {tasks.map(t => (
            <div key={t.task_type} className="ops-task-row">
              <div className="ops-task-meta">
                <span className="ops-task-name">
                  {TASK_LABELS[t.task_type] || t.task_type}
                </span>
                <span className="ops-task-count">{t.total} runs</span>
              </div>
              <RateBar rate={t.success_rate} />
              <div className="ops-task-detail">
                {t.avg_candidates > 0 && (
                  <span>~{t.avg_candidates} candidates/run</span>
                )}
                {t.avg_duration_ms > 0 && (
                  <span>{(t.avg_duration_ms / 1000).toFixed(1)}s avg</span>
                )}
                <span className="ops-task-fail">
                  {t.failures} failed
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
