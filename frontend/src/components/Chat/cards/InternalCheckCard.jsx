import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';

const InternalCheckCard = ({ skills }) => {
    const { sendMessage, dismissInternalCard } = useChat();
    const [selectedSkills, setSelectedSkills] = useState(
        (skills || []).filter(s => s.selected !== false).map(s => s.skill)
    );
    const [isDismissed, setIsDismissed] = useState(false);
    const [dismissSummary, setDismissSummary] = useState('');

    const toggleSkill = (skillName) => {
        setSelectedSkills(prev =>
            prev.includes(skillName)
                ? prev.filter(s => s !== skillName)
                : [...prev, skillName]
        );
    };

    const handleAcceptSelected = () => {
        if (selectedSkills.length === 0) return;
        setDismissSummary(`Added: ${selectedSkills.join(', ')} ✅`);
        setIsDismissed(true);
        sendMessage({
            action: 'accept_internal',
            action_data: { skills: selectedSkills }
        });
        dismissInternalCard();
    };

    const handleAcceptAll = () => {
        const allSkills = skills.map(s => s.skill);
        setDismissSummary(`Added: ${allSkills.join(', ')} ✅`);
        setIsDismissed(true);
        sendMessage({
            action: 'accept_internal',
            action_data: { skills: allSkills }
        });
        dismissInternalCard();
    };

    const handleSkip = () => {
        setDismissSummary('Skipped internal check →');
        setIsDismissed(true);
        sendMessage({ action: 'skip_internal' });
        dismissInternalCard();
    };

    // Collapsed read-only state after action
    if (isDismissed) {
        return (
            <div className="chat-card mb-3" style={{ opacity: 0.7, padding: 'var(--space-3)' }}>
                <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        📊 Internal Check — {dismissSummary}
                    </span>
                </div>
            </div>
        );
    }

    if (!skills || skills.length === 0) {
        return (
            <div className="chat-card mb-3">
                <div className="chat-card-header">
                    📊 Internal Skills Check
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    No similar past roles found in your organization yet. Moving to market research...
                </p>
                <div className="card-actions">
                    <button className="btn btn-sm" style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-md)' }} onClick={handleSkip}>
                        Continue →
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-card mb-3">
            <div className="chat-card-header">
                📊 Internal Skills Check
            </div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                Found these skills in similar past roles that aren't in your current requirements:
            </p>

            <div className="skill-chips">
                {skills.map((s, i) => (
                    <span
                        key={i}
                        className={`skill-chip ${selectedSkills.includes(s.skill) ? 'selected' : ''}`}
                        onClick={() => toggleSkill(s.skill)}
                    >
                        {selectedSkills.includes(s.skill) ? '✅ ' : '☐ '}
                        {s.skill}
                        {s.source && (
                            <small style={{ opacity: 0.6, marginLeft: 4 }}>
                                ← {s.source}{s.year ? ` (${s.year})` : ''}
                            </small>
                        )}
                    </span>
                ))}
            </div>

            <div className="card-actions">
                <button
                    className="btn btn-sm"
                    style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-secondary)' }}
                    onClick={handleSkip}
                >
                    Skip →
                </button>
                <button
                    className="btn btn-sm"
                    style={{ border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-md)', color: 'var(--color-primary)' }}
                    onClick={handleAcceptAll}
                >
                    Accept All ({skills.length})
                </button>
                <button
                    className="btn btn-sm"
                    style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-md)' }}
                    onClick={handleAcceptSelected}
                    disabled={selectedSkills.length === 0}
                >
                    Accept Selected ({selectedSkills.length})
                </button>
            </div>
        </div>
    );
};

export default InternalCheckCard;
