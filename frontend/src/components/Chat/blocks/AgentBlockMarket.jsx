import React, { useEffect, useMemo, useState } from 'react';
import { useChat } from '../../../context/ChatContext';
import AgentBlockShell from './AgentBlockShell';
import ProvenanceChip from '../ProvenanceChip';
import { IconArrowRight } from '../icons';

/**
 * Stage 3 — Market research.
 *
 * Reads SSE `card_market` payload from `marketCard`:
 *   { skills: SkillItem[], competitors: string[] }
 * Same UX as Internal Check but provenance shows competitor name(s).
 */
export default function AgentBlockMarket() {
  const { marketCard, sendMessage, isStreaming, graphState } = useChat();
  const [accepted, setAccepted] = useState(new Set());
  const isLocked = (graphState?.market_skills_accepted?.length ?? 0) > 0
                || graphState?.market_skipped === true;

  const skills = useMemo(() => marketCard?.skills || [], [marketCard]);
  const competitors = useMemo(() => marketCard?.competitors || [], [marketCard]);

  useEffect(() => {
    if (!skills.length) return;
    const initial = new Set();
    skills.forEach((s) => {
      if (s.selected === false) return;
      initial.add(s.skill);
    });
    setAccepted(initial);
  }, [skills]);

  useEffect(() => {
    const upstream = graphState?.market_skills_accepted || [];
    if (!upstream.length) return;
    setAccepted(new Set(upstream));
  }, [graphState?.market_skills_accepted]);

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
      action: 'accept_market',
      action_data: { skills: Array.from(accepted) },
    });
  };

  const onSkip = () => {
    sendMessage({ action: 'skip_market' });
  };

  if (!skills.length) return null;

  return (
    <AgentBlockShell
      stage="market_research"
      number={3}
      title="Market research"
      subtitle={
        competitors.length
          ? `Competitors scanned: ${competitors.slice(0, 3).join(', ')}${competitors.length > 3 ? '…' : ''}`
          : `${skills.length} skills surfaced from the market`
      }
      status={isLocked ? 'done' : 'active'}
    >
      <div className="chip-cloud">
        {skills.map((s, i) => (
          <ProvenanceChip
            key={`${s.skill}-${i}`}
            skill={s.skill}
            source={s.source || 'Market scan'}
            year={s.year}
            selected={accepted.has(s.skill)}
            tone="market"
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
