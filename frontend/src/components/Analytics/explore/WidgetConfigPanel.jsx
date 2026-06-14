/**
 * WidgetConfigPanel — slide-over editor for a single widget. Users pick the dataset,
 * chart type, measure (Y), group-by dimension (X), date range, filters, and (admins)
 * a department. A live preview re-queries as the config changes.
 */
import { useMemo, useState } from 'react'
import { useWidgetData } from './useWidgetData'
import { Chart, autoSize } from './charts'

const VIZ_OPTIONS = [
  { key: 'number', label: 'Number' },
  { key: 'bar', label: 'Bar' },
  { key: 'line', label: 'Line' },
  { key: 'area', label: 'Area' },
  { key: 'time_series', label: 'Time series' },
  { key: 'pie', label: 'Pie / Donut' },
  { key: 'scatter', label: 'Scatter' },
  { key: 'histogram', label: 'Histogram' },
  { key: 'table', label: 'Table' },
]
const BUCKETS = ['day', 'week', 'month', 'quarter', 'year']
const OPS = [
  { key: '=', label: 'is' }, { key: '!=', label: 'is not' },
  { key: 'in', label: 'in (comma-sep)' }, { key: '>', label: '>' },
  { key: '<', label: '<' }, { key: 'contains', label: 'contains' },
]

const needsMeasure = (v) => ['number', 'bar', 'line', 'area', 'time_series', 'pie', 'table'].includes(v)
const needsDimension = (v) => ['bar', 'line', 'area', 'pie', 'table'].includes(v)

