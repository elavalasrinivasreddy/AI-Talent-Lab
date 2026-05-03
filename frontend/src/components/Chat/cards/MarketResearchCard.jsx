import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';

const MarketResearchCard = ({ data }) => {
    const { sendMessage } = useChat();
    const { skills, competitors, summary } = data;

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
        setDismissSummary(`Added ${selectedSkills.length} market skill${selectedSkills.length > 1 ? 's' : ''} ✅`);
        setIsDismissed(true);
        sendMessage({ action: 'accept_market', action_data: { skills: selectedSkills } });
    };

    const handleAcceptAll = () => {
        const allSkills = (skills || []).map(s => s.skill);
        setDismissSummary(`Added all ${allSkills.length} market skills ✅`);
        setIsDismissed(true);
        sendMessage({ action: 'accept_market', action_data: { skills: allSkills } });
    };

    const handleSkip = () => {
        setDismissSummary('Skipped →');
        setIsDismissed(true);
        sendMessage({ action: 'skip_market' });
    };

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
        <div className="chat-card mb-3" style={{ opacity: isDismissed ? 0.7 : 1 }}>
            <div className="chat-card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🌐 Market Research</span>
                {isDismissed && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', fontWeight: 600 }}>{dismissSummary}</span>}
            </div>

            {/* Summary (if any) — competitors intentionally hidden */}
            {summary && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                    {summary}
                </p>
            )}

            <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                Skills the market emphasises that aren't in your current JD — {isDismissed ? 'Selected market skills:' : 'click to add:'}
            </p>

            <div className="skill-chips">
                {skills.map((s, i) => (
                    <span
                        key={i}
                        className={`skill-chip ${selectedSkills.includes(s.skill) ? 'selected' : ''}`}
                        style={{ pointerEvents: isDismissed ? 'none' : 'auto' }}
                        onClick={() => !isDismissed && toggleSkill(s.skill)}
                        title={s.context || ''}
                    >
                        {s.skill}
                    </span>
                ))}
            </div>

            {!isDismissed && (
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
                        Add All ({(skills || []).length})
                    </button>
                    <button
                        className="btn btn-sm"
                        style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-md)' }}
                        disabled={selectedSkills.length === 0}
                        onClick={handleAcceptSelected}
                    >
                        Add Selected ({selectedSkills.length})
                    </button>
                </div>
            )}
        </div>
    );
};

export default MarketResearchCard;
