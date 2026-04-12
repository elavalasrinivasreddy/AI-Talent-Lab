// components/Sidebar/ActiveRoles.jsx
import { useChat } from '../../context/ChatContext';

function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function ActiveRoles() {
    const { sessions, activeSessionId, loadSession, removeSession } = useChat();

    return (
        <div className="active-roles-section">
            <div className="section-label">Active Roles</div>
            <div className="roles-list">
                {sessions.length === 0 && (
                    <div className="roles-empty">
                        No active roles yet.<br />Click "New Hire" to start!
                    </div>
                )}
                {sessions.map(session => (
                    <div
                        key={session.id}
                        className={`role-item ${activeSessionId === session.id ? 'active' : ''}`}
                        onClick={() => loadSession(session.id)}
                    >
                        <div className="role-item-icon">💼</div>
                        <div className="role-item-text">
                            <div className="role-item-name" title={session.title}>{session.title}</div>
                            <div className="role-item-date">{timeAgo(session.updated_at || session.created_at)}</div>
                        </div>
                        <button
                            className="role-delete-btn"
                            onClick={(e) => removeSession(session.id, e)}
                            title="Delete session"
                        >
                            🗑
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
