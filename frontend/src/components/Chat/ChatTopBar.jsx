import React, { useState } from 'react';
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
    const {
        sessionTitle,
        setSessionTitle,
        isTitleAnimating,
        workflowStage,
        currentSessionId,
        deleteSession
    } = useChat();

    const [showModal, setShowModal] = useState(false);
    const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);

    const stageInfo = STAGE_CONFIG[workflowStage] || STAGE_CONFIG.intake;

    const handleTitleChange = (e) => {
        setSessionTitle(e.target.textContent);
    };

    const handleDiscard = async () => {
        if (currentSessionId) {
            await deleteSession(currentSessionId);
        }
        setShowConfirmDiscard(false);
        window.location.href = '/chat';
    };

    return (
        <>
            <div className="chat-topbar">
                <div className="chat-topbar-left">
                    <span
                        className={`session-title ${isTitleAnimating ? 'title-pop' : ''}`}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={handleTitleChange}
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
                    {workflowStage !== 'complete' && (
                        <button
                            className="btn btn-sm"
                            style={{
                                color: 'var(--color-text-muted)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)'
                            }}
                            onClick={() => setShowConfirmDiscard(true)}
                        >
                            Discard
                        </button>
                    )}
                    <button
                        className="btn btn-sm"
                        style={{
                            background: workflowStage === 'complete' ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
                            color: workflowStage === 'complete' ? '#fff' : 'var(--color-text-muted)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            cursor: workflowStage === 'complete' ? 'pointer' : 'not-allowed',
                            opacity: workflowStage === 'complete' ? 1 : 0.5
                        }}
                        onClick={() => workflowStage === 'complete' && setShowModal(true)}
                        disabled={workflowStage !== 'complete'}
                    >
                        Save & Find Candidates
                    </button>
                </div>
            </div>

            {/* Discard Confirmation */}
            {showConfirmDiscard && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)' }}>
                    <div className="modal-dialog modal-sm modal-dialog-centered">
                        <div className="modal-content" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                            <div className="modal-body text-center p-4">
                                <p className="mb-3">Discard this session? This action cannot be undone.</p>
                                <div className="d-flex gap-2 justify-content-center">
                                    <button className="btn btn-sm" style={{ border: '1px solid var(--color-border)' }} onClick={() => setShowConfirmDiscard(false)}>Cancel</button>
                                    <button className="btn btn-sm" style={{ background: 'var(--color-danger)', color: '#fff' }} onClick={handleDiscard}>Discard</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <PositionSetupModal show={showModal} onClose={() => setShowModal(false)} />
        </>
    );
};

export default ChatTopBar;
