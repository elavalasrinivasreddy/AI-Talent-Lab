const STATUS_LABEL = {
  open:      'Open',
  closed:    'Closed',
  on_hold:   'On Hold',
  cancelled: 'Cancelled',
  draft:     'Draft',
  archived:  'Archived',
}

const JD_STATUS_LABEL = {
  approved:       'Approved',
  pending_review: 'Pending Review',
  rejected:       'Rejected',
  draft:          'Draft',
  na:             'N/A',
}

const JD_STATUS_COLOR = {
  approved:       'var(--color-success, #10B981)',
  pending_review: 'var(--color-warning, #D97706)',
  rejected:       'var(--color-danger, #EF4444)',
  draft:          'var(--color-text-secondary, #94A3B8)',
  na:             'var(--color-text-secondary, #94A3B8)',
}

export default function JDMetricsCard({ data, loading }) {
  if (loading) {
    return (
      <div className="analytics-card ops-card ops-jd-card">
        <h3 className="analytics-card-title">JD &amp; Position Metrics</h3>
        <div className="skeleton-block" style={{ height: 260, marginTop: 12, borderRadius: 8 }} />
      </div>
    )
  }
  if (!data) return null

  const jd = data.jd_generation || {}
  const statusDist = data.status_distribution || {}
  const jdDist = data.jd_status_distribution || {}
  const monthly = data.monthly_trend || []
  const avgSec = jd.avg_duration_ms ? (jd.avg_duration_ms / 1000).toFixed(1) : '—'

  return (
    <div className="analytics-card ops-card ops-jd-card">
      <h3 className="analytics-card-title">JD &amp; Position Metrics</h3>

      <div className="ops-jd-gen-row">
        <div className="ops-jd-stat">
          <span className="ops-jd-val">{jd.success_rate ?? '—'}%</span>
          <span className="ops-jd-lbl">JD success rate</span>
        </div>
        <div className="ops-jd-stat">
          <span className="ops-jd-val">{avgSec}s</span>
          <span className="ops-jd-lbl">Avg gen time</span>
        </div>
        <div className="ops-jd-stat">
          <span className="ops-jd-val">
            ${(jd.avg_cost_usd || 0) < 0.001
              ? (jd.avg_cost_usd || 0).toFixed(5)
              : (jd.avg_cost_usd || 0).toFixed(3)}
          </span>
          <span className="ops-jd-lbl">Cost / JD</span>
        </div>
        <div className="ops-jd-stat">
          <span className="ops-jd-val">{jd.total ?? 0}</span>
          <span className="ops-jd-lbl">JDs generated</span>
        </div>
      </div>

      {Object.keys(jdDist).length > 0 && (
        <div className="ops-jd-status-row">
          {Object.entries(jdDist).map(([status, count]) => (
            <div key={status} className="ops-jd-chip" style={{ borderColor: JD_STATUS_COLOR[status] }}>
              <span style={{ color: JD_STATUS_COLOR[status] }}>{JD_STATUS_LABEL[status] || status}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="ops-pos-section">
        <div className="ops-section-label">Position Status This Period</div>
        <div className="ops-pos-chips">
          {Object.entries(statusDist).map(([status, count]) => (
            <div key={status} className="ops-pos-chip">
              <span className="ops-pos-chip-label">{STATUS_LABEL[status] || status}</span>
              <span className="ops-pos-chip-count">{count}</span>
            </div>
          ))}
          {Object.keys(statusDist).length === 0 && (
            <p className="analytics-empty" style={{ margin: 0 }}>No positions in this period.</p>
          )}
        </div>
      </div>

      {monthly.length > 0 && (
        <div className="ops-monthly-table">
          <div className="ops-section-label" style={{ marginBottom: 8 }}>Monthly Trend</div>
          <table className="ops-table">
            <thead>
              <tr>
                <th>Month</th><th>Opened</th><th>Closed</th><th>On Hold</th><th>Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map(m => (
                <tr key={m.month}>
                  <td>{m.month ? new Date(m.month).toLocaleDateString('en', { month: 'short', year: '2-digit' }) : '—'}</td>
                  <td>{m.opened}</td><td>{m.closed}</td><td>{m.on_hold}</td><td>{m.cancelled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
