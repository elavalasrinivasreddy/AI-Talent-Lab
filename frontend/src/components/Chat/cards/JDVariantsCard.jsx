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
        setSelectedType(variantType);
        setIsDismissed(true);
        sendMessage({
            action: 'select_variant',
            action_data: { variant_type: variantType }
        });
        dismissVariantsCard();
    };

    const handleStartEdit = (variant) => {
        setEditingVariant(variant.type);
        setEditContent(variant.content);
    };

    const handleSaveEdit = (variant) => {
        variant.content = editContent;
        setEditingVariant(null);
    };

    // Collapsed state after selection
    if (isDismissed) {
        const label = VARIANT_COLORS[selectedType]?.label || selectedType;
        return (
            <div className="chat-card mb-3" style={{ opacity: 0.7, padding: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    📋 Selected: {label} variant ✅
                </span>
            </div>
        );
    }

    if (!variants || variants.length === 0) return null;

    return (
        <div className="chat-card mb-3">
            <div className="chat-card-header">📋 Choose Your JD Style</div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                Based on everything we've gathered, here are 3 JD styles. Read through them and pick the one that fits — you can edit any before selecting.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-3)', overflowX: 'auto', paddingBottom: 'var(--space-2)' }}>
                {variants.map((v, i) => {
                    const colors = VARIANT_COLORS[v.type] || VARIANT_COLORS.hybrid;
                    return (
                        <div key={i} style={{
                            flex: '1 1 0',
                            minWidth: 220,
                            background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border)',
                            borderTop: `3px solid ${colors.accent}`,
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-4)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <h6 style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-2)' }}>
                                {colors.label}
                            </h6>
                            <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-full)',
                                    background: colors.bg,
                                    color: colors.accent
                                }}>
                                    {v.tone} Tone
                                </span>
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-full)',
                                    background: 'var(--color-bg-tertiary)',
                                    color: 'var(--color-text-secondary)'
                                }}>
                                    {v.skills_count} Skills
                                </span>
                            </div>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', flex: 1, marginBottom: 'var(--space-3)' }}>
                                {v.summary}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button
                                        className="btn btn-sm"
                                        style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', padding: 0 }}
                                        onClick={() => setPreviewVariant(previewVariant === v.type ? null : v.type)}
                                    >
                                        {previewVariant === v.type ? 'Hide ▴' : 'Preview ▾'}
                                    </button>
                                    <button
                                        className="btn btn-sm"
                                        style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', padding: 0 }}
                                        onClick={() => handleStartEdit(v)}
                                    >
                                        ✏️ Edit
                                    </button>
                                </div>
                                <button
                                    className="btn btn-sm"
                                    style={{ background: colors.accent, color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', padding: '4px 12px' }}
                                    onClick={() => handleSelect(v.type)}
                                >
                                    Select This →
                                </button>
                            </div>

                            {/* Inline Preview */}
                            {previewVariant === v.type && (
                                <div style={{
                                    marginTop: 'var(--space-3)',
                                    padding: 'var(--space-3)',
                                    background: 'var(--color-bg-secondary)',
                                    borderRadius: 'var(--radius-sm)',
                                    maxHeight: 300,
                                    overflowY: 'auto',
                                    fontSize: 'var(--font-size-sm)'
                                }}>
                                    <ReactMarkdown>{v.content}</ReactMarkdown>
                                </div>
                            )}

                            {/* Inline Edit */}
                            {editingVariant === v.type && (
                                <div style={{ marginTop: 'var(--space-3)' }}>
                                    <textarea
                                        style={{
                                            width: '100%',
                                            minHeight: 200,
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: 'var(--font-size-sm)',
                                            background: 'var(--color-bg-input)',
                                            border: '1px solid var(--color-border-focus)',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: 'var(--space-2)',
                                            color: 'var(--color-text-primary)'
                                        }}
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                                        <button className="btn btn-sm" style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-md)' }} onClick={() => handleSaveEdit(v)}>Done</button>
                                        <button className="btn btn-sm" style={{ color: 'var(--color-text-secondary)' }} onClick={() => setEditingVariant(null)}>Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default JDVariantsCard;