export default function WidgetConfigPanel({ catalog, globalRange, initial, onSave, onCancel }) {
  const datasets = catalog?.datasets || []
  const departments = catalog?.departments || []
  const presets = catalog?.date_presets || []

  const [draft, setDraft] = useState(() => normalize(initial, datasets))
  const ds = useMemo(() => datasets.find((d) => d.key === draft.dataset) || datasets[0], [datasets, draft.dataset])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const onDataset = (key) => {
    const nd = datasets.find((d) => d.key === key)
    set({
      dataset: key,
      measure: nd?.measures?.[0]?.key,
      dimension: nd?.dimensions?.find((x) => !x.date_bucket)?.key,
      field: nd?.fields?.[0]?.key,
      x_field: nd?.fields?.[0]?.key,
      y_field: nd?.fields?.[1]?.key || nd?.fields?.[0]?.key,
    })
  }

  const spec = buildSpec(draft, globalRange)
  const preview = useWidgetData(spec)

  const dims = (ds?.dimensions || []).filter((d) => !d.date_bucket)

  return (
    <div className="exp-panel-overlay" onMouseDown={onCancel}>
      <div className="exp-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="exp-panel-head">
          <h3>{initial?.key ? 'Edit widget' : 'Add widget'}</h3>
          <button type="button" className="exp-icon-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="exp-panel-body">
          <div className="exp-panel-form">
            <label className="exp-field">
              <span>Title</span>
              <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Untitled" />
            </label>

            <label className="exp-field">
              <span>Data</span>
              <select value={draft.dataset} onChange={(e) => onDataset(e.target.value)}>
                {datasets.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </label>

            <label className="exp-field">
              <span>Chart type</span>
              <select value={draft.viz} onChange={(e) => set({ viz: e.target.value })}>
                {VIZ_OPTIONS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </label>

            {needsMeasure(draft.viz) && (
              <label className="exp-field">
                <span>{draft.viz === 'number' ? 'Value' : 'Measure (Y)'}</span>
                <select value={draft.measure || ''} onChange={(e) => set({ measure: e.target.value })}>
                  {(ds?.measures || []).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </label>
            )}

            {needsDimension(draft.viz) && (
              <label className="exp-field">
                <span>Group by (X)</span>
                <select value={draft.dimension || ''} onChange={(e) => set({ dimension: e.target.value })}>
                  {dims.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
            )}

            {draft.viz === 'time_series' && (
              <label className="exp-field">
                <span>Bucket</span>
                <select value={draft.bucket || 'week'} onChange={(e) => set({ bucket: e.target.value })}>
                  {BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
            )}

            {draft.viz === 'histogram' && (
              <>
                <label className="exp-field">
                  <span>Field</span>
                  <select value={draft.field || ''} onChange={(e) => set({ field: e.target.value })}>
                    {(ds?.fields || []).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </label>
                <label className="exp-field">
                  <span>Bins</span>
                  <input type="number" min="2" max="50" value={draft.bins || 12}
                    onChange={(e) => set({ bins: Number(e.target.value) })} />
                </label>
              </>
            )}

            {draft.viz === 'scatter' && (
              <>
                <label className="exp-field">
                  <span>X axis</span>
                  <select value={draft.x_field || ''} onChange={(e) => set({ x_field: e.target.value })}>
                    {(ds?.fields || []).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </label>
                <label className="exp-field">
                  <span>Y axis</span>
                  <select value={draft.y_field || ''} onChange={(e) => set({ y_field: e.target.value })}>
                    {(ds?.fields || []).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </label>
                <label className="exp-field">
                  <span>Colour by (optional)</span>
                  <select value={draft.series || ''} onChange={(e) => set({ series: e.target.value || undefined })}>
                    <option value="">None</option>
                    {dims.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </label>
              </>
            )}

            <label className="exp-field">
              <span>Date range</span>
              <select value={draft.datePreset} onChange={(e) => set({ datePreset: e.target.value })}>
                <option value="inherit">Inherit dashboard</option>
                {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </label>

            {departments.length > 0 && ds?.dept_scoped && (
              <label className="exp-field">
                <span>Department</span>
                <select value={draft.department_id || ''} onChange={(e) => set({ department_id: e.target.value || undefined })}>
                  <option value="">All departments</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
            )}

            {/* Filters */}
            <div className="exp-filters">
              <div className="exp-filters-head">
                <span>Filters</span>
                <button type="button" className="exp-mini-btn"
                  onClick={() => set({ filters: [...(draft.filters || []), { field: dims[0]?.key, op: '=', value: '' }] })}>
                  + Add
                </button>
              </div>
              {(draft.filters || []).map((f, i) => (
                <div key={i} className="exp-filter-row">
                  <select value={f.field || ''} onChange={(e) => updateFilter(set, draft, i, { field: e.target.value })}>
                    {dims.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                  <select value={f.op} onChange={(e) => updateFilter(set, draft, i, { op: e.target.value })}>
                    {OPS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <input value={f.value} placeholder="value"
                    onChange={(e) => updateFilter(set, draft, i, { value: e.target.value })} />
                  <button type="button" className="exp-icon-btn"
                    onClick={() => set({ filters: draft.filters.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div className="exp-panel-preview">
            <div className="exp-preview-label">Preview</div>
            <div className="exp-preview-canvas">
              {preview.loading ? <div className="exp-chart-loading skeleton-block" />
                : preview.error ? <div className="exp-chart-error">{preview.error}</div>
                : <Chart result={preview.result} />}
            </div>
          </div>
        </div>

        <div className="exp-panel-foot">
          <button type="button" className="exp-btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="exp-btn-primary"
            onClick={() => onSave({ key: draft.key, title: draft.title, size: initial?.key ? draft.size : autoSize(draft.viz), spec })}>
            {initial?.key ? 'Save widget' : 'Add widget'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────
function normalize(initial, datasets) {
  if (initial?.spec) {
    const s = initial.spec
    return {
      key: initial.key,
      title: initial.title || '',
      size: initial.size || { w: 2, h: 'md' },
      dataset: s.dataset || 'applications',
      viz: s.viz || 'bar',
      measure: s.measure,
      dimension: s.dimension,
      field: s.field,
      x_field: s.x_field,
      y_field: s.y_field,
      series: s.series,
      bucket: s.bucket || 'week',
      bins: s.bins || 12,
      filters: s.filters || [],
      department_id: s.department_id,
      datePreset: s.date_range?.preset || 'inherit',
    }
  }
  const ds = datasets[0]
  return {
    title: '', size: { w: 2, h: 'md' },
    dataset: ds?.key || 'applications', viz: 'bar',
    measure: ds?.measures?.[0]?.key,
    dimension: ds?.dimensions?.find((d) => !d.date_bucket)?.key,
    field: ds?.fields?.[0]?.key,
    x_field: ds?.fields?.[0]?.key,
    y_field: ds?.fields?.[1]?.key || ds?.fields?.[0]?.key,
    bucket: 'week', bins: 12, filters: [], datePreset: 'inherit',
  }
}

function updateFilter(set, draft, i, patch) {
  const filters = (draft.filters || []).map((f, j) => (j === i ? { ...f, ...patch } : f))
  set({ filters })
}

function buildSpec(draft, globalRange) {
  const spec = { dataset: draft.dataset, viz: draft.viz }
  if (needsMeasure(draft.viz)) spec.measure = draft.measure
  if (draft.viz === 'table') spec.measures = [draft.measure]
  if (needsDimension(draft.viz)) spec.dimension = draft.dimension
  if (draft.viz === 'time_series') { spec.dimension = 'date'; spec.bucket = draft.bucket }
  if (draft.viz === 'histogram') { spec.field = draft.field; spec.bins = draft.bins }
  if (draft.viz === 'scatter') { spec.x_field = draft.x_field; spec.y_field = draft.y_field; if (draft.series) spec.series = draft.series }
  if (draft.department_id) spec.department_id = Number(draft.department_id)

  const filters = (draft.filters || [])
    .filter((f) => f.field && f.value !== '' && f.value != null)
    .map((f) => ({
      field: f.field,
      op: f.op,
      value: f.op === 'in' ? String(f.value).split(',').map((s) => s.trim()).filter(Boolean) : f.value,
    }))
  if (filters.length) spec.filters = filters

  if (draft.datePreset && draft.datePreset !== 'inherit') spec.date_range = { preset: draft.datePreset }
  else if (globalRange) spec.date_range = globalRange
  return spec
}
