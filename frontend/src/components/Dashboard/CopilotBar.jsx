/**
 * CopilotBar.jsx — v3 refactor
 * Horizontal scroll of actionable suggestion pills.
 * Each pill is dismissible (×). "Dismiss all" button on the right.
 *
 * Props:
 *   suggestions — normalized array from useDashboardData
 *   onDismiss(id)  — fn
 *   onDismissAll() — fn
 */
import { useNavigate } from 'react-router-dom'
import Icon from '../common/Icon'

export default function CopilotBar({ suggestions, onDismiss, onDismissAll }) {
  const navigate = useNavigate()

  if (!suggestions || suggestions.length === 0) return null

  return (
    <div className="copilot-bar-v3" role="region" aria-label="AI Copilot suggestions">
      <div className="copilot-bar-header">
        <span className="copilot-bar-label">
          <span className="copilot-bar-pulse-dot" aria-hidden="true" />
          <Icon name="cpu" size={13} />
          AI Copilot
        </span>
        <span className="copilot-bar-count">
          {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
        </span>
        <button
          className="copilot-dismiss-all-btn"
          onClick={onDismissAll}
          type="button"
        >
          Dismiss all
        </button>
      </div>

      <div className="copilot-pills-scroll">
        {suggestions.slice(0, 6).map(s => {
          const color = s.meta?.color || 'var(--color-primary, #0D9488)'
          const iconName = s.meta?.icon || 'cpu'
          return (
            <div
              key={s.id}
              className="copilot-pill"
              style={{ '--pill-color': color }}
            >
              <span className="copilot-pill-icon" style={{ color }} aria-hidden="true">
                <Icon name={iconName} size={13} />
              </span>
              <span className="copilot-pill-text">{s.title}</span>
              {s.action_url && (
                <button
                  className="copilot-pill-action"
                  onClick={() => navigate(s.action_url)}
                  type="button"
                  style={{ color }}
                >
                  {s.action_label || 'View →'}
                </button>
              )}
              <button
                className="copilot-pill-dismiss"
                onClick={() => onDismiss(s.id)}
                type="button"
                aria-label="Dismiss suggestion"
              >
                <Icon name="x" size={11} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
