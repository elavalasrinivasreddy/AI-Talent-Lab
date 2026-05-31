import React, { useState, useEffect } from 'react';
import { useChat } from '../../../context/ChatContext';
import { IconCheck, IconArrowRight } from '../icons';

const VARIANT_META = {
    skill_focused:   { label: 'Skill-Focused',   marker: '#3B82F6', hint: 'Lists exact technologies and seniority bands.' },
    outcome_focused: { label: 'Outcome-Focused', marker: '#10B981', hint: 'Frames what the role delivers, not what it knows.' },
    hybrid:          { label: 'Hybrid',          marker: '#0D9488', hint: 'Balanced — outcomes anchored to required skills.' },
};

/**
 * JDVariantsCard — 3 variant summaries in the left rail.
 * Body is in the rail; hovering a variant previews it in the right canvas
 * via the lifted previewVariantType state passed from ChatPage.
 */
const JDVariantsCard = ({ data, previewVariantType, setPreviewVariantType }) => {
    const { sendMessage, workflowStage } = useChat();
    const { variants, selected } = data;

    const isHistory =
        workflowStage &&
        workflowStage !== 'jd_variants' &&
        workflowStage !== 'market_research' &&
        workflowStage !== 'internal_check' &&
        workflowStage !== 'intake';

    const [isDismissed, setIsDismissed] = useState(isHistory);
    const [selectedType, setSelectedType] = useState(isHistory ? selected : '');

    // Default preview = first variant on mount, so canvas isn't empty.
    // ChatPage clears previewVariantType on session change, so no cleanup needed.
    useEffect(() => {
        if (!previewVariantType && variants?.length && !isDismissed) {
            setPreviewVariantType(variants[0].type);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSelect = (variantType) => {
        if (isDismissed) return;
        setSelectedType(variantType);
        setPreviewVariantType(variantType);
        setIsDismissed(true);
        sendMessage({
            action: 'select_variant',
            action_data: { variant_type: variantType },
        });
    };

    if (!variants || variants.length === 0) return null;

    return (
        <div className="stage-card" data-dismissed={isDismissed}>
            <div className="stage-card-head">
                <span className="stage-card-eyebrow">Step 4 · Choose a style</span>
                {isDismissed && selectedType && (
                    <span className="stage-card-status stage-card-status--ok">
                        <IconCheck size={12} /> {VARIANT_META[selectedType]?.label || selectedType} selected
                    </span>
                )}
            </div>
            <h3 className="stage-card-title">Three drafts. Pick the one that fits this hire.</h3>
            <p className="stage-card-desc">
                Hover to preview on the right. Click to lock it in and generate the final JD.
            </p>

            <div className="variants">
                {variants.map((v) => {
                    const meta = VARIANT_META[v.type] || { label: v.type, marker: '#0D9488', hint: '' };
                    const isSelected =
                        (previewVariantType === v.type && !isDismissed) ||
                        (isDismissed && selectedType === v.type);
                    const isDisabled = isDismissed && selectedType !== v.type;

                    return (
                        <div
                            key={v.type}
                            className="variant"
                            aria-selected={isSelected}
                            data-disabled={isDisabled}
                            onMouseEnter={() => !isDismissed && setPreviewVariantType(v.type)}
                            onFocus={() => !isDismissed && setPreviewVariantType(v.type)}
                            onClick={() => handleSelect(v.type)}
                            role="button"
                            tabIndex={isDismissed ? -1 : 0}
                            onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && !isDismissed) {
                                    e.preventDefault();
                                    handleSelect(v.type);
                                }
                            }}
                            style={{ '--marker': meta.marker }}
                        >
                            <div className="variant-head">
                                <h4 className="variant-label">
                                    <span className="variant-label-marker" />
                                    {meta.label}
                                </h4>
                                {v.skills_count && (
                                    <span className="variant-skill">{v.skills_count} skills</span>
                                )}
                            </div>
                            <p className="variant-summary">{v.summary || meta.hint}</p>
                            {v.preview_impact && (
                                <div className="variant-impact" style={{ fontSize: '13px', color: '#64748b', marginTop: '8px', padding: '8px', backgroundColor: 'var(--surface-50)', borderRadius: '6px' }}>
                                    <strong>Impact:</strong> {v.preview_impact}
                                </div>
                            )}
                            {v.skills && v.skills.length > 0 && (
                                <div className="variant-skills">
                                    {v.skills.slice(0, 6).map((skill, si) => (
                                        <span key={si} className="variant-skill">{skill}</span>
                                    ))}
                                    {v.skills.length > 6 && (
                                        <span className="variant-skill">+{v.skills.length - 6}</span>
                                    )}
                                </div>
                            )}
                            <div className="variant-action">
                                {isSelected ? 'Selected' : 'Choose'} <IconArrowRight size={12} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default JDVariantsCard;
