import React from 'react';
import { useChat } from '../../context/ChatContext';
import FinalizeCTA from './FinalizeCTA';
import NotificationBell from '../common/NotificationBell';

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

const ChatTopBar = ({ isRailOpen, onToggleRail }) => {
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
            <div className="chat-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="stage-meta" aria-live="polite">
                    <span
                        className={`stage-meta-dot ${isActive ? 'stage-meta-dot--pulse' : ''}`}
                        aria-hidden="true"
                    />
                    <span>
                        Stage {stage.index} / {TOTAL_STAGES} · {stage.label}
                    </span>
                </div>
                
                <FinalizeCTA />
                
                <button 
                    onClick={onToggleRail} 
                    className="icon-btn" 
                    title={isRailOpen ? "Hide Rail" : "Show Rail"}
                    aria-label={isRailOpen ? "Hide Rail" : "Show Rail"}
                >
                    {isRailOpen ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="15" y1="3" x2="15" y2="21"></line>
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="9" y1="3" x2="9" y2="21"></line>
                        </svg>
                    )}
                </button>
                <NotificationBell />
            </div>
        </header>
    );
};

export default ChatTopBar;
