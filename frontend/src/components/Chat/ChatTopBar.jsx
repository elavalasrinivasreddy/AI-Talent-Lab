import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import PositionSetupModal from './PositionSetupModal';

const STAGE_CONFIG = {
    intake:           { label: 'Gathering Requirements', color: 'var(--color-info)' },
    internal_check:   { label: 'Internal Skills Check', color: '#a855f7' },
    market_research:  { label: 'Market Research',       color: '#06b6d4' },
    benchmarking:     { label: 'Benchmarking',          color: '#06b6d4' },
    jd_variants:      { label: 'Choose JD Style',       color: 'var(--color-warning)' },
    final_jd:         { label: 'Generating JD',         color: 'var(--color-success)' },
    bias_check:       { label: 'Bias Check',            color: 'var(--color-success)' },
    complete:         { label: 'Complete',               color: 'var(--color-text-muted)' }
};

const ChatTopBar = () => {
    const navigate = useNavigate();
    const {
        sessionTitle,
        isTitleAnimating,
        workflowStage,
        currentSessionId,
        deleteSession
    } = useChat();

    const stageInfo = STAGE_CONFIG[workflowStage] || STAGE_CONFIG.intake;

    const handleDiscard = async () => {
        if (currentSessionId) {
            await deleteSession(currentSessionId);
        }
        navigate('/chat', { replace: true });
    };

    return (
        <>
            <div className="chat-topbar">
                <div className="chat-topbar-left">
                    {/* Title — read-only, updated via role extraction with animation */}
                    <span
                        className={`session-title ${isTitleAnimating ? 'title-pop' : ''}`}
                        title={sessionTitle}
                    >
                        {sessionTitle}
                    </span>
                    <span
                        className="stage-pill"
                        style={{
                            background: `${stageInfo.color}20`,
                            color: stageInfo.color,
                            border: `1px solid ${stageInfo.color}40`
                        }}
                    >
                        <span style={{
                            display: 'inline-block',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: stageInfo.color,
                            marginRight: 6
                        }}></span>
                        {stageInfo.label}
                    </span>
                </div>
                <div className="d-flex gap-2">
                    {/* Discard button removed as per user request */}
                </div>
            </div>
        </>
    );
};

export default ChatTopBar;
