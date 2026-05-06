import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

/**
 * PositionSetupModal — full-screen overlay modal for completing a position.
 * Uses React Portal to render on top of everything (not inside chat scroll).
 */
const PositionSetupModal = ({ show, onClose }) => {
    const { token } = useAuth();
    const { currentSessionId, fetchSessions } = useChat();
    const navigate = useNavigate();

    const [departments, setDepartments] = useState([]);
    const [formData, setFormData] = useState({
        department_id: '',
        headcount: 1,
        priority: 'normal',
        ats_threshold: 80.0,
        search_interval_hours: 24,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!show) return;
        setError(null);
        setSuccess(false);
        const fetchDeps = async () => {
            try {
                const res = await fetch('/api/v1/settings/departments', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setDepartments(data.departments || []);
                    if (data.departments?.length > 0) {
                        setFormData(prev => ({ ...prev, department_id: data.departments[0].id }));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch departments", err);
            }
        };
        fetchDeps();
    }, [show, token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.department_id) {
            setError("Please select a department.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/v1/chat/sessions/${currentSessionId}/save-position`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    department_id: parseInt(formData.department_id),
                    headcount: parseInt(formData.headcount),
                    priority: formData.priority,
                    ats_threshold: parseFloat(formData.ats_threshold),
                    search_interval_hours: parseInt(formData.search_interval_hours)
                })
            });

            if (res.ok) {
                const data = await res.json();
                setSuccess(true);
                fetchSessions();
                // Auto-navigate after brief success state
                setTimeout(() => {
                    onClose();
                    navigate(data.position_id ? `/positions/${data.position_id}` : '/positions');
                }, 1200);
            } else {
                const errData = await res.json();
                setError(errData?.error?.message || errData?.detail || "Failed to create position.");
            }
        } catch (err) {
            setError("Network error. Please try again.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!show) return null;

    // Render via Portal to escape chat scroll container
    return ReactDOM.createPortal(
        <div className="position-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={`position-modal ${success ? 'position-modal--success' : ''}`}>
                {/* Header */}
                <div className="position-modal-header">
                    <div>
                        <h2 className="position-modal-title">
                            {success ? '🎉 Position Created!' : '🚀 Complete Position Setup'}
                        </h2>
                        <p className="position-modal-sub">
                            {success
                                ? 'Candidate search will begin shortly. Redirecting...'
                                : 'Configure hiring parameters before activating the position.'
                            }
                        </p>
                    </div>
                    {!success && (
                        <button className="position-modal-close" onClick={onClose}>✕</button>
                    )}
                </div>

                {success ? (
                    <div className="position-modal-success-body">
                        <div className="position-modal-success-icon">✅</div>
                        <p>Position saved & candidate sourcing activated</p>
                        <div className="position-modal-success-loader" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="position-modal-body">
                            {error && <div className="position-modal-error">{error}</div>}

                            {/* Department */}
                            <div className="position-field">
                                <label className="position-field-label">Department</label>
                                <select
                                    className="position-field-select"
                                    value={formData.department_id}
                                    onChange={(e) => setFormData({...formData, department_id: e.target.value})}
                                    required
                                >
                                    <option value="" disabled>Select Department...</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Headcount + Priority */}
                            <div className="position-field-row">
                                <div className="position-field">
                                    <label className="position-field-label">Headcount</label>
                                    <input
                                        type="number"
                                        className="position-field-input"
                                        min="1"
                                        value={formData.headcount}
                                        onChange={(e) => setFormData({...formData, headcount: e.target.value})}
                                    />
                                </div>
                                <div className="position-field">
                                    <label className="position-field-label">Priority</label>
                                    <select
                                        className="position-field-select"
                                        value={formData.priority}
                                        onChange={(e) => setFormData({...formData, priority: e.target.value})}
                                    >
                                        <option value="low">🟢 Low</option>
                                        <option value="normal">🟡 Normal</option>
                                        <option value="high">🟠 High</option>
                                        <option value="critical">🔴 Critical</option>
                                    </select>
                                </div>
                            </div>

                            {/* ATS + Frequency */}
                            <div className="position-field-row">
                                <div className="position-field">
                                    <label className="position-field-label">ATS Score Threshold (%)</label>
                                    <input
                                        type="number"
                                        className="position-field-input"
                                        min="0" max="100" step="0.1"
                                        value={formData.ats_threshold}
                                        onChange={(e) => setFormData({...formData, ats_threshold: e.target.value})}
                                    />
                                    <span className="position-field-hint">Min fit score to move to screening</span>
                                </div>
                                <div className="position-field">
                                    <label className="position-field-label">Sourcing Frequency</label>
                                    <select
                                        className="position-field-select"
                                        value={formData.search_interval_hours}
                                        onChange={(e) => setFormData({...formData, search_interval_hours: e.target.value})}
                                    >
                                        <option value="12">Every 12 hours</option>
                                        <option value="24">Every 24 hours</option>
                                        <option value="48">Every 48 hours</option>
                                    </select>
                                    <span className="position-field-hint">How often AI searches for candidates</span>
                                </div>
                            </div>
                        </div>

                        <div className="position-modal-footer">
                            <button type="button" className="position-btn-cancel" onClick={onClose}>Cancel</button>
                            <button
                                type="submit"
                                className="position-btn-submit"
                                disabled={isLoading || !formData.department_id}
                            >
                                {isLoading ? '⏳ Creating...' : '🚀 Create & Activate Position'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>,
        document.body
    );
};

export default PositionSetupModal;
