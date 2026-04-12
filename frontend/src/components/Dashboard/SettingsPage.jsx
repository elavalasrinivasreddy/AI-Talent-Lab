// components/Dashboard/SettingsPage.jsx — Org settings, user management, profile
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function SettingsPage() {
    const { user, token } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [activeTab, setActiveTab] = useState('profile');

    // --- Profile state (initialize from auth user immediately) ---
    const [profile, setProfile] = useState(user ? {
        name: user.name,
        email: user.email,
        role: user.role,
        org_name: user.org_name,
    } : null);

    // --- Add user state ---
    const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'recruiter' });
    const [addUserResult, setAddUserResult] = useState(null);
    const [addUserLoading, setAddUserLoading] = useState(false);

    const [teamMembers, setTeamMembers] = useState([]);
    const [teamSearch, setTeamSearch] = useState('');

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    useEffect(() => {
        if (!token) return;
        fetch(`${BASE_URL}/api/auth/me`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        })
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(setProfile)
            .catch(err => console.error('Failed to load profile:', err));
    }, [token]);

    useEffect(() => {
        if (!token || activeTab !== 'users' || !isAdmin) return;
        fetch(`${BASE_URL}/api/auth/users`, { headers })
            .then(r => r.json())
            .then(data => setTeamMembers(data.users || []))
            .catch(err => console.error('Failed to load users:', err));
    }, [token, activeTab, isAdmin, addUserResult]); // Reload if addUserResult changes

    const handleAddUser = async (e) => {
        e.preventDefault();
        setAddUserLoading(true);
        setAddUserResult(null);
        try {
            const res = await fetch(`${BASE_URL}/api/auth/add-user`, {
                method: 'POST', headers, body: JSON.stringify(newUser),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed');
            setAddUserResult({ success: true, message: `User "${data.user.name}" added successfully as ${data.user.role}` });
            setNewUser({ email: '', password: '', name: '', role: 'recruiter' });
        } catch (err) {
            setAddUserResult({ success: false, message: err.message });
        } finally {
            setAddUserLoading(false);
        }
    };

    // --- Theme state ---
    const getSystemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const [themeMode, setThemeMode] = useState(() => localStorage.getItem('themeMode') || 'dark');

    const applyTheme = useCallback((mode) => {
        const resolved = mode === 'system' ? getSystemTheme() : mode;
        if (resolved === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
    }, []);

    useEffect(() => {
        applyTheme(themeMode);
        localStorage.setItem('themeMode', themeMode);

        // Listen for system theme changes when in 'system' mode
        if (themeMode === 'system') {
            const mql = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = () => applyTheme('system');
            mql.addEventListener('change', handler);
            return () => mql.removeEventListener('change', handler);
        }
    }, [themeMode, applyTheme]);

    const tabs = [
        { id: 'profile', label: '👤 Profile', show: true },
        { id: 'organization', label: '🏢 Organization', show: true },
        { id: 'users', label: '👥 Team Members', show: isAdmin },
        { id: 'appearance', label: '🎨 Appearance', show: true },
    ];

    return (
        <div className="dashboard settings-page">
            <div className="dashboard__header">
                <div>
                    <h1 className="dashboard__title">⚙️ Settings</h1>
                    <p className="dashboard__subtitle">Manage your account and organization</p>
                </div>
            </div>

            <div className="settings__layout">
                {/* Tabs sidebar */}
                <div className="settings__tabs">
                    {tabs.filter(t => t.show).map(tab => (
                        <button
                            key={tab.id}
                            className={`settings__tab ${activeTab === tab.id ? 'settings__tab--active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="settings__content">
                    {activeTab === 'profile' && (
                        <div className="settings__card">
                            <h2>Your Profile</h2>
                            {profile ? (
                                <div className="settings__fields">
                                    <div className="settings__field">
                                        <label>Name</label>
                                        <input type="text" value={profile.name || ''} readOnly />
                                    </div>
                                    <div className="settings__field">
                                        <label>Email</label>
                                        <input type="email" value={profile.email || ''} readOnly />
                                    </div>
                                    <div className="settings__field">
                                        <label>Role</label>
                                        <input type="text" value={profile.role || ''} readOnly className="capitalize" />
                                    </div>
                                    <div className="settings__field">
                                        <label>Organization</label>
                                        <input type="text" value={profile.org_name || ''} readOnly />
                                    </div>
                                </div>
                            ) : (
                                <p className="settings__loading">Loading profile...</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'organization' && (
                        <div className="settings__card">
                            <h2>Organization Details</h2>
                            <p className="settings__hint">Organization profile is used in the "About Us" section of generated JDs.</p>
                            <div className="settings__fields">
                                <div className="settings__field">
                                    <label>Organization Name</label>
                                    <input type="text" value={user?.org_name || ''} readOnly />
                                </div>
                                <div className="settings__field">
                                    <label>About Us (for JDs)</label>
                                    <textarea rows={5} placeholder="Describe your organization for JD generation..." defaultValue="" />
                                </div>
                                <button className="settings__save-btn" disabled>
                                    Save Changes (Coming Soon)
                                </button>
                            </div>
                        </div>
                    )}


                    {activeTab === 'users' && isAdmin && (
                        <div className="settings__card settings__card--users">
                            <h2>Team Directory</h2>
                            <p className="settings__hint">Manage users within your organization.</p>
                            
                            <input
                                type="text"
                                className="settings__search-input"
                                placeholder="Search by name or email..."
                                value={teamSearch}
                                onChange={e => setTeamSearch(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
                            />

                            <div className="settings__table-wrapper" style={{ overflowX: 'auto', marginBottom: '2rem' }}>
                                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '0.75rem' }}>Name</th>
                                            <th style={{ padding: '0.75rem' }}>Email</th>
                                            <th style={{ padding: '0.75rem' }}>Role</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teamMembers
                                            .filter(u => u.name.toLowerCase().includes(teamSearch.toLowerCase()) || u.email.toLowerCase().includes(teamSearch.toLowerCase()))
                                            .map(u => (
                                            <tr key={u.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                <td style={{ padding: '0.75rem' }}>{u.name}</td>
                                                <td style={{ padding: '0.75rem' }}>{u.email}</td>
                                                <td style={{ padding: '0.75rem', textTransform: 'capitalize' }}>
                                                    <span className={`status-badge ${u.role === 'admin' ? 'applied' : 'sourced'}`}>{u.role.replace('_', ' ')}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <h2>Add Team Member</h2>
                            <p className="settings__hint">Add recruiters or hiring managers to your organization.</p>
                            <form onSubmit={handleAddUser} className="settings__fields">
                                <div className="settings__field">
                                    <label>Name</label>
                                    <input
                                        type="text" required value={newUser.name}
                                        onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="settings__field">
                                    <label>Email</label>
                                    <input
                                        type="email" required value={newUser.email}
                                        onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                                        placeholder="john@company.com"
                                    />
                                </div>
                                <div className="settings__field">
                                    <label>Password</label>
                                    <input
                                        type="password" required minLength={6} value={newUser.password}
                                        onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div className="settings__field">
                                    <label>Role</label>
                                    <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                                        <option value="recruiter">Recruiter</option>
                                        <option value="hiring_manager">Hiring Manager</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                {addUserResult && (
                                    <div className={`settings__result ${addUserResult.success ? 'settings__result--success' : 'settings__result--error'}`}>
                                        {addUserResult.message}
                                    </div>
                                )}
                                <button type="submit" className="settings__save-btn" disabled={addUserLoading}>
                                    {addUserLoading ? 'Adding...' : '+ Add User'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="settings__card">
                            <h2>Appearance</h2>
                            <p className="settings__hint">Choose your preferred theme for the interface.</p>
                            <div className="settings__theme-options">
                                {[
                                    { id: 'light', label: '☀️ Light', desc: 'Clean white interface' },
                                    { id: 'dark', label: '🌙 Dark', desc: 'Dark mode (default)' },
                                    { id: 'system', label: '💻 System', desc: 'Follow OS setting' },
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        className={`settings__theme-btn ${themeMode === opt.id ? 'settings__theme-btn--active' : ''}`}
                                        onClick={() => setThemeMode(opt.id)}
                                    >
                                        <span className="settings__theme-icon">{opt.label.split(' ')[0]}</span>
                                        <span className="settings__theme-label">{opt.label.split(' ').slice(1).join(' ')}</span>
                                        <span className="settings__theme-desc">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
