// components/Sidebar/Sidebar.jsx
import { useEffect, useState, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useNotifications } from '../../context/NotificationContext';
import ProductBrand from './ProductBrand';
import NewHireButton from './NewHireButton';

function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function SessionItem({ session, isActive, hasUnread, onClick, onRename, onDelete }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(session.title);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMenuClick = (e) => {
        e.stopPropagation();
        setIsMenuOpen(!isMenuOpen);
    };

    const handleRenameClick = (e) => {
        e.stopPropagation();
        setIsEditing(true);
        setIsMenuOpen(false);
    };

    const handleDeleteClick = (e) => {
        e.stopPropagation();
        onDelete(session.id, e);
        setIsMenuOpen(false);
    };

    const handleRenameSubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (editTitle.trim() && editTitle !== session.title) {
            onRename(session.id, editTitle);
        }
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className={`role-item ${isActive ? 'active' : ''}`} style={{ padding: '8px' }}>
                <form onSubmit={handleRenameSubmit} style={{ display: 'flex', width: '100%', gap: '8px' }}>
                    <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        onBlur={handleRenameSubmit}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            flex: 1,
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '0.85rem'
                        }}
                    />
                </form>
            </div>
        );
    }

    return (
        <div
            className={`role-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread-session' : ''}`}
            onClick={() => onClick(session.id)}
        >
            <div className="role-item-icon" style={{ position: 'relative' }}>
                💼
                {hasUnread && <div className="session-unread-dot" />}
            </div>
            <div className="role-item-text">
                <div className="role-item-name" title={session.title}>{session.title}</div>
                <div className="role-item-date">{timeAgo(session.updated_at || session.created_at)}</div>
            </div>
            
            <div className="session-menu-container" ref={menuRef} style={{ position: 'relative' }}>
                <button
                    className="session-menu-btn"
                    onClick={handleMenuClick}
                    title="Options"
                    style={{
                        background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px'
                    }}
                >
                    ⋮
                </button>
                {isMenuOpen && (
                    <div className="session-dropdown" style={{
                        position: 'absolute', right: 0, top: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: '6px', zIndex: 10, padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '100px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}>
                        <button onClick={handleRenameClick} style={{
                            background: 'transparent', border: 'none', color: 'var(--text)', textAlign: 'left', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem'
                        }} className="dropdown-item">Rename</button>
                        <button onClick={handleDeleteClick} style={{
                            background: 'transparent', border: 'none', color: '#ff4d4d', textAlign: 'left', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem'
                        }} className="dropdown-item">Delete</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Sidebar({ user, onLogout, currentPage, onNavigate }) {
    const { sessions, activeSessionId, loadSession, removeSession, renameSession, loadSessions, startNewChat } = useChat();
    const { notifications, markSessionAsRead } = useNotifications();

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleNewHire = () => {
        startNewChat();
        onNavigate('chat');
    };

    const handleSessionClick = (sessionId) => {
        loadSession(sessionId);
        onNavigate('chat');
        if (notifications.some(n => n.session_id === sessionId)) {
            markSessionAsRead(sessionId);
        }
    };

    const displaySessions = sessions.slice(0, 10);

    return (
        <aside className="sidebar">
            <ProductBrand />
            <div className="divider" />
            <NewHireButton onClick={handleNewHire} />
            <div className="divider" />

            {/* Chat History (top section, max 10) */}
            <div className="sidebar-history">
                <div className="section-label">Recent Chats</div>
                <div className="roles-list">
                    {displaySessions.length === 0 && (
                        <div className="roles-empty">
                            No chats yet.<br />Click "New Hire" to start!
                        </div>
                    )}
                    {displaySessions.map(session => (
                        <SessionItem
                            key={session.id}
                            session={session}
                            isActive={activeSessionId === session.id && currentPage === 'chat'}
                            hasUnread={notifications.some(n => n.session_id === session.id)}
                            onClick={handleSessionClick}
                            onRename={renameSession}
                            onDelete={removeSession}
                        />
                    ))}
                </div>
            </div>

            {/* Spacer to push nav + user to bottom */}
            <div className="sidebar-spacer" />

            {/* Navigation — Dashboard & Settings only */}
            <nav className="sidebar-nav">
                <button
                    className={`sidebar-nav__item ${currentPage === 'dashboard' ? 'sidebar-nav__item--active' : ''}`}
                    onClick={() => onNavigate('dashboard')}
                >
                    <span>📊</span> Dashboard
                </button>
                <button
                    className={`sidebar-nav__item ${currentPage === 'settings' ? 'sidebar-nav__item--active' : ''}`}
                    onClick={() => onNavigate('settings')}
                >
                    <span>⚙️</span> Settings
                </button>
            </nav>

            {/* Divider before user profile */}
            <div className="divider" />

            {/* User Profile Section */}
            <div className="sidebar-user">
                <div className="sidebar-user__info">
                    <div className="sidebar-user__avatar">
                        {(user?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="sidebar-user__details">
                        <span className="sidebar-user__name">{user?.name || 'User'}</span>
                        <span className="sidebar-user__role">{user?.role || 'recruiter'} · {user?.org_name || ''}</span>
                    </div>
                </div>
                <button className="sidebar-user__logout" onClick={onLogout} title="Sign out">
                    ↪
                </button>
            </div>
        </aside>
    );
}
