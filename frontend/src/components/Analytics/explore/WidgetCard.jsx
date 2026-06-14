/**
 * WidgetCard — one chart on the Explore grid. Fetches its own data, renders the chart,
 * and auto-sizes by chart type. In edit mode it exposes a compact width cycle, edit,
 * remove, and a drag handle (no clunky button rows).
 */
import { useWidgetData } from './useWidgetData'
import { Chart, autoSize } from './charts'

export default function WidgetCard({
  widget, globalRange, editMode, onEdit, onRemove, onResize, drag,
}) {
  // Per-widget date range wins; otherwise inherit the dashboard's global range.
  const spec = { ...widget.spec, date_range: widget.spec?.date_range || globalRange }
  const { loading, error, result } = useWidgetData(spec)

  const auto = autoSize(widget.spec?.viz)
  const w = widget.size?.w || auto.w
  const h = widget.size?.h || auto.h
  const cycleWidth = () => onResize({ w: (w % 4) + 1 })

  return (
    <div
      className={`exp-widget exp-w-${w} exp-h-${h}${drag?.isOver ? ' exp-drag-over' : ''}`}
      draggable={editMode}
      onDragStart={drag?.onDragStart}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
      onDragEnd={drag?.onDragEnd}
    >
      <div className="exp-widget-head">
        <span className="exp-widget-title" title={widget.title}>
          {editMode && <span className="exp-drag-dots" aria-hidden>⠿</span>}
          {widget.title || 'Untitled'}
        </span>
        {editMode && (
          <div className="exp-widget-actions">
            <button type="button" className="exp-size-cycle" onClick={cycleWidth} title="Cycle width">{w}×</button>
            <button type="button" className="exp-icon-btn" onClick={onEdit} title="Edit widget">⚙</button>
            <button type="button" className="exp-icon-btn" onClick={onRemove} title="Remove widget">✕</button>
          </div>
        )}
      </div>

      <div className="exp-widget-body">
        {loading
          ? <div className="exp-chart-loading skeleton-block" />
          : error
            ? <div className="exp-chart-error">{error}</div>
            : <Chart result={result} />}
      </div>
    </div>
  )
}
