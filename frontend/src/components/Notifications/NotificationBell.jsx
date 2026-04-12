import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useChat } from '../../context/ChatContext';
import './Notification.css';

function timeAgo(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell({ onNavigate }) {
    const { unreadCount, notifications, markAsRead } = useNotifications();
    const { loadSession } = useChat();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleNotificationClick = (n) => {
        markAsRead(n.id);
        if (n.session_id) {
            loadSession(n.session_id);
            if (onNavigate) {
                onNavigate('chat');
            }
        }
        setIsOpen(false);
    };

    return (
        <div className="notification-bell-container" ref={dropdownRef}>
            <button className="notification-bell-btn" onClick={() => setIsOpen(!isOpen)}>
                🔔
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    <div className="notification-header">
                        <h3>Notifications</h3>
                    </div>
                    <div className="notification-list">
                        {notifications.length === 0 ? (
                            <div className="notification-empty">No unread notifications</div>
                        ) : (
                            notifications.map(n => (
                                <div key={n.id} className="notification-item" onClick={() => handleNotificationClick(n)}>
                                    <div className="notification-item-title">{n.title}</div>
                                    <div className="notification-item-message">{n.message}</div>
                                    <div className="notification-item-time">{timeAgo(n.created_at)}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
