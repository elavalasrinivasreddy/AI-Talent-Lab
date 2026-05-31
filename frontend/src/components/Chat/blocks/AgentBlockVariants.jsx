import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';
import AgentBlockShell from './AgentBlockShell';
import { IconArrowRight, IconCheck } from '../icons';

const VARIANT_LABELS = {
  skill_focused:   { label: 'Skill-focused',   tagline: 'Lead with the tech and tooling you need' },
  outcome_focused: { label: 'Outcome-focused', tagline: 'Lead with what the role will achieve' },
  hybrid:          { label: 'Hybrid',          tagline: 'Skills + outcomes, balanced' },
};

export default function AgentBlockVariants() {
  const { variantsCard, sendMessage, isStreaming, graphState, isReadOnly } = useChat();
  const [editing, setEditing] = useState(null);     // variant_type currently being edited
  const [draftSummary, setDraftSummary] = useState('');
  const [refinement, setRefinement] = useState('');

  const variants = variantsCard?.variants || [];
  const alreadySelected = graphState?.selected_variant || variantsCard?.selected || null;
  const isLocked = Boolean(alreadySelected) || isReadOnly;

  if (!variants.length) return null;

  const onSelect = (variantType) => {
    if (isStreaming || isLocked) return;
    sendMessage({
      action: 'select_variant',
      action_data: { variant_type: variantType },
    });
  };

  const onStartEdit = (v) => {
    setEditing(v.type);
    setDraftSummary(v.summary || '');
  };

  const onSaveEdit = () => {
    sendMessage({
      action: 'edit_variant',
      action_data: { variant_type: editing, summary: draftSummary },
    });
    setEditing(null);
    setDraftSummary('');
  };

  const onRegenerate = () => {
    sendMessage({
      action: 'regenerate_variants',
      action_data: refinement.trim() ? { refinement: refinement.trim() } : {},
    });
    setRefinement('');
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
          const isEditing = editing === v.type;
          return (
            <article
              key={v.type}
              className={`variant-card ${isPicked ? 'is-picked' : ''} ${isEditing ? 'is-editing' : ''}`}
            >
              <header className="variant-card-head">
                <span className="variant-card-kicker">{meta.label}</span>
                {isPicked && (
                  <span className="variant-card-badge" title="Picked">
                    <IconCheck size={12} /> Picked
                  </span>
                )}
              </header>

              {isEditing ? (
                <>
                  <textarea
                    className="variant-card-edit"
                    rows={4}
                    value={draftSummary}
                    onChange={(e) => setDraftSummary(e.target.value)}
                    placeholder="Rewrite this variant's tagline / summary."
                  />
                  <div className="variant-card-edit-actions">
                    <button type="button" className="btn btn--sm btn--ghost"
                      onClick={() => { setEditing(null); setDraftSummary(''); }}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn--sm btn--primary"
                      disabled={isStreaming || !draftSummary.trim()}
                      onClick={onSaveEdit}>
                      Save
                    </button>
                  </div>
                </>
              ) : (
                <>
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
                  <div className="variant-card-buttons">
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      disabled={isStreaming || isLocked}
                      onClick={() => onStartEdit(v)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`btn btn--sm btn--block ${isPicked ? 'btn--ghost' : 'btn--primary'}`}
                      disabled={isStreaming || isLocked}
                      onClick={() => onSelect(v.type)}
                    >
                      {isPicked ? 'Selected' : <>Use this <IconArrowRight size={14} /></>}
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      {!isLocked && (
        <div className="variant-regenerate">
          <input
            type="text"
            className="variant-regenerate-input"
            placeholder="Optional refinement (e.g. 'make Hybrid more senior-leaning')"
            value={refinement}
            onChange={(e) => setRefinement(e.target.value)}
            disabled={isStreaming}
          />
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            disabled={isStreaming}
            onClick={onRegenerate}
          >
            Regenerate variants
          </button>
        </div>
      )}
    </AgentBlockShell>
  );
}
