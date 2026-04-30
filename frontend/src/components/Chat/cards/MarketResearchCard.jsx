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
        setDismissSummary(`Added ${selectedSkills.length} market skill${selectedSkills.length > 1 ? 's' : ''} ✅`);
        setIsDismissed(true);
        sendMessage({ action: 'accept_market', action_data: { skills: selectedSkills } });
        dismissMarketCard();
    };

    const handleAcceptAll = () => {
        const allSkills = (skills || []).map(s => s.skill);
        setDismissSummary(`Added all ${allSkills.length} market skills ✅`);
        setIsDismissed(true);
        sendMessage({ action: 'accept_market', action_data: { skills: allSkills } });
        dismissMarketCard();
    };

    const handleSkip = () => {
        setDismissSummary('Skipped →');
        setIsDismissed(true);
        sendMessage({ action: 'skip_market' });
        dismissMarketCard();
    };

    // Compact read-only after action — persists in view (#7)
    if (isDismissed) {
        return (
            <div className="chat-card mb-3" style={{ padding: 'var(--space-3)', opacity: 0.65 }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    🌐 Market Research — {dismissSummary}
                </span>
            </div>
        );
    }

    // Empty state placeholder — do NOT show competitor names (#8)
    if (!skills || skills.length === 0) {
        return (
            <div className="chat-card mb-3">
                <div className="chat-card-header">🌐 Market Research</div>
                <div className="skill-chips-empty">
                    {competitors?.length > 0
                        ? 'Market analysis found no additional skills to suggest beyond your current requirements.'
                        : 'Market data unavailable right now. This section is skipped — your JD will be based on your requirements.'}
                </div>
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

            {/* Summary (if any) — competitors intentionally hidden */}
            {summary && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    {summary}
                </p>
            )}

            <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                Skills the market emphasises that aren't in your current JD — click to add:
            </p>

            <div className="skill-chips">
                {skills.map((s, i) => (
                    <span
                        key={i}
                        className={`skill-chip ${selectedSkills.includes(s.skill) ? 'selected' : ''}`}
                        onClick={() => toggleSkill(s.skill)}
                        title={s.context || ''}
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

export default MarketResearchCard;
