import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';

const MessageInput = () => {
    const { sendMessage, isStreaming, workflowStage, currentSessionId } = useChat();
    const [input, setInput] = useState('');
    const [fileUploading, setFileUploading] = useState(false);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    // Disabled states per spec
    const isComplete = workflowStage === 'complete';
    const isDisabled = isStreaming || fileUploading;

    const getPlaceholder = () => {
        if (isComplete) return 'Position saved. Manage it in the dashboard.';
        if (isStreaming) return 'AI is thinking...';
        return 'Type your requirements here...';
    };

    const handleSend = () => {
        if (!input.trim() || isDisabled || isComplete) return;
        sendMessage({ message: input.trim() });
        setInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const triggerFileUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // File size check (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            alert("File too large. Maximum 10MB.");
            return;
        }

        setFileUploading(true);

        try {
            // If no session yet, just prefill the input with file name
            if (!currentSessionId) {
                setInput(`I've uploaded a reference JD (${file.name}). Please use it to extract requirements.`);
                setFileUploading(false);
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`/api/v1/chat/sessions/${currentSessionId}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (response.ok) {
                setInput(`I've uploaded a reference JD (${file.name}). Please use it to extract requirements.`);
            } else {
                alert("Could not read this file. Please try a different PDF or paste the JD as text.");
            }
        } catch (err) {
            console.error("File upload error:", err);
            alert("Upload failed. Please try again.");
        } finally {
            setFileUploading(false);
            e.target.value = '';
        }
    };

    return (
        <div className="chat-input-container">
            <div className="chat-input-wrapper">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={getPlaceholder()}
                    disabled={isDisabled || isComplete}
                    rows={1}
                />

                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileUpload}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 var(--space-2)' }}>
                    <button
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            fontSize: '1.2rem',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            padding: 4,
                            opacity: isDisabled ? 0.4 : 1
                        }}
                        title="Upload Reference JD (PDF/DOCX)"
                        onClick={triggerFileUpload}
                        disabled={isDisabled}
                    >
                        {fileUploading ? '⏳' : '📎'}
                    </button>

                    <button
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: input.trim() && !isDisabled ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
                            color: input.trim() && !isDisabled ? '#fff' : 'var(--color-text-muted)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: input.trim() && !isDisabled ? 'pointer' : 'not-allowed',
                            transition: 'all var(--transition-fast)',
                            flexShrink: 0
                        }}
                        onClick={handleSend}
                        disabled={!input.trim() || isDisabled}
                    >
                        {isStreaming ? (
                            <span style={{ fontSize: '0.7rem' }}>⏳</span>
                        ) : (
                            <span style={{ fontSize: '1rem', marginLeft: -1 }}>➤</span>
                        )}
                    </button>
                </div>
            </div>
            <div style={{
                textAlign: 'center',
                marginTop: 'var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-muted)',
                padding: '0 var(--space-3)'
            }}>
                Press Enter to send, Shift+Enter for new line. AI Talent Lab can make mistakes — verify requirements.
            </div>
        </div>
    );
};

export default MessageInput;
