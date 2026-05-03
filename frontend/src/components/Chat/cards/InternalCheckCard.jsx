import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';

const InternalCheckCard = ({ skills }) => {
    const { sendMessage } = useChat();
    const [selectedSkills, setSelectedSkills] = useState([]); // Default to empty as per user request
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
        setDismissSummary(`Added ${selectedSkills.length} skill${selectedSkills.length > 1 ? 's' : ''} ✅`);
        setIsDismissed(true);
        sendMessage({ action: 'accept_internal', action_data: { skills: selectedSkills } });
    };

    const handleAcceptAll = () => {
        const allSkills = skills.map(s => s.skill);
        setDismissSummary(`Added all ${allSkills.length} skills ✅`);
        setIsDismissed(true);
        sendMessage({ action: 'accept_internal', action_data: { skills: allSkills } });
    };

    const handleSkip = () => {
        setDismissSummary('Skipped →');
        setIsDismissed(true);
        sendMessage({ action: 'skip_internal' });
    };

    // Compact read-only after action (persists in chat view — #7)
    if (isDismissed) {
        return (
            <div className="chat-card mb-3" style={{ padding: 'var(--space-3)', opacity: 0.65 }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    📊 Internal Skills Check — {dismissSummary}
                </span>
            </div>
        );
    }

    // Empty state placeholder (#8)
    if (!skills || skills.length === 0) {
        return (
            <div className="chat-card mb-3">
                <div className="chat-card-header">📊 Internal Skills Check</div>
                <div className="skill-chips-empty">
                    No similar past roles found in your org yet. This section is skipped — continuing with market research.
                </div>
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
            <div className="chat-card-header">📊 Internal Skills Check</div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                Found in similar past roles — not in your current requirements. Click to select:
            </p>

            <div className="skill-chips">
                {skills.map((s, i) => (
                    <span
                        key={i}
                        className={`skill-chip ${selectedSkills.includes(s.skill) ? 'selected' : ''}`}
                        onClick={() => toggleSkill(s.skill)}
                        title={s.source ? `From: ${s.source}${s.year ? ` (${s.year})` : ''}` : ''}
                    >
                        {s.skill}
                    </span>
                ))}
            </div>

            <div className="card-actions">
                <button
                    className="btn btn-sm"
                    style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-secondary)' }}
                    onClick={handleSkip}
                >
                    Skip
                </button>
                <button
                    className="btn btn-sm"
                    style={{ border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-md)', color: 'var(--color-primary)' }}
                    onClick={handleAcceptAll}
                >
                    Add All ({skills.length})
                </button>
                <button
                    className="btn btn-sm"
                    style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-md)' }}
                    onClick={handleAcceptSelected}
                    disabled={selectedSkills.length === 0}
                >
                    Add Selected ({selectedSkills.length})
                </button>
            </div>
        </div>
    );
};

export default InternalCheckCard;
