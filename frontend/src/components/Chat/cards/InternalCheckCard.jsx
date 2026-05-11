import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';

/**
 * InternalCheckCard — shows skills found in similar past roles.
 * 
 * Empty state: graceful message when no similar roles exist in the org DB.
 * "Add All" visually selects all chips before submitting.
 */
const InternalCheckCard = ({ skills }) => {
    const { sendMessage, workflowStage } = useChat();
    const [selectedSkills, setSelectedSkills] = useState([]);
    
    // If we've moved past internal_check, the card is in read-only history mode
    const isHistory = workflowStage && workflowStage !== 'internal_check' && workflowStage !== 'intake';
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
        setDismissSummary(`Added ${selectedSkills.length} skill${selectedSkills.length > 1 ? 's' : ''} ✅`);
        setIsDismissed(true);
        sendMessage({ action: 'accept_internal', action_data: { skills: selectedSkills } });
    };

    const handleAcceptAll = () => {
        const allSkillNames = skills.map(s => s.skill);
        // Visually highlight all chips first
        setSelectedSkills(allSkillNames);
        setDismissSummary(`Added all ${allSkillNames.length} skills ✅`);
        // Small delay so user sees the selection animation
        setTimeout(() => {
            setIsDismissed(true);
            sendMessage({ action: 'accept_internal', action_data: { skills: allSkillNames } });
        }, 300);
    };

    const handleSkip = () => {
        setSelectedSkills([]); // Visually unselect anything the user clicked
        setDismissSummary('Skipped →');
        setIsDismissed(true);
        sendMessage({ action: 'skip_internal' });
    };

    // Empty state — no similar roles in DB
    if (!skills || skills.length === 0) {
        return (
            <div className="stage-card">
                <div className="stage-card-header">
                    <span className="stage-card-icon">📊</span>
                    <span>Internal Skills Check</span>
                </div>
                <div className="stage-card-empty">
                    No similar past roles found in your organization yet. This is normal for new positions — we'll use market research data instead.
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
                <span className="stage-card-icon">📊</span>
                <span>Internal Skills Check</span>
                {isDismissed && <span className="stage-card-status">{dismissSummary}</span>}
            </div>
            <p className="stage-card-desc">
                Found in similar past roles — not in your current requirements. {isDismissed ? 'Selected:' : 'Click to select:'}
            </p>

            <div className="skill-chips">
                {skills.map((s, i) => (
                    <span
                        key={i}
                        className={`skill-chip ${selectedSkills.includes(s.skill) ? 'selected' : ''}`}
                        style={{ pointerEvents: isDismissed ? 'none' : 'auto' }}
                        onClick={() => !isDismissed && toggleSkill(s.skill)}
                        title={s.source ? `From: ${s.source}${s.year ? ` (${s.year})` : ''}` : ''}
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
                        Add All ({skills.length})
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

export default InternalCheckCard;
