import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';
import AgentBlockShell from './AgentBlockShell';
import { IconArrowRight, IconCheck } from '../icons';

const VARIANT_LABELS = {
  skill_focused:   { label: 'Skill-focused',   tagline: 'Lead with the tech and tooling you need' },
  outcome_focused: { label: 'Outcome-focused', tagline: 'Lead with what the role will achieve' },
  hybrid:          { label: 'Hybrid',          tagline: 'Skills + outcomes, balanced' },
};

/**
 * Stage 4 — JD Variants.
 *
 * Renders 3 variants in a comparator grid. User picks one, which triggers
 * `select_variant` → orchestrator runs drafting_final → SSE jd_token stream.
 *
 * Phase 1 ships the picker only. Phase 2 adds inline Edit + Regenerate
 * actions per spec §10.
 */
export default function AgentBlockVariants() {
  const { variantsCard, sendMessage, isStreaming, graphState } = useChat();
  const [hovered, setHovered] = useState(null);

  const variants = variantsCard?.variants || [];
  const alreadySelected = graphState?.selected_variant || variantsCard?.selected || null;
  const isLocked = Boolean(alreadySelected);

  if (!variants.length) return null;

  const onSelect = (variantType) => {
    if (isStreaming || isLocked) return;
    sendMessage({
      action: 'select_variant',
      action_data: { variant_type: variantType },
    });
  };

  return (
    <AgentBlockShell
      stage="jd_variants"
      number={4}
      title="JD variants"
      subtitle={
        isLocked
          ? `Selected: ${VARIANT_LABELS[alreadySelected]?.label || alreadySelected}`
          : 'Three styles. Pick the one that fits your team.'
      }
      status={isLocked ? 'done' : 'active'}
    >
      <div className="variant-grid">
        {variants.map((v) => {
          const meta = VARIANT_LABELS[v.type] || { label: v.type, tagline: v.summary };
          const isPicked = v.type === alreadySelected;
          const isHovered = hovered === v.type;
          return (
            <article
              key={v.type}
              className={`variant-card ${isPicked ? 'is-picked' : ''} ${isHovered ? 'is-hovered' : ''}`}
              onMouseEnter={() => setHovered(v.type)}
              onMouseLeave={() => setHovered(null)}
            >
              <header className="variant-card-head">
                <span className="variant-card-kicker">{meta.label}</span>
                {isPicked && (
                  <span className="variant-card-badge" title="Picked">
                    <IconCheck size={12} /> Picked
                  </span>
                )}
              </header>
              <p className="variant-card-tagline">{meta.tagline}</p>
              {v.summary && v.summary !== meta.tagline && (
                <p className="variant-card-summary">{v.summary}</p>
              )}
              <div className="variant-card-meta">
                {typeof v.skills_count === 'number' && (
                  <span>{v.skills_count} skill{v.skills_count === 1 ? '' : 's'}</span>
                )}
                {v.tone && <span>{v.tone} tone</span>}
              </div>
              <button
                type="button"
                className={`btn btn--block ${isPicked ? 'btn--ghost' : 'btn--primary'}`}
                disabled={isStreaming || isLocked}
                onClick={() => onSelect(v.type)}
              >
                {isPicked ? 'Selected' : <>Use this <IconArrowRight size={14} /></>}
              </button>
            </article>
          );
        })}
      </div>
    </AgentBlockShell>
  );
}
