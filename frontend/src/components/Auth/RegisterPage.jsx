// components/Auth/RegisterPage.jsx
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

export default function RegisterPage({ onSwitchToLogin }) {
    const { register, isLoading, error, clearError } = useAuth();
    const [form, setForm] = useState({
        org_name: '',
        name: '',
        email: '',
        password: '',
        segment: 'Technology',
        size: 'startup',
        website: '',
    });

    const handleChange = (field) => (e) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearError();
        try {
            await register(form);
        } catch (err) {
            // Error is handled in context
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card auth-card--register">
                <div className="auth-header">
                    <div className="auth-logo">🤖</div>
                    <h1 className="auth-title">AI Talent Lab</h1>
                    <p className="auth-subtitle">Create your organization account</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error">{error}</div>}

                    <div className="auth-row">
                        <div className="auth-field">
                            <label htmlFor="org_name">Organization Name</label>
                            <input
                                id="org_name"
                                type="text"
                                value={form.org_name}
                                onChange={handleChange('org_name')}
                                placeholder="Acme Corp"
                                required
                            />
                        </div>
                        <div className="auth-field">
                            <label htmlFor="segment">Industry Segment</label>
                            <select id="segment" value={form.segment} onChange={handleChange('segment')}>
                                <option value="Technology">Technology</option>
                                <option value="Healthcare">Healthcare</option>
                                <option value="Finance">Finance</option>
                                <option value="Manufacturing">Manufacturing</option>
                                <option value="Retail">Retail</option>
                                <option value="Education">Education</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="auth-row">
                        <div className="auth-field">
                            <label htmlFor="name">Your Name</label>
                            <input
                                id="name"
                                type="text"
                                value={form.name}
                                onChange={handleChange('name')}
                                placeholder="John Doe"
                                required
                            />
                        </div>
                        <div className="auth-field">
                            <label htmlFor="size">Company Size</label>
                            <select id="size" value={form.size} onChange={handleChange('size')}>
                                <option value="startup">Startup (1-50)</option>
                                <option value="smb">SMB (51-500)</option>
                                <option value="enterprise">Enterprise (500+)</option>
                            </select>
                        </div>
                    </div>

                    <div className="auth-field">
                        <label htmlFor="reg-email">Email</label>
                        <input
                            id="reg-email"
                            type="email"
                            value={form.email}
                            onChange={handleChange('email')}
                            placeholder="admin@company.com"
                            required
                        />
                    </div>

                    <div className="auth-row">
                        <div className="auth-field">
                            <label htmlFor="reg-password">Password</label>
                            <input
                                id="reg-password"
                                type="password"
                                value={form.password}
                                onChange={handleChange('password')}
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="auth-field">
                            <label htmlFor="website">Website (optional)</label>
                            <input
                                id="website"
                                type="url"
                                value={form.website}
                                onChange={handleChange('website')}
                                placeholder="https://company.com"
                            />
                        </div>
                    </div>

                    <button type="submit" className="auth-btn" disabled={isLoading}>
                        {isLoading ? 'Creating account…' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer">
                    <span>Already have an account?</span>
                    <button className="auth-link" onClick={onSwitchToLogin}>
                        Sign in
                    </button>
                </div>
            </div>
        </div>
    );
}
