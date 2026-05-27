import React from 'react';
import { useChat } from '../../context/ChatContext';
import { IconLoader, IconAlertCircle, IconCheck } from './icons';

const STAGE_META = {
  intake:          { label: 'Intake',            retry: 'HARD', hint: "Tell me about the role you're hiring for." },
  internal_check:  { label: 'Internal check',    retry: 'SOFT', hint: 'Pulling skills from past TechCorp JDs.' },
  market_research: { label: 'Market research',   retry: 'SOFT', hint: 'Scanning competitor JDs for benchmark skills.' },
  benchmarking:    { label: 'Benchmarking',      retry: 'SOFT', hint: 'Filtering market signal into the JD.' },
  jd_variants:     { label: 'JD variants',       retry: 'HARD', hint: "Pick a variant on the left to keep moving." },
  final_jd:        { label: 'Final JD',          retry: 'HARD', hint: 'Drafting the full JD now.' },
  bias_check:      { label: 'Inclusivity',       retry: 'SOFT', hint: 'Scanning for biased or exclusionary phrasing.' },
  complete:        { label: 'Ready to save',     retry: 'HARD', hint: 'Save to create the position and trigger sourcing.' },
};

/**
 * Right-rail card showing the current stage with HARD/SOFT semantics and
 * a one-line hint. Doubles as the retry surface if the orchestrator hits
 * an error (`error` from ChatContext).
 *
 * Spec: docs/redesign/05_jd_chat.md §6.A.
 */
export default function RailStateCard() {
  const { workflowStage, isStreaming, error } = useChat();
  const stage = STAGE_META[workflowStage] || STAGE_META.intake;
  const showActive = isStreaming || workflowStage !== 'complete';

  return (
    <div className="rail-state">
      <div className="rail-state-row">
        <span className="rail-state-dot" data-active={showActive || undefined} aria-hidden="true" />
        <span className="rail-state-label">{stage.label}</span>
        <span className={`rail-state-retry retry-${stage.retry.toLowerCase()}`}>{stage.retry}</span>
      </div>
      <p className="rail-state-hint">
        {workflowStage === 'complete' ? (
          <span className="rail-state-done"><IconCheck size={14} /> {stage.hint}</span>
        ) : isStreaming ? (
          <span><IconLoader size={14} /> Working…</span>
        ) : (
          stage.hint
        )}
      </p>

      {error && (
        <div className="rail-state-error" role="alert">
          <IconAlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
