import React, { useEffect, useMemo, useState } from 'react';
import { useChat } from '../../../context/ChatContext';
import AgentBlockShell from './AgentBlockShell';
import ProvenanceChip from '../ProvenanceChip';
import { IconArrowRight } from '../icons';

/**
 * Stage 2 — Internal skills check.
 *
 * Reads the SSE `card_internal` payload from `internalCard` (an array of
 * SkillItem objects). User toggles chips into/out of the JD. Confirming
 * advances the stage via `accept_internal`; "skip" via `skip_internal`.
 *
 * After confirmation the block auto-transitions to `done` status. We keep
 * it rendered so the JD canvas reads as a stable document.
 */
export default function AgentBlockInternal() {
  const { internalCard, sendMessage, isStreaming, graphState } = useChat();
  const [accepted, setAccepted] = useState(new Set());
  const isLocked = (graphState?.internal_skills_accepted?.length ?? 0) > 0
                || graphState?.internal_skipped === true;

  // Seed initial selection: default to all skills that have selected=true,
  // or every skill if the backend didn't pre-select anything.
  useEffect(() => {
    if (!internalCard) return;
    const initial = new Set();
    internalCard.forEach((s) => {
      if (s.selected === false) return;
      initial.add(s.skill);
    });
    setAccepted(initial);
  }, [internalCard]);

  // Once accepted upstream, mirror that into local toggle state so re-renders
  // are accurate (e.g. after resume).
  useEffect(() => {
    const upstream = graphState?.internal_skills_accepted || [];
    if (!upstream.length) return;
    setAccepted(new Set(upstream));
  }, [graphState?.internal_skills_accepted]);

  const toggle = (skill) => {
    if (isLocked) return;
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  };

  const onConfirm = () => {
    sendMessage({
      action: 'accept_internal',
      action_data: { skills: Array.from(accepted) },
    });
  };

  const onSkip = () => {
    sendMessage({ action: 'skip_internal' });
  };

  const skills = useMemo(() => internalCard || [], [internalCard]);
  if (!skills.length) return null;

  return (
    <AgentBlockShell
      stage="internal_check"
      number={2}
      title="Internal skills check"
      subtitle={`${skills.length} skill${skills.length === 1 ? '' : 's'} pulled from past TechCorp JDs`}
      status={isLocked ? 'done' : 'active'}
    >
      <div className="chip-cloud">
        {skills.map((s, i) => (
          <ProvenanceChip
            key={`${s.skill}-${i}`}
            skill={s.skill}
            source={s.source || 'Past JD'}
            year={s.year}
            selected={accepted.has(s.skill)}
            tone="internal"
            onToggle={() => toggle(s.skill)}
          />
        ))}
      </div>
      {!isLocked && (
        <div className="agent-block-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onSkip}
            disabled={isStreaming}
          >
            Skip
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onConfirm}
            disabled={isStreaming}
          >
            Use {accepted.size} skill{accepted.size === 1 ? '' : 's'} <IconArrowRight size={14} />
          </button>
        </div>
      )}
    </AgentBlockShell>
  );
}
