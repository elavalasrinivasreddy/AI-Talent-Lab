import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../../context/ChatContext';
import { useAuth } from '../../../context/AuthContext';
import PositionSetupModal from '../PositionSetupModal';
import { marked } from 'marked';
import TurndownService from 'turndown';
import {
    IconCopy, IconDownload, IconEdit, IconCheck, IconX,
    IconShield, IconFileText, IconLoader, IconArrowRight, IconSparkles,
} from '../icons';

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

/**
 * FinalJDCard — owns the entire RIGHT CANVAS when a JD exists.
 * Renders the canvas head (utility actions), canvas body (the document),
 * canvas footer (primary CTAs), and inline bias diff below the body.
 */
const FinalJDCard = () => {
    const {
        sessionTitle,
        sendMessage,
        finalJdMarkdown,
        streamingJdText,
        isJdStreaming,
        setFinalJdMarkdown,
        biasCard,
        biasIssues,
        workflowStage,
        currentSessionId,
        isReadOnly,
    } = useChat();
    const { token } = useAuth();

    const liveMarkdown = finalJdMarkdown || streamingJdText || '';

    const [isEditing, setIsEditing] = useState(false);
    const [editedMarkdown, setEditedMarkdown] = useState(liveMarkdown);
    const editRef = useRef(null);
    const turndownService = new TurndownService({ headingStyle: 'atx' });
    const [tempMarkdown, setTempMarkdown] = useState(liveMarkdown);
    const [copyLabel, setCopyLabel] = useState('Copy');
    const [showModal, setShowModal] = useState(false);
    const [biasCheckRunning, setBiasCheckRunning] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true);

    const [pendingFixes, setPendingFixes] = useState([]);
    const [biasCheckDone, setBiasCheckDone] = useState(false);

    const isComplete = workflowStage === 'complete';
    const isDraft = workflowStage === 'final_jd';
    const isBusy = biasCheckRunning;

    useEffect(() => {
        if (biasCard && biasCard.issues && biasCard.issues.length > 0) {
            setPendingFixes(biasCard.issues.map((i) => ({
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

    useEffect(() => {
        if (biasIssues && biasIssues.length === 0 && biasCard?.clean) {
            setBiasCheckDone(true);
        }
        if (!isJdStreaming && isDraft) {
            setHasUnsavedChanges(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!isEditing) setEditedMarkdown(liveMarkdown);
    }, [liveMarkdown, isEditing]);

    // ── Bias fix actions ──
    const handleAcceptFix = (idx) => {
        const fix = pendingFixes[idx];
        if (!fix || fix.status !== 'pending') return;
        setEditedMarkdown((prev) => prev.replace(fix.phrase, fix.suggestion));
        setPendingFixes((prev) => prev.map((f, i) => (i === idx ? { ...f, status: 'accepted' } : f)));
        setHasUnsavedChanges(true);
    };

    const handleRejectFix = (idx) => {
        setPendingFixes((prev) => prev.map((f, i) => (i === idx ? { ...f, status: 'rejected' } : f)));
        setHasUnsavedChanges(true);
    };

    const handleAcceptAll = () => {
        let updated = editedMarkdown;
        const newFixes = pendingFixes.map((f) => {
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

    const unresolvedCount = pendingFixes.filter((f) => f.status === 'pending').length;
    const allResolved = pendingFixes.length > 0 && unresolvedCount === 0;

    useEffect(() => {
        if (allResolved && pendingFixes.length > 0) {
            setBiasCheckDone(true);
            setBiasCheckRunning(false);
            if (currentSessionId && token) {
                fetch(`/api/v1/chat/sessions/${currentSessionId}/save-draft`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ content: editedMarkdown, bias_passed: true }),
                })
                    .then(() => setHasUnsavedChanges(false))
                    .catch((err) => console.error('Auto-save failed:', err));
            }
        }
    }, [allResolved, pendingFixes.length]);

    // ── JD actions ──
    const handleCheckBias = () => {
        setBiasCheckRunning(true);
        sendMessage({
            action: 'trigger_bias_check',
            action_data: { content: editedMarkdown },
        });
    };

    const handleSaveDraft = async () => {
        if (!currentSessionId || !token) return;
        try {
            const res = await fetch(`/api/v1/chat/sessions/${currentSessionId}/save-draft`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ content: editedMarkdown }),
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
        if (editRef.current) {
            const html = editRef.current.innerHTML;
            const md = turndownService.turndown(html);
            setEditedMarkdown(md);
            setFinalJdMarkdown(md);
            setIsEditing(false);
            setBiasCheckDone(false);
            if (pendingFixes.length > 0) setPendingFixes([]);
            if (currentSessionId && token) {
                fetch(`/api/v1/chat/sessions/${currentSessionId}/save-draft`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ content: md }),
                })
                    .then(() => setHasUnsavedChanges(false))
                    .catch((err) => console.error('Edit save failed:', err));
            }
        }
    };

    const handleCancelEdit = () => setIsEditing(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(editedMarkdown);
        setCopyLabel('Copied');
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
        // Build a sanitized print document via Blob URL (no document.write).
        const safeTitle = escapeHtml(sessionTitle || 'Job Description');
        const docHtml = document.querySelector('.jd-doc')?.innerHTML || '';
        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${safeTitle} — Job Description</title>
<style>
  body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 720px; margin: 48px auto; padding: 0 24px; color: #0f172a; line-height: 1.65; }
  h1 { font-size: 26px; margin: 0 0 12px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin: 28px 0 8px; }
  h3 { font-size: 14px; margin: 16px 0 6px; }
  ul, ol { padding-left: 22px; } li { margin-bottom: 4px; }
  p { margin: 0 0 12px; }
</style>
</head><body>${docHtml}<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},250);});<\/script></body></html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
            // Revoke after the print window has had time to load
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
    };

    const biasLinkState = () => {
        if (biasCheckRunning) return { label: 'Checking inclusivity…', icon: <IconLoader size={14} />, cls: 'canvas-bias-link--working', disabled: true };
        if (biasCheckDone) return { label: 'Inclusivity check passed', icon: <IconCheck size={14} />, cls: 'canvas-bias-link--ok', disabled: true };
        if (pendingFixes.length > 0 && unresolvedCount > 0) return { label: `${unresolvedCount} suggestion${unresolvedCount > 1 ? 's' : ''} below`, icon: <IconShield size={14} />, cls: '', disabled: true };
        return { label: 'Run inclusivity check', icon: <IconShield size={14} />, cls: '', disabled: false };
    };

    const biasLink = biasLinkState();

    return (
        <>
            <div className="canvas-head">
                <div className="canvas-head-meta">
                    <IconFileText size={14} />
                    <span>
                        {isJdStreaming ? 'Drafting · Streaming' : isComplete ? 'Document · Published' : 'Document · Draft'}
                    </span>
                    {isJdStreaming && <span className="stream-cursor" aria-hidden="true" />}
                </div>
                <div className="canvas-head-tools">
                    <button className="icon-btn" title={copyLabel} aria-label="Copy markdown" onClick={handleCopy} disabled={isBusy}>
                        <IconCopy size={15} />
                    </button>
                    <button className="icon-btn" title="Download .md" aria-label="Download markdown" onClick={handleDownloadMD} disabled={isBusy}>
                        <IconDownload size={15} />
                    </button>
                    <button className="icon-btn" title="Download PDF" aria-label="Download PDF" onClick={handleDownloadPDF} disabled={isBusy}>
                        <IconFileText size={15} />
                    </button>
                    {!isComplete && !isReadOnly && (
                        isEditing ? (
                            <>
                                <button className="icon-btn" title="Save changes" aria-label="Save changes" onClick={handleSaveEdit}>
                                    <IconCheck size={15} />
                                </button>
                                <button className="icon-btn" title="Cancel edit" aria-label="Cancel edit" onClick={handleCancelEdit}>
                                    <IconX size={15} />
                                </button>
                            </>
                        ) : (
                            <button className="icon-btn" title="Edit" aria-label="Edit JD" onClick={handleStartEdit} disabled={isBusy}>
                                <IconEdit size={15} />
                            </button>
                        )
                    )}
                </div>
            </div>

            <div className="canvas-body">
                <div className="canvas-doc">
                    {isEditing ? (
                        <article className="jd-body" style={{ border: '1px solid var(--border-200)', borderRadius: '8px', padding: '16px' }}>
                            <div
                                ref={editRef}
                                className="jd-wysiwyg"
                                contentEditable={true}
                                dangerouslySetInnerHTML={{ __html: marked(tempMarkdown) }}
                                style={{ outline: 'none' }}
                                onBlur={(e) => setTempMarkdown(turndownService.turndown(e.target.innerHTML))}
                            />
                        </article>
                    ) : (
                        <article className="jd-body">
                            <ReactMarkdown>{editedMarkdown}</ReactMarkdown>
                            {isJdStreaming && <span className="stream-cursor" aria-hidden="true" />}
                        </article>
                    )}
                </div>

                {pendingFixes.length > 0 && !allResolved && (
                    <div className="bias-diff" aria-label="Inclusivity suggestions">
                        <div className="bias-diff-head">
                            <span className="bias-diff-title">
                                <IconShield size={14} /> Inclusivity review
                            </span>
                            <span className="bias-diff-count">
                                {unresolvedCount} suggestion{unresolvedCount === 1 ? '' : 's'}
                            </span>
                            {unresolvedCount > 1 && (
                                <button className="btn-ghost btn-sm" onClick={handleAcceptAll}>
                                    <IconCheck size={12} /> Accept all
                                </button>
                            )}
                        </div>
                        {pendingFixes.map((fix, idx) => (
                            <div key={idx} className="bias-diff-row" data-state={fix.status}>
                                <div className="bias-diff-change">
                                    <span className="bias-diff-cat">{(fix.category || '').replace(/_/g, ' ')}</span>
                                    <span className="bias-diff-old">{fix.phrase}</span>
                                    <span className="bias-diff-arrow">→</span>
                                    <span className="bias-diff-new">{fix.suggestion}</span>
                                </div>
                                {fix.status === 'pending' && !isReadOnly ? (
                                    <div className="bias-diff-actions">
                                        <button className="icon-btn" title="Accept" aria-label="Accept suggestion" onClick={() => handleAcceptFix(idx)}>
                                            <IconCheck size={14} />
                                        </button>
                                        <button className="icon-btn" title="Reject" aria-label="Reject suggestion" onClick={() => handleRejectFix(idx)}>
                                            <IconX size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <span className="bias-diff-tag">
                                        {fix.status === 'accepted' ? 'Applied' : 'Skipped'}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {!isJdStreaming && !isComplete && !isReadOnly && (
                    <div className="canvas-actions">
                        <button
                            className={`canvas-bias-link ${biasLink.cls}`}
                            onClick={handleCheckBias}
                            disabled={biasLink.disabled || isBusy}
                        >
                            {biasLink.icon}
                            <span>{biasLink.label}</span>
                        </button>
                        <div className="canvas-actions-spacer" />
                        <button
                            className="btn-ghost"
                            onClick={handleSaveDraft}
                            disabled={isBusy || !hasUnsavedChanges}
                        >
                            {draftSaved || !hasUnsavedChanges ? (
                                <>
                                    <IconCheck size={14} /> Draft saved
                                </>
                            ) : (
                                'Save draft'
                            )}
                        </button>
                        <button
                            className="btn-primary"
                            onClick={() => setShowModal(true)}
                            disabled={isBusy}
                        >
                            Finalize JD <IconArrowRight size={14} />
                        </button>
                    </div>
                )}

                {isComplete && (
                    <div className="canvas-actions">
                        <div className="canvas-actions-spacer" />
                        <span className="canvas-bias-link canvas-bias-link--ok" style={{ cursor: 'default' }}>
                            <IconSparkles size={14} /> Position saved · sourcing active
                        </span>
                    </div>
                )}
            </div>

            <PositionSetupModal show={showModal} onClose={() => setShowModal(false)} />
        </>
    );
};

export default FinalJDCard;
