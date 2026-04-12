import { useState, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { uploadFile } from '../../api/client';

export default function FileUploader() {
    const { activeSessionId, sendMessage } = useChat();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setError(null);
        try {
            await uploadFile(activeSessionId, file);
            setSuccess(true);
            // Automated message to trigger the bot to proceed
            sendMessage(`I have uploaded the reference JD: ${file.name}. Please proceed.`);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || "Failed to upload file.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    if (success) {
        return (
            <div style={{ margin: '8px 0 16px', padding: '12px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✅ Reference JD uploaded successfully
            </div>
        );
    }

    return (
        <div style={{ margin: '8px 0 16px', padding: '16px', border: '2px dashed var(--border-accent)', borderRadius: '12px', background: 'var(--bg-card)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                You can upload an existing Job Description as a reference (PDF or TXT).
            </p>
            <input
                type="file"
                accept=".txt,.pdf"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                >
                    {uploading ? 'Uploading...' : 'Upload Reference JD'}
                </button>
            </div>
            {error && <p style={{ margin: 0, color: 'var(--danger)', fontSize: '12px' }}>{error}</p>}
        </div>
    );
}
