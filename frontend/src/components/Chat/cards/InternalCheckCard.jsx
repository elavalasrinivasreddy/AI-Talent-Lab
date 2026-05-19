import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';
import { IconCheck, IconArrowRight } from '../icons';

/**
 * InternalCheckCard — skills found in similar past roles within the org.
 * Lives inline in the left chat rail. Becomes read-only once the flow advances.
 */
const InternalCheckCard = ({ skills }) => {
    const { sendMessage, workflowStage } = useChat();
    const [selectedSkills, setSelectedSkills] = useState([]);

    const isHistory = workflowStage && workflowStage !== 'internal_check' && workflowStage !== 'intake';
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
        setDismissSummary(`Added ${selectedSkills.length} skill${selectedSkills.length > 1 ? 's' : ''}`);
        setIsDismissed(true);
        sendMessage({ action: 'accept_internal', action_data: { skills: selectedSkills } });
    };

    const handleAcceptAll = () => {
        const allNames = skills.map((s) => s.skill);
        setSelectedSkills(allNames);
        setDismissSummary(`Added all ${allNames.length} skills`);
        setTimeout(() => {
            setIsDismissed(true);
            sendMessage({ action: 'accept_internal', action_data: { skills: allNames } });
        }, 300);
    };

    const handleSkip = () => {
        setSelectedSkills([]);
        setDismissSummary('Skipped');
        setIsDismissed(true);
        sendMessage({ action: 'skip_internal' });
    };

    // Empty state — no similar past roles in DB
    if (!skills || skills.length === 0) {
        return (
            <div className="stage-card">
                <div className="stage-card-head">
                    <span className="stage-card-eyebrow">Step 2 · Internal check</span>
                </div>
                <h3 className="stage-card-title">No similar past roles in your org yet.</h3>
                <p className="stage-card-desc">
                    That's normal for a first hire of this kind. We'll lean on market research instead.
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
                <span className="stage-card-eyebrow">Step 2 · Internal check</span>
                {isDismissed && (
                    <span className="stage-card-status stage-card-status--ok">
                        <IconCheck size={12} /> {dismissSummary}
                    </span>
                )}
            </div>
            <h3 className="stage-card-title">
                Skills your team valued in similar past roles.
            </h3>
            <p className="stage-card-desc">
                Found across {skills.length} reference JD{skills.length === 1 ? '' : 's'}.
                Pick any you want to include.
            </p>

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
                            title={s.source ? `From: ${s.source}${s.year ? ` (${s.year})` : ''}` : ''}
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

export default InternalCheckCard;
