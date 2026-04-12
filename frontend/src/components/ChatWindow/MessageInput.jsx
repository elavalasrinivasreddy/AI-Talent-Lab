// components/ChatWindow/MessageInput.jsx — with file upload button
import { useState, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { uploadFile } from '../../api/client';

export default function MessageInput() {
    const [text, setText] = useState('');
    const { sendMessage, isTyping, activeSessionId } = useChat();
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const handleSend = async () => {
        const trimmed = text.trim();
        if (!trimmed || isTyping || uploading) return;
        setText('');
        textareaRef.current.style.height = 'auto';
        await sendMessage(trimmed);
        textareaRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = (e) => {
        setText(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            // Upload file and get parsed text back
            let parsedText = '';
            if (activeSessionId) {
                const result = await uploadFile(activeSessionId, file);
                parsedText = result.parsed_text || '';
            }

            // Include the parsed JD text inline so the interviewer agent can analyze it
            const msg = parsedText
                ? `I have uploaded a reference JD: "${file.name}". Here is the content:\n\n${parsedText}\n\nPlease analyze this and extract the requirements.`
                : `I have uploaded a reference JD: "${file.name}". Please analyze it and use it as a reference for building the Job Description.`;
            await sendMessage(msg);
        } catch (err) {
            console.error('Upload error:', err);
            await sendMessage(`I wanted to upload a reference JD file named "${file.name}" but the upload failed. Let me describe the requirements instead.`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="input-area">
            <div className="input-row">
                {/* File upload button */}
                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".txt,.pdf,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                />
                <button
                    className="upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isTyping || uploading}
                    title="Upload existing JD (PDF/TXT)"
                >
                    {uploading ? '⏳' : '📎'}
                </button>

                <textarea
                    ref={textareaRef}
                    className="message-input"
                    placeholder="Describe the role you're hiring for… (Enter to send)"
                    value={text}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={isTyping || uploading}
                />
                <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={!text.trim() || isTyping || uploading}
                    title="Send message"
                >
                    ➤
                </button>
            </div>
            <div className="footer-tagline">
                Built with <span>♥</span> by{' '}
                <a href="https://github.com/elavala" target="_blank" rel="noopener noreferrer">
                    &nbsp;@elavala
                </a>
                &nbsp;· AI Talent Lab
            </div>
        </div>
    );
}
