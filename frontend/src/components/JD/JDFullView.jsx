// components/JD/JDFullView.jsx
// Rendered markdown JD with edit mode, direct download (PDF + Markdown)
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../context/ChatContext';

export default function JDFullView({ jdFromMessage, isStreamingJD }) {
    const { fullJD, setFullJD, chatTitle, activeSessionId } = useChat();
    const jdContent = fullJD || jdFromMessage;
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const [saved, setSaved] = useState(false);

    if (!jdContent && jdContent !== '') return null;

    const getFileName = (ext) => {
        const title = (chatTitle || 'job-description').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
        const now = new Date();
        const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}_${String(now.getMinutes()).padStart(2, '0')}`;
        return `${title}_${dateStr}.${ext}`;
    };

    const startEdit = () => {
        setEditText(jdContent);
        setIsEditing(true);
    };

    const saveEdit = async () => {
        setFullJD(editText);
        setIsEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);

        // Persist to backend
        if (activeSessionId) {
            try {
                const { saveJD } = await import('../../api/client');
                await saveJD(activeSessionId, editText);
            } catch (e) {
                console.error('Failed to save JD to backend:', e);
            }
        }
    };

    const cancelEdit = () => {
        setIsEditing(false);
    };

    const downloadMarkdown = () => {
        const blob = new Blob([jdContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getFileName('md');
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadPDF = async () => {
        // Use a hidden iframe to render and print to PDF directly
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${chatTitle || 'Job Description'}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 24px auto; padding: 0 30px; color: #1a1a2e; line-height: 1.7; font-size: 13px; }
                    h1 { font-size: 24px; color: #0f172a; border-bottom: 2px solid #6366f1; padding-bottom: 8px; margin-top: 0; }
                    h2 { font-size: 18px; color: #1e293b; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
                    h3 { font-size: 15px; color: #334155; margin-top: 18px; }
                    h4 { font-size: 14px; color: #475569; }
                    ul, ol { padding-left: 20px; }
                    li { margin: 4px 0; }
                    strong { color: #0f172a; }
                    p { margin: 8px 0; }
                    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
                    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 12px; }
                    th { background: #f1f5f9; font-weight: 600; }
                    @page { margin: 1cm; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>${markdownToHTML(jdContent)}</body>
            </html>
        `;

        // Create a hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        iframe.contentDocument.open();
        iframe.contentDocument.write(htmlContent);
        iframe.contentDocument.close();

        // Wait for fonts to load, then trigger print (which allows "Save as PDF")
        iframe.onload = () => {
            setTimeout(() => {
                iframe.contentWindow.print();
                setTimeout(() => document.body.removeChild(iframe), 1000);
            }, 500);
        };
    };

    return (
        <div className="jd-fullview">
            <div className="jd-fullview__header">
                <div className="jd-fullview__title">
                    <span className="jd-fullview__icon">📄</span>
                    Final Job Description
                    {isStreamingJD && <span className="jd-fullview__streaming">Generating…</span>}
                    {saved && <span className="jd-fullview__saved">✓ Saved</span>}
                </div>
                {!isStreamingJD && (
                    <div className="jd-fullview__actions">
                        {!isEditing ? (
                            <>
                                <button className="jd-action-btn jd-action-btn--edit" onClick={startEdit} title="Edit">
                                    ✏️ Edit
                                </button>
                                <button className="jd-action-btn jd-action-btn--download" onClick={downloadMarkdown} title="Download Markdown">
                                    📥 Markdown
                                </button>
                                <button className="jd-action-btn jd-action-btn--pdf" onClick={downloadPDF} title="Save as PDF">
                                    📄 PDF
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="jd-action-btn jd-action-btn--save" onClick={saveEdit}>
                                    ✅ Save
                                </button>
                                <button className="jd-action-btn jd-action-btn--cancel" onClick={cancelEdit}>
                                    ✕ Cancel
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {isEditing ? (
                <textarea
                    className="jd-fullview__editor"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    spellCheck={true}
                />
            ) : (
                <div className="jd-fullview__rendered">
                    <ReactMarkdown>{jdContent}</ReactMarkdown>
                    {isStreamingJD && <span className="typing-cursor" />}
                </div>
            )}
        </div>
    );
}

// Enhanced markdown → HTML converter for PDF
function markdownToHTML(md) {
    return md
        .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        .replace(/^\* (.*$)/gm, '<li>$1</li>')
        .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
        .replace(/<\/ul>\s*<ul>/g, '')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/^(?!<[hulo])/gm, '<p>')
        .replace(/(?<![>])$/gm, '</p>')
        .replace(/<p><\/p>/g, '')
        .replace(/<p>(<[hulo])/g, '$1')
        .replace(/(<\/[hulo][^>]*>)<\/p>/g, '$1');
}
