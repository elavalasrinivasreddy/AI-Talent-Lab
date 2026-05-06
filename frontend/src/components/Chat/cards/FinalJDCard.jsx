import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../../context/ChatContext';
import PositionSetupModal from '../PositionSetupModal';

/**
 * FinalJDCard — displays the generated JD with inline bias-check diff.
 *
 * Bias check flow:
 *  1. User clicks "🛡 Check for Bias" → triggers LLM bias analysis
 *  2. Issues appear INLINE in the JD as red strikethrough / green replacement
 *  3. User can Accept ✓ or Reject ✕ each change individually
 *  4. Or "Accept All" at once
 *  5. After resolving all → button changes to "✅ Bias Check Passed"
 */
const FinalJDCard = ({ markdown, isStreaming }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedMarkdown, setEditedMarkdown] = useState(markdown);
    const [tempMarkdown, setTempMarkdown] = useState(markdown);
    const [copyLabel, setCopyLabel] = useState('Copy');
    const [showModal, setShowModal] = useState(false);
    const [biasCheckRunning, setBiasCheckRunning] = useState(false);

    // Bias diff state
    const [pendingFixes, setPendingFixes] = useState([]); // { phrase, suggestion, category, status: 'pending'|'accepted'|'rejected' }
    const [biasCheckDone, setBiasCheckDone] = useState(false);

    const { sessionTitle, sendMessage, biasIssues, biasCard, workflowStage } = useChat();

    const isComplete = workflowStage === 'complete';

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

    // Sync with incoming markdown (streaming updates)
    useEffect(() => {
        if (!isEditing) {
            setEditedMarkdown(markdown);
        }
    }, [markdown, isEditing]);

    // ── Bias fix actions ──────────────────────────────────────
    const handleAcceptFix = (idx) => {
        const fix = pendingFixes[idx];
        if (!fix || fix.status !== 'pending') return;
        // Apply the fix to the markdown
        setEditedMarkdown(prev => prev.replace(fix.phrase, fix.suggestion));
        setPendingFixes(prev => prev.map((f, i) => i === idx ? { ...f, status: 'accepted' } : f));
    };

    const handleRejectFix = (idx) => {
        setPendingFixes(prev => prev.map((f, i) => i === idx ? { ...f, status: 'rejected' } : f));
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
    };

    const unresolvedCount = pendingFixes.filter(f => f.status === 'pending').length;
    const allResolved = pendingFixes.length > 0 && unresolvedCount === 0;

    // Mark bias check as done when all resolved
    useEffect(() => {
        if (allResolved && pendingFixes.length > 0) {
            setBiasCheckDone(true);
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

    const handleSaveDraft = () => {
        sendMessage({
            action: 'finalize_jd',
            action_data: { content: editedMarkdown, status: 'draft' }
        });
    };

    const handleStartEdit = () => {
        setTempMarkdown(editedMarkdown);
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        setEditedMarkdown(tempMarkdown);
        setIsEditing(false);
        // Reset bias check since content changed
        if (pendingFixes.length > 0) {
            setPendingFixes([]);
            setBiasCheckDone(false);
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
                        <button className="jd-action-btn" onClick={handleCopy} title="Copy to Clipboard">
                            📋 {copyLabel}
                        </button>
                        <button className="jd-action-btn" onClick={handleDownloadMD} title="Download Markdown">
                            📥 .md
                        </button>
                        <button className="jd-action-btn" onClick={handleDownloadPDF} title="Download PDF">
                            📥 PDF
                        </button>
                        <button
                            className={`jd-action-btn ${isEditing ? 'jd-action-btn--active' : 'jd-action-btn--primary'}`}
                            onClick={() => isEditing ? handleSaveEdit() : handleStartEdit()}
                        >
                            {isEditing ? '✅ Save' : '✏️ Edit'}
                        </button>
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
                        <div className="jd-preview" onDoubleClick={handleStartEdit}>
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
                            disabled={biasBtn.disabled}
                        >
                            {biasBtn.label}
                        </button>
                        <button className="jd-footer-btn jd-footer-btn--draft" onClick={handleSaveDraft}>
                            💾 Save as Draft
                        </button>
                        <button className="jd-footer-btn jd-footer-btn--publish" onClick={() => setShowModal(true)}>
                            🚀 Save & Find Candidates
                        </button>
                    </div>
                )}

                {/* Completed state */}
                {isComplete && (
                    <div className="jd-card-footer jd-card-footer--complete">
                        <span className="jd-complete-badge">✅ Position saved & candidate search active</span>
                    </div>
                )}
            </div>

            <PositionSetupModal show={showModal} onClose={() => setShowModal(false)} />
        </>
    );
};

export default FinalJDCard;
