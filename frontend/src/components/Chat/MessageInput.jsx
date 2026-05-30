import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { IconPaperclip, IconSend, IconLoader } from './icons';

const MessageInput = () => {
    const { sendMessage, isStreaming, workflowStage, currentSessionId, finalJdMarkdown } = useChat();
    const [input, setInput] = useState('');
    const [fileUploading, setFileUploading] = useState(false);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const isComplete = workflowStage === 'complete';
    const isDisabled = isStreaming || fileUploading;

    const getPlaceholder = () => {
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
            alert('File too large. Maximum 10MB.');
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
                alert('Could not read this file. Please try a different PDF or paste the JD as text.');
            }
        } catch (err) {
            console.error('File upload error:', err);
            alert('Upload failed. Please try again.');
        } finally {
            setFileUploading(false);
            e.target.value = '';
        }
    };

    const canSend = Boolean(input.trim()) && !isDisabled && !isComplete;

    return (
        <div className="composer">
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
                <div className="composer-foot">
                    <span>
                        <span className="composer-foot-key">Enter</span> to send · <span className="composer-foot-key">Shift</span>+<span className="composer-foot-key">Enter</span> for a new line
                    </span>
                    <span>AI Talent Lab can make mistakes — verify requirements.</span>
                </div>
            </div>
        </div>
    );
};

export default MessageInput;
