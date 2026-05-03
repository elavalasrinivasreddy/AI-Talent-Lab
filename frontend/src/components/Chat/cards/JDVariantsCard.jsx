import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../../context/ChatContext';

const VARIANT_COLORS = {
    skill_focused: { accent: '#3b82f6', bg: '#3b82f615', label: '🔧 Skill-Focused' },
    outcome_focused: { accent: '#22c55e', bg: '#22c55e15', label: '🎯 Outcome-Focused' },
    hybrid: { accent: '#a855f7', bg: '#a855f715', label: '⚡ Hybrid' }
};

const JDVariantsCard = ({ variants }) => {
    const { sendMessage, dismissVariantsCard } = useChat();
    const [previewVariant, setPreviewVariant] = useState(null);
    const [editingVariant, setEditingVariant] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [isDismissed, setIsDismissed] = useState(false);
    const [selectedType, setSelectedType] = useState('');

    const handleSelect = (variantType) => {
        if (isDismissed) return; // Prevent changing selection
        setSelectedType(variantType);
        setIsDismissed(true);
        sendMessage({
            action: 'select_variant',
            action_data: { variant_type: variantType }
        });
        // We don't call dismissVariantsCard() here because user wants it to stay visible
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
        <div className="chat-card mb-3" style={{ maxWidth: '100%', width: '100%' }}>
            <div className="chat-card-header">📋 Choose Your JD Style</div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                {isDismissed 
                    ? `You selected the ${VARIANT_COLORS[selectedType]?.label || selectedType} variant.`
                    : "Pick the style that fits best. You can double-click content to edit before selecting."}
            </p>

            <div style={{ 
                display: 'flex', 
                gap: 'var(--space-3)', 
                overflowX: 'auto', 
                paddingBottom: 'var(--space-2)',
                alignItems: 'stretch'
            }}>
                {variants.map((v, i) => {
                    const colors = VARIANT_COLORS[v.type] || VARIANT_COLORS.hybrid;
                    const isSelected = selectedType === v.type;
                    const isDisabled = isDismissed && !isSelected;

                    return (
                        <div key={i} style={{
                            flex: '1 0 300px',
                            background: isSelected ? 'var(--color-bg-secondary)' : 'var(--color-bg-card)',
                            border: isSelected ? `2px solid ${colors.accent}` : '1px solid var(--color-border)',
                            borderTop: `6px solid ${colors.accent}`,
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-4)',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: isSelected ? '0 8px 24px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s ease',
                            opacity: isDisabled ? 0.5 : 1,
                            pointerEvents: isDismissed ? 'none' : 'auto',
                            minHeight: '500px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                <h6 style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', margin: 0 }}>
                                    {colors.label}
                                </h6>
                                {isSelected && <span style={{ color: colors.accent, fontWeight: 700 }}>SELECTED</span>}
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', fontWeight: 500 }}>
                                    {v.summary}
                                </p>

                                {/* Scrollable Content Area */}
                                <div 
                                    onDoubleClick={() => !isDismissed && handleStartEdit(v)}
                                    style={{ 
                                        flex: 1,
                                        maxHeight: '300px',
                                        overflowY: 'auto',
                                        padding: 'var(--space-3)',
                                        background: 'var(--color-bg-secondary)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-sm)',
                                        lineHeight: 1.6,
                                        marginBottom: 'var(--space-3)',
                                        border: '1px solid var(--color-border-light)',
                                        cursor: isDismissed ? 'default' : 'text'
                                    }}
                                >
                                    {editingVariant === v.type ? (
                                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                            <textarea
                                                autoFocus
                                                style={{
                                                    width: '100%',
                                                    minHeight: '200px',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    outline: 'none',
                                                    color: 'inherit',
                                                    fontFamily: 'inherit',
                                                    resize: 'none',
                                                    lineHeight: 1.6
                                                }}
                                                value={editContent}
                                                onChange={e => setEditContent(e.target.value)}
                                            />
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <button 
                                                    className="btn btn-sm" 
                                                    style={{ flex: 1, background: 'var(--color-primary)', color: '#fff' }}
                                                    onClick={() => handleSaveEdit(v)}
                                                >
                                                    Save
                                                </button>
                                                <button 
                                                    className="btn btn-sm btn-outline" 
                                                    style={{ flex: 1 }}
                                                    onClick={() => setEditingVariant(null)}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <ReactMarkdown>{v.content}</ReactMarkdown>
                                    )}
                                </div>

                                {/* Skills at bottom */}
                                <div style={{ marginTop: 'auto' }}>
                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
                                        Required Skills ({v.skills_count})
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {(v.skills || []).map((skill, si) => (
                                            <span key={si} style={{
                                                fontSize: '10px',
                                                padding: '2px 6px',
                                                background: colors.bg,
                                                color: colors.accent,
                                                borderRadius: 'var(--radius-sm)',
                                                fontWeight: 600
                                            }}>
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {!isDismissed && (
                                <button
                                    className="btn"
                                    style={{ 
                                        background: colors.accent, 
                                        color: '#fff', 
                                        width: '100%', 
                                        fontWeight: 700,
                                        marginTop: 'var(--space-4)',
                                        padding: '12px'
                                    }}
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
