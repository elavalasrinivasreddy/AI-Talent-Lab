import { RELAY_STAGES, computeRelayStates } from './helpers'
import { CheckIcon } from './icons'

/**
 * Five-step relay viz per docs/design/pages/09_hire_request.md §4.
 * Each stage is a numbered ring; line segments between them indicate
 * whether the handoff has occurred.
 *
 * Stages with `phase2: true` are dimmed — they're scaffolding for the
 * multi-approver flow that ships in Phase 2.
 */
export default function RelayVisualization({ request }) {
  const states = computeRelayStates(request)

  return (
    <ol className="hr-relay" aria-label="Hire request progress">
      {RELAY_STAGES.map((stage, idx) => {
        const state = states[stage.key] || 'pending'
        const lineState = idx < RELAY_STAGES.length - 1
          ? (states[RELAY_STAGES[idx + 1].key] !== 'pending' ? 'done' : 'pending')
          : null

        return (
          <li key={stage.key} className={`hr-relay-step state-${state}`} data-phase2={stage.phase2 || undefined}>
            <div className="hr-relay-ring" aria-hidden="true">
              {state === 'done' ? <CheckIcon size={14} /> : <span>{idx + 1}</span>}
            </div>
            <div className="hr-relay-text">
              <div className="hr-relay-label">{stage.label}</div>
              <div className="hr-relay-who">{stage.who(request)}</div>
            </div>
            {lineState !== null && (
              <span className={`hr-relay-line ${lineState === 'done' ? 'is-done' : ''}`} aria-hidden="true" />
            )}
          </li>
        )
      })}
    </ol>
  )
}
