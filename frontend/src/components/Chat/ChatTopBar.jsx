import React from 'react';
import { useChat } from '../../context/ChatContext';

const STAGE_CONFIG = {
    intake:          { label: 'Intake',           index: 1 },
    internal_check:  { label: 'Internal check',   index: 2 },
    market_research: { label: 'Market research',  index: 3 },
    benchmarking:    { label: 'Benchmarking',     index: 3 },
    jd_variants:     { label: 'Choose style',     index: 4 },
    final_jd:        { label: 'Drafting JD',      index: 5 },
    bias_check:      { label: 'Inclusivity',      index: 5 },
    complete:        { label: 'Complete',         index: 5 },
};

const TOTAL_STAGES = 5;

const ChatTopBar = () => {
    const { sessionTitle, isTitleAnimating, workflowStage, isStreaming } = useChat();
    const stage = STAGE_CONFIG[workflowStage] || STAGE_CONFIG.intake;
    const isActive = isStreaming || (workflowStage !== 'complete' && workflowStage !== 'intake');

    return (
        <header className="chat-topbar" role="banner">
            <div className="chat-topbar-title">
                <span
                    className={`session-title ${isTitleAnimating ? 'title-pop' : ''}`}
                    title={sessionTitle}
                >
                    {sessionTitle || 'New Hire'}
                </span>
            </div>
            <div className="stage-meta" aria-live="polite">
                <span
                    className={`stage-meta-dot ${isActive ? 'stage-meta-dot--pulse' : ''}`}
                    aria-hidden="true"
                />
                <span>
                    Stage {stage.index} / {TOTAL_STAGES} · {stage.label}
                </span>
            </div>
        </header>
    );
};

export default ChatTopBar;
