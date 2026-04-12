// components/JD/AgentRecommendations.jsx
// Skill-chip based selection UI for internal history and market benchmarking
import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';

function SkillChip({ skill, selected, onToggle, isReadOnly }) {
    return (
        <div
            className={`skill-chip ${selected ? 'skill-chip--selected' : ''} ${isReadOnly ? 'skill-chip--readonly' : ''}`}
            onClick={() => !isReadOnly && onToggle && onToggle()}
            title={skill.reason}
        >
            <span className="skill-chip__name">{skill.name}</span>
            {selected && <span className="skill-chip__check">✓</span>}
        </div>
    );
}

function SkillSection({ title, badgeIcon, badgeClass, summary, skills, selectedSkills, onToggle, onAccept, onSkip, decided, isReadOnly, acceptedSkillNames }) {
    if (!skills || skills.length === 0) return null;

    // Build a Set of accepted skill names for history display
    const acceptedSet = isReadOnly && acceptedSkillNames ? new Set(acceptedSkillNames) : null;
    const wasSkipped = isReadOnly && acceptedSkillNames && acceptedSkillNames.length === 0;
    const effectiveDecided = isReadOnly ? (wasSkipped ? 'skipped' : 'accepted') : decided;

    return (
        <div className={`rec-card ${effectiveDecided === 'accepted' ? 'rec-card--accepted' : effectiveDecided === 'skipped' ? 'rec-card--skipped' : ''}`}>
            <div className="rec-card__header">
                <span className={`rec-card__badge ${badgeClass}`}>{badgeIcon} {title}</span>
                {isReadOnly && !wasSkipped && <span className="rec-card__status status--accepted">✓ Accepted</span>}
                {isReadOnly && wasSkipped && <span className="rec-card__status status--skipped">✕ Skipped</span>}
                {!isReadOnly && effectiveDecided === 'accepted' && <span className="rec-card__status status--accepted">✓ Accepted</span>}
                {!isReadOnly && effectiveDecided === 'skipped' && <span className="rec-card__status status--skipped">✕ Skipped</span>}
            </div>
            {summary && <p className="rec-card__desc">{summary}</p>}
            <div className="rec-card__chips">
                {skills.map((skill, i) => {
                    const isSelected = isReadOnly
                        ? (acceptedSet ? acceptedSet.has(skill.name) : false)
                        : selectedSkills.has(skill.name);
                    return (
                        <div key={i} style={{ animationDelay: `${i * 0.05}s` }}>
                            <SkillChip
                                skill={skill}
                                selected={isSelected}
                                onToggle={() => !effectiveDecided && !isReadOnly && onToggle(skill.name)}
                                isReadOnly={isReadOnly}
                            />
                        </div>
                    );
                })}
            </div>
            {!effectiveDecided && !isReadOnly && (
                <div className="rec-card__actions">
                    <button className="rec-btn rec-btn--skip" onClick={onSkip}>
                        Skip All
                    </button>
                    <span className="rec-card__count">
                        {selectedSkills.size} of {skills.length} selected
                    </span>
                    <button
                        className="rec-btn rec-btn--accept"
                        onClick={onAccept}
                    >
                        Accept Selected
                    </button>
                </div>
            )}
        </div>
    );
}

