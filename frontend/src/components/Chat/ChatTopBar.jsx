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
    const { sessionTitle, isTitleAnimating, isReadOnly, readOnlyReason } = useChat();

    return (
        <>
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
            {isReadOnly && (
                <div
                    role="status"
                    aria-live="polite"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 20px',
                        background: 'rgba(245, 158, 11, 0.08)',
                        borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
                        fontSize: '13px',
                        color: '#D97706',
                        fontWeight: 500,
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    {readOnlyReason === 'pending_approval'
                        ? 'Pending team lead approval — this JD is read-only until a decision is made'
                        : readOnlyReason === 'approved_and_open'
                            ? 'Position approved — this JD is now finalized and read-only'
                            : 'This JD has been finalized and is read-only'}
                </div>
            )}
        </>
    );
};

export default ChatTopBar;
