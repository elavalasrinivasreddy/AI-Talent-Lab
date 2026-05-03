import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';

const BiasCheckCard = ({ data }) => {
    const { finalJdMarkdown, setFinalJdMarkdown, sendMessage } = useChat();
    const [isDismissed, setIsDismissed] = useState(false);
    const [fixedIssues, setFixedIssues] = useState(new Set());
    const { issues, clean } = data;

    const handleFix = (issue) => {
        if (!finalJdMarkdown) return;
        const updated = finalJdMarkdown.replace(issue.phrase, issue.suggestion);
        setFinalJdMarkdown(updated);
        setFixedIssues(prev => new Set([...prev, issue.phrase]));
    };

    const handleFixAll = () => {
        if (!finalJdMarkdown) return;
        let updated = finalJdMarkdown;
        for (const issue of issues) {
            updated = updated.replace(issue.phrase, issue.suggestion);
        }
        setFinalJdMarkdown(updated);
        setFixedIssues(new Set(issues.map(i => i.phrase)));
    };

    const handleApplyAndFinish = () => {
        sendMessage({
            action: 'finalize_jd',
            action_data: { content: finalJdMarkdown }
        });
        setIsDismissed(true);
    };

    const handleDismiss = () => {
        setIsDismissed(true);
    };

    if (isDismissed) {
        return (
            <div className="chat-card mb-3" style={{ opacity: 0.7, padding: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    🔍 Bias Check — {fixedIssues.size > 0 ? `Fixed ${fixedIssues.size} issue(s) ✅` : 'Dismissed'}
                </span>
            </div>
        );
    }

    if (clean || !issues || issues.length === 0) {
        return (
            <div className="chat-card mb-3" style={{ border: '1px solid var(--color-success)', background: 'var(--color-success-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: '1.5rem' }}>🛡️</span>
                    <div>
                        <strong style={{ color: 'var(--color-success)' }}>Inclusivity Check Passed</strong>
                        <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 0, marginTop: 4, color: 'var(--color-text-secondary)' }}>
                            No exclusionary or biased language detected. Your JD is ready to post.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-card mb-3" style={{ border: '1px solid var(--color-warning)' }}>
            <div className="chat-card-header" style={{ color: 'var(--color-warning)' }}>
                ⚠️ Inclusivity Suggestions
            </div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                Found {issues.length} potentially problematic phrase{issues.length > 1 ? 's' : ''}:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                {issues.map((issue, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--radius-sm)',
                            background: fixedIssues.has(issue.phrase) ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)',
                            border: `1px solid ${fixedIssues.has(issue.phrase) ? 'var(--color-success)' : 'var(--color-border)'}`,
                            opacity: fixedIssues.has(issue.phrase) ? 0.6 : 1
                        }}
                    >
                        <div style={{ fontSize: 'var(--font-size-sm)' }}>
                            <del style={{ color: 'var(--color-danger)' }}>{issue.phrase}</del>
                            <span style={{ margin: '0 var(--space-2)', color: 'var(--color-text-muted)' }}>→</span>
                            <strong style={{ color: 'var(--color-success)' }}>{issue.suggestion}</strong>
                            {issue.category && (
                                <span style={{
                                    marginLeft: 'var(--space-2)',
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--color-text-muted)',
                                    padding: '1px 6px',
                                    background: 'var(--color-bg-tertiary)',
                                    borderRadius: 'var(--radius-full)'
                                }}>
                                    {issue.category.replace('_', ' ')}
                                </span>
                            )}
                        </div>
                        {!fixedIssues.has(issue.phrase) && (
                            <button
                                className="btn btn-sm"
                                style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', padding: '2px 8px' }}
                                onClick={() => handleFix(issue)}
                            >
                                Fix
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                    className="btn btn-sm"
                    style={{ background: 'var(--color-primary)', color: '#fff', flex: 1 }}
                    onClick={handleApplyAndFinish}
                >
                    Apply Changes & Return
                </button>
                <button
                    className="btn btn-sm"
                    style={{ border: '1px solid var(--color-border)', flex: 1 }}
                    onClick={handleFixAll}
                >
                    Fix All Suggestions
                </button>
                <button
                    className="btn btn-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                    onClick={handleDismiss}
                >
                    Skip
                </button>
            </div>
        </div>
    );
};

export default BiasCheckCard;
