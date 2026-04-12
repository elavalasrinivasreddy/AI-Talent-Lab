import { useChat } from '../../context/ChatContext';

export default function ChatTopBar() {
    const { chatTitle, titleAnimating, activeSessionId } = useChat();

    return (
        <div className="chat-topbar">
            <div className="chat-title">
                {chatTitle ? (
                    <>
                        <span>💼</span>
                        {chatTitle}
                        {titleAnimating && <span className="typing-cursor" />}
                    </>
                ) : (
                    <span className="chat-title-placeholder">
                        {activeSessionId ? 'Loading...' : 'Start a new hire conversation'}
                    </span>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {chatTitle && (
                    <span className="chat-title-badge">Active</span>
                )}
            </div>
        </div>
    );
}
