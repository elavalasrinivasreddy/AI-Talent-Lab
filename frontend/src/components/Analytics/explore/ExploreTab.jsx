/**
 * ExploreTab — the self-serve analytics workspace (3rd Analytics tab).
 *
 * Loads the catalog + saved dashboards, renders a drag-arrangeable grid of widgets,
 * and lets users add/edit/resize widgets via WidgetConfigPanel. New users land on a
 * populated default dashboard so the page is useful before any customisation.
 */
import { useEffect, useRef, useState } from 'react'
import { analyticsApi } from '../../../utils/api'
import WidgetCard from './WidgetCard'
import WidgetConfigPanel from './WidgetConfigPanel'
import AskBar from './AskBar'
import ScheduleDialog from './ScheduleDialog'
import { autoSize } from './charts'
import './explore.css'

const genKey = () => 'w' + Math.random().toString(36).slice(2, 9)

// A useful starter board demonstrating every chart type against the applications data.
const defaultWidgets = () => [
  { key: genKey(), title: 'Total Applications', size: { w: 1, h: 'sm' }, spec: { dataset: 'applications', viz: 'number', measure: 'applications' } },
  { key: genKey(), title: 'Hires', size: { w: 1, h: 'sm' }, spec: { dataset: 'applications', viz: 'number', measure: 'hires' } },
  { key: genKey(), title: 'Avg Time to Hire', size: { w: 1, h: 'sm' }, spec: { dataset: 'applications', viz: 'number', measure: 'avg_time_to_hire' } },
  { key: genKey(), title: 'AI-Sourced Share', size: { w: 1, h: 'sm' }, spec: { dataset: 'applications', viz: 'number', measure: 'ai_sourced_share' } },
  { key: genKey(), title: 'Applications over time', size: { w: 2, h: 'md' }, spec: { dataset: 'applications', viz: 'time_series', measure: 'applications', dimension: 'date', bucket: 'week' } },
  { key: genKey(), title: 'Applications by source', size: { w: 2, h: 'md' }, spec: { dataset: 'applications', viz: 'pie', measure: 'applications', dimension: 'source' } },
  { key: genKey(), title: 'Applications by department', size: { w: 2, h: 'md' }, spec: { dataset: 'applications', viz: 'bar', measure: 'applications', dimension: 'department' } },
  { key: genKey(), title: 'Pipeline by stage', size: { w: 2, h: 'md' }, spec: { dataset: 'applications', viz: 'bar', measure: 'applications', dimension: 'status' } },
  { key: genKey(), title: 'Match-score distribution', size: { w: 2, h: 'md' }, spec: { dataset: 'applications', viz: 'histogram', field: 'match_score', bins: 12 } },
  { key: genKey(), title: 'Hires by position', size: { w: 2, h: 'md' }, spec: { dataset: 'applications', viz: 'bar', measure: 'hires', dimension: 'position' } },
]

