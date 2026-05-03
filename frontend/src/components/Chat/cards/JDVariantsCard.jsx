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
        <div className="chat-card mb-3" style={{ maxWidth: '100%', width: '900px' }}>
            <div className="chat-card-header">📋 Choose Your JD Style</div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                Based on everything we've gathered, here are 3 JD styles. Read through them and pick the one that fits — you can edit any before selecting.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-3)', overflowX: 'auto', paddingBottom: 'var(--space-2)' }}>
                {variants.map((v, i) => {
                    const colors = VARIANT_COLORS[v.type] || VARIANT_COLORS.hybrid;
                    return (
                        <div key={i} style={{
                            flex: '1 0 280px',
                            background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border)',
                            borderTop: `4px solid ${colors.accent}`,
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-4)',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            transition: 'transform 0.2s ease',
                            cursor: 'default'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                <h6 style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', margin: 0 }}>
                                    {colors.label}
                                </h6>
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    padding: '2px 10px',
                                    borderRadius: 'var(--radius-full)',
                                    background: colors.bg,
                                    color: colors.accent,
                                    fontWeight: 600
                                }}>
                                    {v.tone}
                                </span>
                            </div>

                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                                    {v.summary}
                                </p>

                                {/* Skills Section */}
                                <div style={{ marginBottom: 'var(--space-4)' }}>
                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Key Skills ({v.skills_count})
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                                        {/* Fallback if skills array isn't present yet */}
                                        {(v.skills || []).slice(0, 8).map((skill, si) => (
                                            <span key={si} style={{
                                                fontSize: '11px',
                                                padding: '2px 8px',
                                                background: 'var(--color-bg-secondary)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 'var(--radius-sm)',
                                                color: 'var(--color-text-primary)'
                                            }}>
                                                {skill}
                                            </span>
                                        ))}
                                        {v.skills_count > 8 && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', alignSelf: 'center' }}>+{v.skills_count - 8} more</span>}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button
                                        className="btn btn-sm btn-outline"
                                        style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}
                                        onClick={() => setPreviewVariant(previewVariant === v.type ? null : v.type)}
                                    >
                                        {previewVariant === v.type ? 'Hide Details' : 'Preview Full'}
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline"
                                        style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}
                                        onClick={() => handleStartEdit(v)}
                                    >
                                        ✏️ Edit
                                    </button>
                                </div>
                                <button
                                    className="btn"
                                    style={{ background: colors.accent, color: '#fff', width: '100%', fontWeight: 600 }}
                                    onClick={() => handleSelect(v.type)}
                                >
                                    Select & Continue
                                </button>
                            </div>

                            {/* Full Preview Modal/Overlay logic or large expanded view */}
                            {previewVariant === v.type && (
                                <div style={{
                                    marginTop: 'var(--space-3)',
                                    padding: 'var(--space-4)',
                                    background: 'var(--color-bg-secondary)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    maxHeight: 400,
                                    overflowY: 'auto',
                                    fontSize: 'var(--font-size-sm)',
                                    lineHeight: 1.6,
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ marginBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-border)', pb: 'var(--space-2)', display: 'flex', justifyContent: 'space-between' }}>
                                        <strong>Full Preview</strong>
                                        <button className="btn-close" onClick={() => setPreviewVariant(null)} />
                                    </div>
                                    <ReactMarkdown>{v.content}</ReactMarkdown>
                                </div>
                            )}

                            {/* Large Edit Area */}
                            {editingVariant === v.type && (
                                <div style={{
                                    marginTop: 'var(--space-3)',
                                    padding: 'var(--space-3)',
                                    background: 'var(--color-bg-card)',
                                    border: '1px solid var(--color-primary)',
                                    borderRadius: 'var(--radius-md)',
                                    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.1)'
                                }}>
                                    <textarea
                                        style={{
                                            width: '100%',
                                            minHeight: 300,
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: 'var(--font-size-sm)',
                                            background: 'var(--color-bg-input)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: 'var(--space-3)',
                                            color: 'var(--color-text-primary)',
                                            resize: 'vertical'
                                        }}
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                    />
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                                        <button className="btn" style={{ background: 'var(--color-primary)', color: '#fff', flex: 1 }} onClick={() => handleSaveEdit(v)}>Save Changes</button>
                                        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditingVariant(null)}>Discard</button>
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
