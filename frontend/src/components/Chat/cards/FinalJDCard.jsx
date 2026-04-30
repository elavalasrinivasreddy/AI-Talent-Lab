import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../../context/ChatContext';
import PositionSetupModal from '../PositionSetupModal';

const FinalJDCard = ({ markdown, isStreaming }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedMarkdown, setEditedMarkdown] = useState(markdown);
    const [copyLabel, setCopyLabel] = useState('Copy');
    const [showModal, setShowModal] = useState(false);
    const { sessionTitle } = useChat();

    // Sync with incoming markdown (streaming updates)
    useEffect(() => {
        if (!isEditing) {
            setEditedMarkdown(markdown);
        }
    }, [markdown, isEditing]);

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

    return (
        <>
            <div className="chat-card mb-3" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                <div className="chat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                        📄 Your Job Description
                        {isStreaming && <span className="blinking-cursor" style={{ marginLeft: 4 }}>▌</span>}
                    </span>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                            className="btn btn-sm"
                            style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
                            onClick={handleCopy}
                            title="Copy to Clipboard"
                        >
                            📋 {copyLabel}
                        </button>
                        <button
                            className="btn btn-sm"
                            style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
                            onClick={handleDownloadMD}
                            title="Download Markdown"
                        >
                            📥 .md
                        </button>
                        <button
                            className="btn btn-sm"
                            style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
                            onClick={handleDownloadPDF}
                            title="Download PDF"
                        >
                            📥 PDF
                        </button>
                        <button
                            className="btn btn-sm"
                            style={{
                                fontSize: 'var(--font-size-sm)',
                                color: isEditing ? 'var(--color-success)' : 'var(--color-primary)',
                                border: `1px solid ${isEditing ? 'var(--color-success)' : 'var(--color-primary)'}`,
                                borderRadius: 'var(--radius-md)'
                            }}
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            {isEditing ? '✅ Done' : '✏️ Edit'}
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: 'var(--space-3)' }}>
                    {isEditing ? (
                        <textarea
                            style={{
                                width: '100%',
                                minHeight: 400,
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'var(--font-size-sm)',
                                background: 'var(--color-bg-input)',
                                color: 'var(--color-text-primary)',
                                border: '1px solid var(--color-border-focus)',
                                borderRadius: 'var(--radius-sm)',
                                padding: 'var(--space-3)',
                                resize: 'vertical'
                            }}
                            value={editedMarkdown}
                            onChange={(e) => setEditedMarkdown(e.target.value)}
                        />
                    ) : (
                        <div
                            className="jd-preview"
                            style={{
                                padding: 'var(--space-4)',
                                background: 'var(--color-bg-secondary)',
                                borderRadius: 'var(--radius-sm)',
                                maxHeight: 600,
                                overflowY: 'auto',
                                border: '1px solid var(--color-border-light)'
                            }}
                        >
                            <ReactMarkdown>{editedMarkdown}</ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Action buttons — only shown when JD is complete (not streaming) */}
                {!isStreaming && (
                    <div style={{
                        marginTop: 'var(--space-4)',
                        display: 'flex',
                        gap: 'var(--space-3)',
                        flexWrap: 'wrap',
                        paddingTop: 'var(--space-3)',
                        borderTop: '1px solid var(--color-border-light)'
                    }}>
                        <button
                            className="btn btn-sm"
                            style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-text-secondary)',
                                padding: '8px 16px'
                            }}
                            onClick={handleDownloadMD}
                        >
                            💾 Save as Draft
                        </button>
                        <button
                            className="btn btn-sm"
                            style={{
                                background: 'var(--color-primary)',
                                color: '#fff',
                                borderRadius: 'var(--radius-md)',
                                padding: '8px 20px',
                                fontWeight: 600,
                                boxShadow: 'var(--shadow-glow-primary)'
                            }}
                            onClick={() => setShowModal(true)}
                        >
                            🚀 Save & Find Candidates
                        </button>
                    </div>
                )}
            </div>

            <PositionSetupModal show={showModal} onClose={() => setShowModal(false)} />
        </>
    );
};

export default FinalJDCard;
