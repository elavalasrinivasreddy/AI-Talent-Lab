import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';

/**
 * MarketResearchCard — shows market-trending skills not in the current JD.
 * 
 * "Add All" visually highlights all chips before sending.
 * Competitors are intentionally hidden from the UI.
 */
const MarketResearchCard = ({ data }) => {
    const { sendMessage, workflowStage } = useChat();
    const { skills, competitors, summary } = data;

    const isHistory = workflowStage && workflowStage !== 'market_research' && workflowStage !== 'internal_check' && workflowStage !== 'intake';
    const [selectedSkills, setSelectedSkills] = useState([]);
    const [isDismissed, setIsDismissed] = useState(isHistory);
    const [dismissSummary, setDismissSummary] = useState(isHistory ? 'Selection applied ✅' : '');

    const toggleSkill = (skillName) => {
        if (isHistory) return;
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
        const allSkillNames = (skills || []).map(s => s.skill);
        // Visually highlight all chips first
        setSelectedSkills(allSkillNames);
        setDismissSummary(`Added all ${allSkillNames.length} market skills ✅`);
        setTimeout(() => {
            setIsDismissed(true);
            sendMessage({ action: 'accept_market', action_data: { skills: allSkillNames } });
        }, 300);
    };

    const handleSkip = () => {
        setDismissSummary('Skipped →');
        setIsDismissed(true);
        sendMessage({ action: 'skip_market' });
    };

    // Empty state
    if (!skills || skills.length === 0) {
        return (
            <div className="stage-card">
                <div className="stage-card-header">
                    <span className="stage-card-icon">🌐</span>
                    <span>Market Research</span>
                </div>
                <div className="stage-card-empty">
                    {competitors?.length > 0
                        ? 'Market analysis found no additional skills to suggest beyond your current requirements.'
                        : 'Market data unavailable right now. Proceeding with your requirements.'}
                </div>
                <div className="stage-card-actions">
                    <button className="stage-btn stage-btn--primary" onClick={handleSkip}>
                        Continue →
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="stage-card" style={{ opacity: isDismissed ? 0.7 : 1 }}>
            <div className="stage-card-header">
                <span className="stage-card-icon">🌐</span>
                <span>Market Research</span>
                {isDismissed && <span className="stage-card-status">{dismissSummary}</span>}
            </div>

            {summary && (
                <p className="stage-card-desc">{summary}</p>
            )}

            <p className="stage-card-desc" style={{ marginBottom: 'var(--space-2)' }}>
                Skills the market emphasises — {isDismissed ? 'Selected:' : 'click to add:'}
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
                <div className="stage-card-actions">
                    <button className="stage-btn stage-btn--ghost" onClick={handleSkip}>
                        Skip
                    </button>
                    <button className="stage-btn stage-btn--outline" onClick={handleAcceptAll}>
                        Add All ({(skills || []).length})
                    </button>
                    <button
                        className="stage-btn stage-btn--primary"
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
