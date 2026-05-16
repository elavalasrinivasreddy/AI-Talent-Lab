import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../../context/ChatContext';
import { useAuth } from '../../../context/AuthContext';
import PositionSetupModal from '../PositionSetupModal';

/**
 * FinalJDCard — the main JD display with inline bias-check diff.
 *
 * Key behaviors:
 *  - Bias check: inline diff panel inside this card (no separate card)
 *  - Draft: saves JD, shows toast, keeps card editable (NOT "complete")
 *  - Publish: opens modal → position created → marks complete
 *  - All action buttons disabled during bias check analysis
 *  - Bias state restored from graph_state on reload
 */
const FinalJDCard = ({ markdown, isStreaming }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedMarkdown, setEditedMarkdown] = useState(markdown);
    const [tempMarkdown, setTempMarkdown] = useState(markdown);
    const [copyLabel, setCopyLabel] = useState('Copy');
    const [showModal, setShowModal] = useState(false);
    const [biasCheckRunning, setBiasCheckRunning] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true);

    // Bias diff state
    const [pendingFixes, setPendingFixes] = useState([]);
    const [biasCheckDone, setBiasCheckDone] = useState(false);

    const { sessionTitle, sendMessage, biasIssues, biasCard, workflowStage, currentSessionId } = useChat();
    const { token } = useAuth();

    const isComplete = workflowStage === 'complete';
    const isDraft = workflowStage === 'final_jd'; // draft stays at final_jd
    const isBusy = biasCheckRunning; // disable all actions during bias check

    // When biasCard arrives from SSE, populate pendingFixes
    useEffect(() => {
        if (biasCard && biasCard.issues && biasCard.issues.length > 0) {
            setPendingFixes(biasCard.issues.map(i => ({
                phrase: i.phrase,
                suggestion: i.suggestion,
                category: i.category || 'language',
                status: 'pending',
            })));
            setBiasCheckRunning(false);
            setBiasCheckDone(false);
        } else if (biasCard && (biasCard.clean || (biasCard.issues && biasCard.issues.length === 0))) {
            setPendingFixes([]);
            setBiasCheckRunning(false);
            setBiasCheckDone(true);
        }
    }, [biasCard]);

    // Restore bias state from graph_state on session load
    useEffect(() => {
        if (biasIssues && biasIssues.length === 0 && biasCard?.clean) {
            setBiasCheckDone(true);
        }
        // If loaded from history and it's already a draft, no unsaved changes initially
        if (!isStreaming && isDraft) {
            setHasUnsavedChanges(false);
        }
    }, []);

    // Sync with incoming markdown (streaming updates)
    useEffect(() => {
        if (!isEditing) {
            setEditedMarkdown(markdown);
        }
    }, [markdown]);

    // ── Bias fix actions ──────────────────────────────────────
    const handleAcceptFix = (idx) => {
        const fix = pendingFixes[idx];
        if (!fix || fix.status !== 'pending') return;
        setEditedMarkdown(prev => prev.replace(fix.phrase, fix.suggestion));
        setPendingFixes(prev => prev.map((f, i) => i === idx ? { ...f, status: 'accepted' } : f));
        setHasUnsavedChanges(true);
    };

    const handleRejectFix = (idx) => {
        setPendingFixes(prev => prev.map((f, i) => i === idx ? { ...f, status: 'rejected' } : f));
        setHasUnsavedChanges(true);
    };

    const handleAcceptAll = () => {
        let updated = editedMarkdown;
        const newFixes = pendingFixes.map(f => {
            if (f.status === 'pending') {
                updated = updated.replace(f.phrase, f.suggestion);
                return { ...f, status: 'accepted' };
            }
            return f;
        });
        setEditedMarkdown(updated);
        setPendingFixes(newFixes);
        setHasUnsavedChanges(true);
    };

    const unresolvedCount = pendingFixes.filter(f => f.status === 'pending').length;
    const allResolved = pendingFixes.length > 0 && unresolvedCount === 0;

    // Mark bias check as done when all resolved, and persist updated JD
    useEffect(() => {
        if (allResolved && pendingFixes.length > 0) {
            setBiasCheckDone(true);
            setBiasCheckRunning(false);
            // Auto-save the bias-corrected JD via direct API (no SSE)
            if (currentSessionId && token) {
                fetch(`/api/v1/chat/sessions/${currentSessionId}/save-draft`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ content: editedMarkdown, bias_passed: true })
                }).then(() => setHasUnsavedChanges(false))
                  .catch(err => console.error('Auto-save failed:', err));
            }
        }
    }, [allResolved, pendingFixes.length]);

    // ── JD actions ────────────────────────────────────────────
    const handleCheckBias = () => {
        setBiasCheckRunning(true);
        sendMessage({
            action: 'trigger_bias_check',
            action_data: { content: editedMarkdown }
        });
    };

    const handleSaveDraft = async () => {
        if (!currentSessionId || !token) return;
        try {
            const res = await fetch(`/api/v1/chat/sessions/${currentSessionId}/save-draft`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content: editedMarkdown })
            });
            if (res.ok) {
                setDraftSaved(true);
                setHasUnsavedChanges(false);
                setTimeout(() => setDraftSaved(false), 3000);
            }
        } catch (err) {
            console.error('Draft save failed:', err);
        }
    };

    const handleStartEdit = () => {
        setTempMarkdown(editedMarkdown);
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        setEditedMarkdown(tempMarkdown);
        setIsEditing(false);
        // Any manual edit resets the bias check state
        setBiasCheckDone(false);
        if (pendingFixes.length > 0) {
            setPendingFixes([]);
        }
        // Save the manual edit as a draft (which clears bias_issues in backend)
        if (currentSessionId && token) {
            fetch(`/api/v1/chat/sessions/${currentSessionId}/save-draft`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content: tempMarkdown })
            }).then(() => setHasUnsavedChanges(false))
              .catch(err => console.error('Edit save failed:', err));
        }
    };

    const handleCancelEdit = () => { setIsEditing(false); };

    const handleCopy = () => {
        navigator.clipboard.writeText(editedMarkdown);
        setCopyLabel('Copied!');
        setTimeout(() => setCopyLabel('Copy'), 2000);
    };

    const handleDownloadMD = () => {
        const filename = `${(sessionTitle || 'JD').replace(/\s+/g, '_')}_JD.md`;
        const blob = new Blob([editedMarkdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadPDF = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html><head><title>${sessionTitle} — Job Description</title>
            <style>
                body { font-family: 'DM Sans', sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; }
                h1 { font-size: 24px; } h2 { font-size: 18px; margin-top: 24px; }
                ul { padding-left: 20px; } li { margin-bottom: 4px; }
            </style>
            </head><body><div id="content">${document.querySelector('.jd-preview')?.innerHTML || ''}</div></body></html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    // ── Bias check button state ───────────────────────────────
    const biasButtonContent = () => {
        if (biasCheckRunning) return { label: '⏳ Analyzing...', disabled: true, cls: 'bias-btn--running' };
        if (biasCheckDone) return { label: '✅ Bias Check Passed', disabled: true, cls: 'bias-btn--passed' };
        if (pendingFixes.length > 0 && unresolvedCount > 0) return { label: `🛡 ${unresolvedCount} issue${unresolvedCount > 1 ? 's' : ''} found`, disabled: true, cls: 'bias-btn--issues' };
        return { label: '🛡 Check for Bias', disabled: false, cls: '' };
    };

    const biasBtn = biasButtonContent();

    return (
        <>
            <div className="jd-card">
                {/* Header */}
                <div className="jd-card-header">
                    <div className="jd-card-title">
                        <span className="jd-card-icon">📄</span>
                        <span>Your Job Description</span>
                        {isStreaming && <span className="blinking-cursor" style={{ marginLeft: 4 }}>▌</span>}
                    </div>
                    <div className="jd-card-actions">
                        <button className="jd-action-btn" onClick={handleCopy} title="Copy to Clipboard" disabled={isBusy}>
                            📋 {copyLabel}
                        </button>
                        <button className="jd-action-btn" onClick={handleDownloadMD} title="Download Markdown" disabled={isBusy}>
                            📥 .md
                        </button>
                        <button className="jd-action-btn" onClick={handleDownloadPDF} title="Download PDF" disabled={isBusy}>
                            📥 PDF
                        </button>
                        {!isComplete && (
                            <button
                                className={`jd-action-btn ${isEditing ? 'jd-action-btn--active' : 'jd-action-btn--primary'}`}
                                onClick={() => isEditing ? handleSaveEdit() : handleStartEdit()}
                                disabled={isBusy}
                            >
                                {isEditing ? '✅ Save' : '✏️ Edit'}
                            </button>
                        )}
                        {isEditing && (
                            <button className="jd-action-btn" onClick={handleCancelEdit}>✕</button>
                        )}
                    </div>
                </div>

                {/* JD Content */}
                <div className="jd-card-body">
                    {isEditing ? (
                        <textarea
                            className="jd-edit-textarea"
                            value={tempMarkdown}
                            onChange={(e) => setTempMarkdown(e.target.value)}
                        />
                    ) : (
                        <div className="jd-preview" onDoubleClick={!isComplete ? handleStartEdit : undefined}>
                            <ReactMarkdown>{editedMarkdown}</ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* ── Inline Bias Diff Panel ── */}
                {pendingFixes.length > 0 && !allResolved && (
                    <div className="bias-diff-panel">
                        <div className="bias-diff-header">
                            <span className="bias-diff-title">
                                🛡 Inclusivity Review — {unresolvedCount} change{unresolvedCount !== 1 ? 's' : ''} suggested
                            </span>
                            {unresolvedCount > 0 && (
                                <button className="bias-accept-all-btn" onClick={handleAcceptAll}>
                                    ✓ Accept All
                                </button>
                            )}
                        </div>
                        <div className="bias-diff-list">
                            {pendingFixes.map((fix, idx) => (
                                <div key={idx} className={`bias-diff-row bias-diff-row--${fix.status}`}>
                                    <div className="bias-diff-content">
                                        <span className="bias-diff-category">{fix.category?.replace(/_/g, ' ')}</span>
                                        <div className="bias-diff-change">
                                            <span className="bias-diff-old">{fix.phrase}</span>
                                            <span className="bias-diff-arrow">→</span>
                                            <span className="bias-diff-new">{fix.suggestion}</span>
                                        </div>
                                    </div>
                                    {fix.status === 'pending' && (
                                        <div className="bias-diff-actions">
                                            <button className="bias-fix-btn bias-fix-btn--accept" onClick={() => handleAcceptFix(idx)} title="Accept">✓</button>
                                            <button className="bias-fix-btn bias-fix-btn--reject" onClick={() => handleRejectFix(idx)} title="Reject">✕</button>
                                        </div>
                                    )}
                                    {fix.status === 'accepted' && <span className="bias-fix-badge bias-fix-badge--accepted">Applied</span>}
                                    {fix.status === 'rejected' && <span className="bias-fix-badge bias-fix-badge--rejected">Skipped</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Action Buttons ── */}
                {!isStreaming && !isComplete && (
                    <div className="jd-card-footer">
                        <button
                            className={`jd-footer-btn jd-footer-btn--bias ${biasBtn.cls}`}
                            onClick={handleCheckBias}
                            disabled={biasBtn.disabled || isBusy}
                        >
                            {biasBtn.label}
                        </button>
                        <button
                            className="jd-footer-btn jd-footer-btn--draft"
                            onClick={handleSaveDraft}
                            disabled={isBusy || !hasUnsavedChanges}
                        >
                            {draftSaved ? '✅ Draft Saved' : !hasUnsavedChanges ? '✅ Draft Saved' : '💾 Save as Draft'}
                        </button>
                        <button
                            className="jd-footer-btn jd-footer-btn--publish"
                            onClick={() => setShowModal(true)}
                            disabled={isBusy}
                        >
                            🚀 Save & Find Candidates
                        </button>
                    </div>
                )}

                {/* Completed state — only for published positions */}
                {isComplete && (
                    <div className="jd-card-footer jd-card-footer--complete">
                        <span className="jd-complete-badge">✅ Position saved & candidate search active</span>
                    </div>
                )}

                {/* Draft toast */}
                {draftSaved && (
                    <div className="jd-draft-toast">
                        ✅ JD saved as draft. You can continue editing or publish when ready.
                    </div>
                )}
            </div>

            <PositionSetupModal show={showModal} onClose={() => setShowModal(false)} />
        </>
    );
};

export default FinalJDCard;
