import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../../context/ChatContext';

const VARIANT_COLORS = {
    skill_focused: { accent: '#3b82f6', bg: '#3b82f615', label: '🔧 Skill-Focused' },
    outcome_focused: { accent: '#22c55e', bg: '#22c55e15', label: '🎯 Outcome-Focused' },
    hybrid: { accent: '#a855f7', bg: '#a855f715', label: '⚡ Hybrid' }
};

/**
 * stripBoilerplate – removes "About Our Organization/Team" and the role title
 * header from variant content since those are common and redundant across all 3.
 */
function stripBoilerplate(content) {
    if (!content) return '';
    // Remove "# <Role Title>" header (first h1)
    let cleaned = content.replace(/^#\s+.+\n*/m, '');
    // Remove "## About Our Organization/Team/Company" section entirely
    cleaned = cleaned.replace(
        /##\s*About\s+(Our\s+)?(Organization|Team|Company)[\s\S]*?(?=\n##\s|\n#\s|$)/gi,
        ''
    );
    return cleaned.trim();
}

const JDVariantsCard = ({ data }) => {
    const { sendMessage, workflowStage } = useChat();
    const { variants, selected } = data;
    
    const isHistory = workflowStage && workflowStage !== 'jd_variants' && workflowStage !== 'market_research' && workflowStage !== 'internal_check' && workflowStage !== 'intake';
    
    const [editingVariant, setEditingVariant] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [isDismissed, setIsDismissed] = useState(isHistory);
    const [selectedType, setSelectedType] = useState(isHistory ? selected : '');

    const handleSelect = (variantType) => {
        if (isDismissed || isHistory) return;
        setSelectedType(variantType);
        setIsDismissed(true);
        sendMessage({
            action: 'select_variant',
            action_data: { variant_type: variantType }
        });
    };

    const handleStartEdit = (variant) => {
        if (isDismissed) return;
        setEditingVariant(variant.type);
        setEditContent(variant.content);
    };

    const handleSaveEdit = (variant) => {
        variant.content = editContent;
        setEditingVariant(null);
    };

    if (!variants || variants.length === 0) return null;

    return (
        <div className="stage-card" style={{ maxWidth: '100%', width: '100%' }}>
            <div className="stage-card-header">
                <span className="stage-card-icon">📋</span>
                <span>Choose Your JD Style</span>
            </div>
            <p className="stage-card-desc">
                {isDismissed
                    ? `You selected the ${VARIANT_COLORS[selectedType]?.label || selectedType} variant.`
                    : "Pick the style that fits best. Double-click content to edit before selecting."}
            </p>

            <div className="variants-grid">
                {variants.map((v, i) => {
                    const colors = VARIANT_COLORS[v.type] || VARIANT_COLORS.hybrid;
                    const isSelected = selectedType === v.type;
                    const isDisabled = isDismissed && !isSelected;
                    const cleanContent = stripBoilerplate(v.content);

                    return (
                        <div key={i} className={`variant-card ${isSelected ? 'variant-card--selected' : ''} ${isDisabled ? 'variant-card--disabled' : ''}`}
                            style={{ borderTopColor: colors.accent }}
                        >
                            <div className="variant-card-head">
                                <h6 className="variant-card-label" style={{ color: colors.accent }}>
                                    {colors.label}
                                </h6>
                                {isSelected && <span className="variant-selected-badge" style={{ color: colors.accent }}>SELECTED</span>}
                            </div>

                            {v.summary && (
                                <p className="variant-card-summary">{v.summary}</p>
                            )}

                            {/* Scrollable Content Area */}
                            <div
                                className="variant-card-content"
                                onDoubleClick={() => !isDismissed && handleStartEdit(v)}
                            >
                                {editingVariant === v.type ? (
                                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        <textarea
                                            autoFocus
                                            className="variant-edit-textarea"
                                            value={editContent}
                                            onChange={e => setEditContent(e.target.value)}
                                        />
                                        <div className="variant-edit-actions">
                                            <button className="stage-btn stage-btn--primary stage-btn--sm" onClick={() => handleSaveEdit(v)}>
                                                Save
                                            </button>
                                            <button className="stage-btn stage-btn--ghost stage-btn--sm" onClick={() => setEditingVariant(null)}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <ReactMarkdown>{cleanContent}</ReactMarkdown>
                                )}
                            </div>

                            {/* Skills at bottom */}
                            {v.skills && v.skills.length > 0 && (
                                <div className="variant-card-skills">
                                    <div className="variant-skills-label">Required ({v.skills_count || v.skills.length})</div>
                                    <div className="variant-skills-list">
                                        {v.skills.map((skill, si) => (
                                            <span key={si} className="variant-skill-tag" style={{ background: colors.bg, color: colors.accent }}>
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!isDismissed && (
                                <button
                                    className="variant-select-btn"
                                    style={{ background: colors.accent }}
                                    onClick={() => handleSelect(v.type)}
                                >
                                    Choose This Style
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default JDVariantsCard;
