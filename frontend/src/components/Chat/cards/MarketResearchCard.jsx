import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';
import { IconCheck, IconArrowRight } from '../icons';

/**
 * MarketResearchCard — market-trending skills not in the current draft.
 * Same chip pattern as InternalCheckCard; lives inline in the left chat rail.
 */
const MarketResearchCard = ({ data }) => {
    const { sendMessage, workflowStage } = useChat();
    const { skills, competitors, summary } = data;

    const isHistory =
        workflowStage &&
        workflowStage !== 'market_research' &&
        workflowStage !== 'internal_check' &&
        workflowStage !== 'intake';

    const [selectedSkills, setSelectedSkills] = useState([]);
    const [isDismissed, setIsDismissed] = useState(isHistory);
    const [dismissSummary, setDismissSummary] = useState(isHistory ? 'Selection applied' : '');

    const toggleSkill = (skillName) => {
        if (isDismissed) return;
        setSelectedSkills((prev) =>
            prev.includes(skillName) ? prev.filter((s) => s !== skillName) : [...prev, skillName]
        );
    };

    const handleAcceptSelected = () => {
        if (selectedSkills.length === 0) return;
        setDismissSummary(`Added ${selectedSkills.length} market skill${selectedSkills.length > 1 ? 's' : ''}`);
        setIsDismissed(true);
        sendMessage({ action: 'accept_market', action_data: { skills: selectedSkills } });
    };

    const handleAcceptAll = () => {
        const allNames = (skills || []).map((s) => s.skill);
        setSelectedSkills(allNames);
        setDismissSummary(`Added all ${allNames.length} market skills`);
        setTimeout(() => {
            setIsDismissed(true);
            sendMessage({ action: 'accept_market', action_data: { skills: allNames } });
        }, 300);
    };

    const handleSkip = () => {
        setSelectedSkills([]);
        setDismissSummary('Skipped');
        setIsDismissed(true);
        sendMessage({ action: 'skip_market' });
    };

    // Empty state
    if (!skills || skills.length === 0) {
        return (
            <div className="stage-card">
                <div className="stage-card-head">
                    <span className="stage-card-eyebrow">Step 3 · Market research</span>
                </div>
                <h3 className="stage-card-title">
                    {competitors?.length > 0
                        ? 'No additional skills to suggest from the market.'
                        : 'Market data unavailable right now.'}
                </h3>
                <p className="stage-card-desc">
                    Continuing with your requirements as the basis for the draft.
                </p>
                <div className="stage-card-actions">
                    <div className="stage-card-actions-spacer" />
                    <button className="btn-primary" onClick={handleSkip}>
                        Continue <IconArrowRight size={14} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="stage-card" data-dismissed={isDismissed}>
            <div className="stage-card-head">
                <span className="stage-card-eyebrow">Step 3 · Market research</span>
                {isDismissed && (
                    <span className="stage-card-status stage-card-status--ok">
                        <IconCheck size={12} /> {dismissSummary}
                    </span>
                )}
            </div>
            <h3 className="stage-card-title">Skills the market emphasises for this role.</h3>
            {summary && <p className="stage-card-desc">{summary}</p>}

            <div className="skill-chips">
                {skills.map((s, i) => {
                    const pressed = selectedSkills.includes(s.skill);
                    return (
                        <button
                            key={i}
                            type="button"
                            className="skill-chip"
                            aria-pressed={pressed}
                            disabled={isDismissed}
                            onClick={() => toggleSkill(s.skill)}
                            title={s.context || ''}
                        >
                            {s.skill}
                        </button>
                    );
                })}
            </div>

            {!isDismissed && (
                <div className="stage-card-actions">
                    <button className="btn-quiet" onClick={handleSkip}>Skip</button>
                    <div className="stage-card-actions-spacer" />
                    <button className="btn-ghost" onClick={handleAcceptAll}>
                        Add all · {skills.length}
                    </button>
                    <button
                        className="btn-primary"
                        disabled={selectedSkills.length === 0}
                        onClick={handleAcceptSelected}
                    >
                        Add selected{selectedSkills.length > 0 ? ` · ${selectedSkills.length}` : ''}
                    </button>
                </div>
            )}
        </div>
    );
};

export default MarketResearchCard;
