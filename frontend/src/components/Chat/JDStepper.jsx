import React, { useMemo } from 'react';
import { useChat } from '../../context/ChatContext';
import { IconCheck, IconX, IconLoader } from './icons';

/**
 * Top stepper with one pill per LangGraph stage. Each pill shows:
 *   - step number / glyph (done ✓ · skipped ⊘ · active ● · pending ○)
 *   - stage label
 *   - HARD STOP or SOFT SKIP retry behavior tag
 *
 * Spec: docs/design/pages/05_jd_chat.md §4.
 *
 * Stage list is fixed and matches `backend/agents/orchestrator.py` plus the
 * 'complete' terminal state. Benchmarking is merged into market_research's
 * pill (it always runs inline as part of market intel and doesn't have its
 * own user-facing handoff).
 */
const STAGES = [
  { key: 'intake',          label: 'Intake',         retry: 'HARD' },
  { key: 'internal_check',  label: 'Internal',       retry: 'SOFT' },
  { key: 'market_research', label: 'Market',         retry: 'SOFT' },
  { key: 'jd_variants',     label: 'Variants',       retry: 'HARD' },
  { key: 'final_jd',        label: 'Final JD',       retry: 'HARD' },
  { key: 'bias_check',      label: 'Inclusivity',    retry: 'SOFT' },
  { key: 'complete',        label: 'Save',           retry: 'HARD' },
];

// Stages we treat as "running" — final stage `complete` is special: the
// stepper marks it done only once the user has saved the position.
const RUNNING_STAGES = STAGES.map((s) => s.key);

function statePerStage(currentStage, gs, skipped, isReadOnly) {
  let effectiveStage = currentStage;
  // If bias check has issues defined, it means it has finished running.
  // Visually advance the stepper to the final 'Save' stage.
  if (currentStage === 'bias_check' && gs?.bias_issues !== undefined) {
    effectiveStage = 'complete';
  }

  const currentIdx = RUNNING_STAGES.indexOf(effectiveStage);
  const map = {};
  RUNNING_STAGES.forEach((key, idx) => {
    if (skipped.has(key)) {
      map[key] = 'skipped';
      return;
    }
    // If the chat is read only (saved/finalized), all stages should be done
    if (isReadOnly || currentStage === 'complete') {
      map[key] = 'done';
      return;
    }
    if (idx < currentIdx) {
      map[key] = 'done';
      return;
    }
    if (idx === currentIdx) {
      map[key] = 'current';
      return;
    }
    map[key] = 'pending';
  });

  if (gs?.bias_skipped && currentIdx > RUNNING_STAGES.indexOf('bias_check')) {
    map.bias_check = 'skipped';
  }
  return map;
}

export default function JDStepper({ isRailOpen, onToggleRail }) {
  const { workflowStage, stageSkipped, graphState, isReadOnly } = useChat();
  const skipped = useMemo(() => new Set(stageSkipped || []), [stageSkipped]);

  const states = useMemo(
    () => statePerStage(workflowStage, graphState, skipped, isReadOnly),
    [workflowStage, graphState, skipped, isReadOnly]
  );

  return (
    <nav className="jd-stepper" aria-label="JD generation pipeline">
      <ol className="jd-stepper-list">
        {STAGES.map((s, idx) => {
          const state = states[s.key] || 'pending';
          const clickable = state === 'done';
          const onClick = () => {
            if (!clickable) return;
            const el = document.querySelector(`.agent-block[data-stage="${s.key}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          };
          return (
            <li
              key={s.key}
              className={`jd-stepper-item${clickable ? ' is-clickable' : ''}`}
              data-state={state}
              onClick={onClick}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={(e) => {
                if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onClick();
                }
              }}
            >
              <span className="jd-stepper-dot" aria-hidden="true">
                {state === 'done' && <IconCheck size={12} />}
                {state === 'skipped' && <IconX size={12} />}
                {state === 'current' && <IconLoader size={12} />}
                {state === 'pending' && <span className="jd-stepper-num">{idx + 1}</span>}
              </span>
              <span className="jd-stepper-label">{s.label}</span>
              <span className={`jd-stepper-retry retry-${s.retry.toLowerCase()}`}>
                {s.retry}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="jd-stepper-actions">
        <button 
          onClick={onToggleRail} 
          className="icon-btn toggle-rail-btn" 
          title={isRailOpen ? "Hide Rail" : "Show Rail"}
          aria-label={isRailOpen ? "Hide Rail" : "Show Rail"}
        >
          {isRailOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="15" y1="3" x2="15" y2="21"></line>
              </svg>
          ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
          )}
        </button>
      </div>
    </nav>
  );
}