export default function InternalReviewCard({ data, onComplete, isReadOnly, acceptedSkillNames }) {
    const [selectedSkills, setSelectedSkills] = useState(new Set());
    const [decided, setDecided] = useState(null);

    if (!data) return null;

    const skills = data.skills || [];
    const summary = data.summary || '';

    const toggle = (name) => {
        setSelectedSkills(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const accept = () => {
        setDecided('accepted');
        const accepted = skills.filter(s => selectedSkills.has(s.name));
        onComplete(accepted, 'accepted');
    };

    const skip = () => {
        setDecided('skipped');
        onComplete([], 'skipped');
    };

    return (
        <SkillSection
            title="Internal History"
            badgeIcon="🏛️"
            badgeClass="rec-card__badge--internal"
            summary={summary}
            skills={skills}
            selectedSkills={selectedSkills}
            onToggle={toggle}
            onAccept={accept}
            onSkip={skip}
            decided={decided}
            isReadOnly={isReadOnly}
            acceptedSkillNames={acceptedSkillNames}
        />
    );
}

export function MarketReviewCard({ data, competitors, onComplete, isReadOnly, acceptedSkillNames }) {
    const [selectedMissing, setSelectedMissing] = useState(new Set());
    const [selectedDiff, setSelectedDiff] = useState(new Set());
    const [decided, setDecided] = useState(null);

    if (!data) return null;

    const missingSkills = data.missing_skills || [];
    const diffSkills = data.differential_skills || [];
    const allSkills = [...missingSkills, ...diffSkills];
    const summary = data.summary || '';
    const totalSelected = selectedMissing.size + selectedDiff.size;

    // Build accepted set for history display
    const acceptedSet = isReadOnly && acceptedSkillNames ? new Set(acceptedSkillNames) : null;
    const wasSkipped = isReadOnly && acceptedSkillNames && acceptedSkillNames.length === 0;
    const effectiveDecided = isReadOnly ? (wasSkipped ? 'skipped' : 'accepted') : decided;

    const toggleMissing = (name) => {
        setSelectedMissing(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const toggleDiff = (name) => {
        setSelectedDiff(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const accept = () => {
        setDecided('accepted');
        const accepted = [
            ...missingSkills.filter(s => selectedMissing.has(s.name)),
            ...diffSkills.filter(s => selectedDiff.has(s.name)),
        ];
        onComplete(accepted, 'accepted');
    };

    const skip = () => {
        setDecided('skipped');
        onComplete([], 'skipped');
    };

    return (
        <div className={`rec-card rec-card--market ${effectiveDecided === 'accepted' ? 'rec-card--accepted' : effectiveDecided === 'skipped' ? 'rec-card--skipped' : ''}`}>
            <div className="rec-card__header">
                <span className="rec-card__badge rec-card__badge--market">🌐 Market Benchmark</span>
                {isReadOnly && !wasSkipped && <span className="rec-card__status status--accepted">✓ Accepted</span>}
                {isReadOnly && wasSkipped && <span className="rec-card__status status--skipped">✕ Skipped</span>}
                {!isReadOnly && effectiveDecided === 'accepted' && <span className="rec-card__status status--accepted">✓ Accepted</span>}
                {!isReadOnly && effectiveDecided === 'skipped' && <span className="rec-card__status status--skipped">✕ Skipped</span>}
            </div>
            {summary && <p className="rec-card__desc">{summary}</p>}

            {missingSkills.length > 0 && (
                <div className="rec-card__chip-group">
                    <span className="rec-card__chip-label">Missing Skills:</span>
                    <div className="rec-card__chips">
                        {missingSkills.map((skill, i) => {
                            const isSelected = isReadOnly
                                ? (acceptedSet ? acceptedSet.has(skill.name) : false)
                                : selectedMissing.has(skill.name);
                            return (
                                <div key={`m-${i}`} style={{ animation: 'chipStreamIn 0.3s ease backwards', animationDelay: `${i * 0.05}s` }}>
                                    <SkillChip skill={skill} selected={isSelected} onToggle={() => !effectiveDecided && !isReadOnly && toggleMissing(skill.name)} isReadOnly={isReadOnly} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {diffSkills.length > 0 && (
                <div className="rec-card__chip-group">
                    <span className="rec-card__chip-label">Differential / Premium Skills:</span>
                    <div className="rec-card__chips">
                        {diffSkills.map((skill, i) => {
                            const isSelected = isReadOnly
                                ? (acceptedSet ? acceptedSet.has(skill.name) : false)
                                : selectedDiff.has(skill.name);
                            return (
                                <div key={`d-${i}`} style={{ animation: 'chipStreamIn 0.3s ease backwards', animationDelay: `${(missingSkills.length + i) * 0.05}s` }}>
                                    <SkillChip skill={skill} selected={isSelected} onToggle={() => !effectiveDecided && !isReadOnly && toggleDiff(skill.name)} isReadOnly={isReadOnly} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {!effectiveDecided && !isReadOnly && (
                <div className="rec-card__actions">
                    <button className="rec-btn rec-btn--skip" onClick={skip}>Skip All</button>
                    <span className="rec-card__count">{totalSelected} of {allSkills.length} selected</span>
                    <button className="rec-btn rec-btn--accept" onClick={accept}>Accept Selected</button>
                </div>
            )}
        </div>
    );
}
