import React from 'react';
import { useChat } from '../../context/ChatContext';
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

const ChatTopBar = () => {
    const { sessionTitle, isTitleAnimating } = useChat();

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
                <NotificationBell />
            </div>
        </header>
    );
};

export default ChatTopBar;
