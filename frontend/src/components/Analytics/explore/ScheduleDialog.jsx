/**
 * ScheduleDialog — set up emailed reports for the current dashboard.
 * Form → confirmation step → create. Also lists existing schedules with send-now / delete.
 */
import { useEffect, useState } from 'react'
import { analyticsApi } from '../../../utils/api'

const CADENCES = [
  { key: 'daily', label: 'Every day' },
  { key: 'every_12h', label: 'Every 12 hours' },
  { key: 'weekly', label: 'Every week' },
  { key: 'monthly', label: 'Every month' },
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WINDOWS = [
  { key: 'last_7_days', label: 'Last 7 days' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'last_90_days', label: 'Last 90 days' },
  { key: 'this_month', label: 'This month' },
]

export default function ScheduleDialog({ dashboardId, dashboardName, onClose }) {
  const [schedules, setSchedules] = useState([])
  const [name, setName] = useState(`${dashboardName || 'Dashboard'} report`)
  const [cadence, setCadence] = useState('weekly')
  const [hour, setHour] = useState(8)
  const [weekday, setWeekday] = useState(0)
  const [recipients, setRecipients] = useState('')
  const [dateWindow, setDateWindow] = useState('last_30_days')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = () =>
    analyticsApi.listSchedules(dashboardId).then((r) => setSchedules(r.schedules || [])).catch(() => {})
  useEffect(() => { if (dashboardId) load() }, [dashboardId]) // eslint-disable-line

  const emails = recipients.split(',').map((s) => s.trim()).filter(Boolean)
  const cadenceLabel = CADENCES.find((c) => c.key === cadence)?.label || cadence

  const summary = () => {
    let when = cadenceLabel.toLowerCase()
    if (cadence === 'weekly') when += ` on ${WEEKDAYS[weekday]}`
    if (cadence !== 'every_12h') when += ` at ${String(hour).padStart(2, '0')}:00`
    return `Email "${name}" ${when} to ${emails.length} recipient${emails.length !== 1 ? 's' : ''}.`
  }

  const create = async () => {
    setBusy(true); setMsg(null)
    try {
      await analyticsApi.createSchedule({
        dashboard_id: dashboardId, name, cadence, hour: Number(hour),
        weekday: cadence === 'weekly' ? Number(weekday) : null,
        recipients: emails, date_window: dateWindow,
      })
      setConfirming(false); setRecipients(''); await load(); setMsg('Schedule created.')
    } catch (e) { setMsg(e.message || 'Failed to create schedule') } finally { setBusy(false) }
  }

  const runNow = async (id) => {
    setBusy(true); setMsg(null)
    try { const r = await analyticsApi.runScheduleNow(id); setMsg(`Report sent (${r.sent || 0} recipient${(r.sent || 0) !== 1 ? 's' : ''}).`) }
    catch (e) { setMsg(e.message || 'Send failed') } finally { setBusy(false) }
  }
  const remove = async (id) => {
    setBusy(true)
    try { await analyticsApi.deleteSchedule(id); await load() } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="exp-modal-overlay" onMouseDown={onClose}>
      <div className="exp-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="exp-panel-head">
          <h3>{confirming ? 'Confirm schedule' : 'Schedule reports'}</h3>
          <button type="button" className="exp-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="exp-modal-body">
          {msg && <div className="exp-modal-msg">{msg}</div>}

          {confirming ? (
            <div className="exp-confirm">
              <p className="exp-confirm-q">Create this schedule?</p>
              <p className="exp-confirm-sum">{summary()}</p>
              <ul className="exp-confirm-list">{emails.map((e) => <li key={e}>{e}</li>)}</ul>
              <p className="exp-confirm-note">Reports render at your access scope and send automatically. You can delete the schedule anytime.</p>
            </div>
          ) : (
            <>
              {schedules.length > 0 && (
                <div className="exp-sched-list">
                  {schedules.map((s) => (
                    <div key={s.id} className="exp-sched-row">
                      <div className="exp-sched-info">
                        <div className="exp-sched-name">{s.name}</div>
                        <div className="exp-sched-meta">
                          {s.cadence} · {(s.recipients || []).length} recipient{(s.recipients || []).length !== 1 ? 's' : ''}
                          {s.last_status ? ` · last: ${s.last_status}` : ''}
                        </div>
                      </div>
                      <div className="exp-sched-actions">
                        <button type="button" className="exp-mini-btn" onClick={() => runNow(s.id)} disabled={busy}>Send now</button>
                        <button type="button" className="exp-icon-btn" onClick={() => remove(s.id)} disabled={busy} title="Delete">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="exp-panel-form">
                <label className="exp-field"><span>Name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="exp-field"><span>Frequency</span>
                  <select value={cadence} onChange={(e) => setCadence(e.target.value)}>
                    {CADENCES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </label>
                {cadence === 'weekly' && (
                  <label className="exp-field"><span>Day</span>
                    <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                      {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </label>
                )}
                {cadence !== 'every_12h' && (
                  <label className="exp-field"><span>Hour (24h)</span>
                    <input type="number" min="0" max="23" value={hour} onChange={(e) => setHour(e.target.value)} />
                  </label>
                )}
                <label className="exp-field"><span>Report covers</span>
                  <select value={dateWindow} onChange={(e) => setDateWindow(e.target.value)}>
                    {WINDOWS.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
                  </select>
                </label>
                <label className="exp-field"><span>Recipients (comma-separated emails)</span>
                  <input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="alex@company.com, sam@company.com" />
                </label>
              </div>
            </>
          )}
        </div>

        <div className="exp-panel-foot">
          {confirming ? (
            <>
              <button type="button" className="exp-btn-ghost" onClick={() => setConfirming(false)}>Back</button>
              <button type="button" className="exp-btn-primary" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Confirm & schedule'}</button>
            </>
          ) : (
            <>
              <button type="button" className="exp-btn-ghost" onClick={onClose}>Close</button>
              <button type="button" className="exp-btn-primary" disabled={!emails.length || busy}
                onClick={() => setConfirming(true)}
                title={!emails.length ? 'Add at least one recipient' : ''}>
                Schedule report
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
