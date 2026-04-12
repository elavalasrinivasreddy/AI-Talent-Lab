import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/client';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
    const { token } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!token) return;
        try {
            const res = await api.get('/api/notifications');
            setNotifications(res.data.notifications);
            setUnreadCount(res.data.count);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    }, [token]);

    // Poll every 30 seconds
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markAsRead = async (notificationId) => {
        try {
            await api.patch(`/api/notifications/${notificationId}/read`);
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark notification read:', err);
        }
    };

    const markSessionAsRead = async (sessionId) => {
        try {
            await api.patch(`/api/notifications/session/${sessionId}/read`);
            setNotifications(prev => prev.filter(n => n.session_id !== sessionId));
            // Recalculate count
            setUnreadCount(prev => notifications.filter(n => n.session_id !== sessionId).length);
        } catch (err) {
            console.error('Failed to mark session notifications read:', err);
        }
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markSessionAsRead, fetchNotifications }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => useContext(NotificationContext);