export default function ExploreTab() {
  const [catalog, setCatalog] = useState(null)
  const [dashboards, setDashboards] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [title, setTitle] = useState('My Analytics')
  const [widgets, setWidgets] = useState([])
  const [editMode, setEditMode] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [globalPreset, setGlobalPreset] = useState('last_90_days')
  const [panel, setPanel] = useState(null)        // { widget|null }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const dragIndex = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  // Load catalog + dashboards once.
  useEffect(() => {
    let alive = true
    Promise.all([analyticsApi.getCatalog(), analyticsApi.listDashboards()])
      .then(([cat, dash]) => {
        if (!alive) return
        setCatalog(cat)
        const list = dash?.dashboards || []
        setDashboards(list)
        if (list.length) loadDashboard(list[0])
        else setWidgets(defaultWidgets())   // first run: populated board, View mode
      })
      .catch((e) => alive && setError(e.message || 'Failed to load analytics'))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loadDashboard(d) {
    setCurrentId(d.id)
    setTitle(d.name || 'Untitled')
    setWidgets(Array.isArray(d.widgets) ? d.widgets : [])
    setDirty(false)
    setEditMode(false)
  }

  async function selectDashboard(id) {
    if (!id) { // "+ New"
      setCurrentId(null); setTitle('Untitled'); setWidgets([]); setEditMode(true); setDirty(true)
      return
    }
    try {
      const d = await analyticsApi.getDashboard(id)
      loadDashboard(d)
    } catch (e) { setError(e.message) }
  }

  const globalRange = { preset: globalPreset }

  // Widget mutations
  const upsertWidget = (w) => {
    setWidgets((ws) => {
      const exists = ws.some((x) => x.key === w.key)
      if (exists) return ws.map((x) => (x.key === w.key ? { ...x, ...w } : x))
      return [...ws, { ...w, key: w.key || genKey() }]
    })
    setDirty(true); setPanel(null)
  }
  const addFromAI = (w) =>
    upsertWidget({ key: genKey(), title: w.title, spec: w.spec, size: autoSize(w.spec?.viz) })
  const removeWidget = (key) => { setWidgets((ws) => ws.filter((x) => x.key !== key)); setDirty(true) }
  const resizeWidget = (key, patch) => {
    setWidgets((ws) => ws.map((x) => (x.key === key ? { ...x, size: { ...(x.size || { w: 2, h: 'md' }), ...patch } } : x)))
    setDirty(true)
  }

  // Drag-to-reorder
  const dragFor = (i) => ({
    isOver: dragOver === i,
    onDragStart: () => { dragIndex.current = i },
    onDragOver: (e) => { e.preventDefault(); if (dragOver !== i) setDragOver(i) },
    onDrop: (e) => {
      e.preventDefault()
      const from = dragIndex.current
      setDragOver(null); dragIndex.current = null
      if (from == null || from === i) return
      setWidgets((ws) => {
        const next = [...ws]
        const [moved] = next.splice(from, 1)
        next.splice(i, 0, moved)
        return next
      })
      setDirty(true)
    },
    onDragEnd: () => { setDragOver(null); dragIndex.current = null },
  })

  async function save() {
    setSaving(true); setError(null)
    const body = { name: title || 'Untitled', widgets, layout: [] }
    try {
      if (currentId) {
        await analyticsApi.updateDashboard(currentId, body)
      } else {
        const created = await analyticsApi.createDashboard({ ...body, scope: 'private' })
        setCurrentId(created.id)
      }
      const dash = await analyticsApi.listDashboards()
      setDashboards(dash?.dashboards || [])
      setDirty(false)
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally { setSaving(false) }
  }

  if (error && !catalog) return <div className="analytics-error" role="alert">{error}</div>
  if (!catalog) return <div className="exp-loading">Loading analytics…</div>

  return (
    <div className="explore-tab">
      <div className="exp-toolbar">
        <div className="exp-toolbar-left">
          <select className="exp-select" value={currentId || ''} onChange={(e) => selectDashboard(Number(e.target.value) || '')}>
            {!currentId && <option value="">{title} (unsaved)</option>}
            {dashboards.map((d) => <option key={d.id} value={d.id}>{d.name}{d.is_preset ? ' • preset' : ''}</option>)}
            <option value="">+ New dashboard</option>
          </select>
          {editMode && (
            <input className="exp-title-input" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true) }} placeholder="Dashboard name" />
          )}
        </div>

        <div className="exp-toolbar-right">
          <select className="exp-select" value={globalPreset} onChange={(e) => setGlobalPreset(e.target.value)} title="Date range (all widgets)">
            {(catalog.date_presets || []).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {editMode && <button type="button" className="exp-btn-ghost" onClick={() => setPanel({ widget: null })}>+ Add widget</button>}
          <button type="button" className="exp-btn-ghost" onClick={() => setScheduleOpen(true)}
            disabled={!currentId} title={currentId ? 'Schedule emailed reports' : 'Save the dashboard first to schedule it'}>
            Schedule
          </button>
          <button type="button" className="exp-btn-ghost" onClick={() => setEditMode((v) => !v)}>{editMode ? 'Done' : 'Edit'}</button>
          <button type="button" className="exp-btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>

      {error && <div className="analytics-error" role="alert">{error}</div>}

      <div className="exp-layout">
        <div className="exp-main">
          {widgets.length === 0 ? (
            <div className="exp-blank">
              <p>This dashboard is empty.</p>
              <button type="button" className="exp-btn-primary" onClick={() => setPanel({ widget: null })}>+ Add your first widget</button>
            </div>
          ) : (
            <div className="exp-grid">
              {widgets.map((w, i) => (
                <WidgetCard
                  key={w.key}
                  widget={w}
                  globalRange={globalRange}
                  editMode={editMode}
                  onEdit={() => setPanel({ widget: w })}
                  onRemove={() => removeWidget(w.key)}
                  onResize={(patch) => resizeWidget(w.key, patch)}
                  drag={editMode ? dragFor(i) : null}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="exp-aside">
          <AskBar onCreate={addFromAI} />
        </aside>
      </div>

      {panel && (
        <WidgetConfigPanel
          catalog={catalog}
          globalRange={globalRange}
          initial={panel.widget}
          onSave={upsertWidget}
          onCancel={() => setPanel(null)}
        />
      )}
      {scheduleOpen && (
        <ScheduleDialog
          dashboardId={currentId}
          dashboardName={title}
          onClose={() => setScheduleOpen(false)}
        />
      )}
    </div>
  )
}
