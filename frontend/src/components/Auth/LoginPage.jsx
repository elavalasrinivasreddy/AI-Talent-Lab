// components/Auth/LoginPage.jsx
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

export default function LoginPage({ onSwitchToRegister }) {
    const { login, isLoading, error, clearError } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearError();
        try {
            await login(email, password);
        } catch (err) {
            // Error is handled in context
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-logo">🤖</div>
                    <h1 className="auth-title">AI Talent Lab</h1>
                    <p className="auth-subtitle">Sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error">{error}</div>}
                    
                    <div className="auth-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button type="submit" className="auth-btn" disabled={isLoading}>
                        {isLoading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>

                <div className="auth-footer">
                    <span>Don't have an account?</span>
                    <button className="auth-link" onClick={onSwitchToRegister}>
                        Create one
                    </button>
                </div>
            </div>
        </div>
    );
}
