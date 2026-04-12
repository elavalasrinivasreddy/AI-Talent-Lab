// App.jsx – Root application with auth-protected routing
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationBell from './components/Notifications/NotificationBell';
import LoginPage from './components/Auth/LoginPage';
import RegisterPage from './components/Auth/RegisterPage';
import Sidebar from './components/Sidebar/Sidebar';
import ChatWindow from './components/ChatWindow/ChatWindow';
import DashboardPage from './components/Dashboard/DashboardPage';
import SettingsPage from './components/Dashboard/SettingsPage';
import ApplyPage from './components/Apply/ApplyPage';

// Apply saved theme immediately on app load (before React renders)
function applyStoredTheme() {
    const mode = localStorage.getItem('themeMode') || 'dark';
    const getSystem = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const resolved = mode === 'system' ? getSystem() : mode;
    if (resolved === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

function AppContent() {
    const { isAuthenticated, user, logout } = useAuth();
    const [authView, setAuthView] = useState('login');
    const [currentPage, setCurrentPage] = useState('chat'); // chat | dashboard | settings

    // Apply theme on mount
    useEffect(() => { applyStoredTheme(); }, []);

    if (!isAuthenticated) {
        return authView === 'login'
            ? <LoginPage onSwitchToRegister={() => setAuthView('register')} />
            : <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <DashboardPage onNavigateChat={() => setCurrentPage('chat')} />;
            case 'settings':
                return <SettingsPage />;
            default:
                return <ChatWindow />;
        }
    };

    return (
        <NotificationProvider>
            <ChatProvider>
                <div className="app-bg">
                    <NotificationBell onNavigate={setCurrentPage} />
                    <div className="main-container">
                    <Sidebar
                        user={user}
                        onLogout={logout}
                        currentPage={currentPage}
                        onNavigate={setCurrentPage}
                    />
                    {renderPage()}
                </div>
            </div>
            </ChatProvider>
        </NotificationProvider>
    );
}

export default function App() {
    const path = window.location.pathname;
    
    // Bypass authentication for public apply page
    if (path.startsWith('/apply/')) {
        const token = path.split('/apply/')[1];
        if (token) {
            return <ApplyPage token={token} />;
        }
    }

    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

