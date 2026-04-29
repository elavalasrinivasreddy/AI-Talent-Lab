import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';

const MarketResearchCard = ({ data }) => {
    const { sendMessage, dismissMarketCard } = useChat();
    const { skills, competitors, summary } = data;

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
            action: 'accept_market',
            action_data: { skills: selectedSkills }
        });
        dismissMarketCard();
    };

    const handleAcceptAll = () => {
        const allSkills = (skills || []).map(s => s.skill);
        setDismissSummary(`Added: ${allSkills.join(', ')} ✅`);
        setIsDismissed(true);
        sendMessage({
            action: 'accept_market',
            action_data: { skills: allSkills }
        });
        dismissMarketCard();
    };

    const handleSkip = () => {
        setDismissSummary('Skipped market research →');
        setIsDismissed(true);
        sendMessage({ action: 'skip_market' });
        dismissMarketCard();
    };

    // Collapsed read-only state after action
    if (isDismissed) {
        return (
            <div className="chat-card mb-3" style={{ opacity: 0.7, padding: 'var(--space-3)' }}>
                <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        🌐 Market Research — {dismissSummary}
                    </span>
                </div>
            </div>
        );
    }

    if (!skills || skills.length === 0) {
        return (
            <div className="chat-card mb-3">
                <div className="chat-card-header">🌐 Market Research</div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    Market research unavailable right now. Continuing with what we have.
                </p>
                <div className="card-actions">
                    <button
                        className="btn btn-sm"
                        style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-md)' }}
                        onClick={handleSkip}
                    >
                        Continue →
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-card mb-3">
            <div className="chat-card-header">🌐 Market Research</div>

            {competitors && competitors.length > 0 && (
                <div style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
                    <strong>Analyzed: </strong>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{competitors.join(' · ')}</span>
                </div>
            )}

            {summary && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>{summary}</p>
            )}

            <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                Skills they emphasize that aren't in your current JD:
            </p>

            <div className="skill-chips">
                {skills.map((s, i) => (
                    <span
                        key={i}
                        className={`skill-chip ${selectedSkills.includes(s.skill) ? 'selected' : ''}`}
                        onClick={() => toggleSkill(s.skill)}
                        title={s.context || ''}
                    >
                        {selectedSkills.includes(s.skill) ? '✅ ' : '☐ '}
                        {s.skill}
                        {s.source && (
                            <small style={{ opacity: 0.6, marginLeft: 4 }}>
                                ← {s.source}{s.frequency ? ` (${s.frequency} of ${competitors?.length || '?'})` : ''}
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

export default MarketResearchCard;
