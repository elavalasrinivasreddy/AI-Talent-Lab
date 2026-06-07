import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { IconPaperclip, IconSend, IconLoader } from './icons';
import Toast from '../common/Toast';

const MessageInput = () => {
    const { sendMessage, isStreaming, workflowStage, currentSessionId, finalJdMarkdown, isReadOnly } = useChat();
    const [input, setInput] = useState('');
    const [fileUploading, setFileUploading] = useState(false);
    const [toast, setToast] = useState(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const isComplete = workflowStage === 'complete';
    const isDisabled = isStreaming || fileUploading || isReadOnly;

    const getPlaceholder = () => {
        if (isReadOnly) return 'Chat is locked. Position is under review or open.';
        if (isComplete) return 'Position saved — manage it from the dashboard.';
        if (isStreaming) return 'AI is thinking…';
        if (workflowStage === 'intake') return 'Describe the role you want to hire for…';
        return 'Reply or refine…';
    };

    const handleSend = () => {
        if (!input.trim() || isDisabled || isComplete) return;
        const text = input.trim();

        const canRewriteSection =
            Boolean(finalJdMarkdown) &&
            (workflowStage === 'final_jd' || workflowStage === 'bias_check');

        if (canRewriteSection) {
            sendMessage({
                action: 'rewrite_section',
                section: null,
                instruction: text,
                message: text,
            });
        } else if (workflowStage === 'jd_variants') {
            sendMessage({
                action: 'regenerate_variants',
                refinement: text,
                message: text,
            });
        } else {
            sendMessage({ message: text });
        }

        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const triggerFileUpload = () => fileInputRef.current?.click();

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setToast({ message: 'File too large. Maximum 10MB.', type: 'error' });
            return;
        }

        setFileUploading(true);

        try {
            if (!currentSessionId) {
                setInput(`I've uploaded a reference JD (${file.name}). Please use it to extract requirements.`);
                setFileUploading(false);
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`/api/v1/chat/sessions/${currentSessionId}/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: formData,
            });

            if (response.ok) {
                setInput(`I've uploaded a reference JD (${file.name}). Please use it to extract requirements.`);
            } else {
                setToast({ message: 'Could not read this file. Please try a different PDF or paste the JD as text.', type: 'error' });
            }
        } catch (err) {
            console.error('File upload error:', err);
            setToast({ message: 'Upload failed. Please try again.', type: 'error' });
        } finally {
            setFileUploading(false);
            e.target.value = '';
        }
    };

    const canSend = Boolean(input.trim()) && !isDisabled && !isComplete;

    return (
        <div className="composer">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="composer-inner">
                <div className="composer-shell">
                    <textarea
                        ref={textareaRef}
                        className="composer-textarea"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={getPlaceholder()}
                        disabled={isDisabled || isComplete}
                        rows={1}
                        aria-label="Message"
                    />
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileUpload}
                    />
                    <div className="composer-actions">
                        <button
                            type="button"
                            className="icon-btn"
                            title="Attach a reference JD (PDF / DOCX)"
                            aria-label="Attach a reference JD"
                            onClick={triggerFileUpload}
                            disabled={isDisabled || isComplete}
                        >
                            {fileUploading ? <IconLoader size={16} /> : <IconPaperclip size={16} />}
                        </button>
                        <button
                            type="button"
                            className="composer-send"
                            aria-label="Send"
                            onClick={handleSend}
                            disabled={!canSend}
                        >
                            {isStreaming ? <IconLoader size={14} /> : <IconSend size={14} />}
                        </button>
                    </div>
                </div>
                <div className="composer-foot" style={{ fontSize: '10px', opacity: 0.7, display: 'flex', justifyContent: 'space-between', padding: '2px 10px 0 10px' }}>
                    <span><kbd style={{ background: 'var(--color-bg-secondary)', padding: '2px 4px', borderRadius: '3px' }}>Enter</kbd> to send</span>
                    <span>AI Talent Lab can make mistakes.</span>
                </div>
            </div>
        </div>
    );
};

export default MessageInput;
