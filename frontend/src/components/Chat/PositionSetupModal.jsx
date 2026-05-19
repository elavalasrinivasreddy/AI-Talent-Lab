import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { IconX, IconCheck, IconArrowRight } from './icons';

/**
 * PositionSetupModal — final activation form before sourcing kicks in.
 * Calm two-column layout, no emoji, restrained success state.
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
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setDepartments(data.departments || []);
                    if (data.departments?.length > 0) {
                        setFormData((prev) => ({ ...prev, department_id: data.departments[0].id }));
                    }
                }
            } catch (err) {
                console.error('Failed to fetch departments', err);
            }
        };
        fetchDeps();
    }, [show, token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.department_id) {
            setError('Please select a department.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/v1/chat/sessions/${currentSessionId}/save-position`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    department_id: parseInt(formData.department_id),
                    headcount: parseInt(formData.headcount),
                    priority: formData.priority,
                    ats_threshold: parseFloat(formData.ats_threshold),
                    search_interval_hours: parseInt(formData.search_interval_hours),
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setSuccess(true);
                fetchSessions();
                setTimeout(() => {
                    onClose();
                    navigate(data.position_id ? `/positions/${data.position_id}` : '/positions');
                }, 1200);
            } else {
                const errData = await res.json();
                setError(errData?.error?.message || errData?.detail || 'Failed to create position.');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!show) return null;

    return ReactDOM.createPortal(
        <div
            className="pmodal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget && !success) onClose();
            }}
        >
            <div className="pmodal" role="dialog" aria-modal="true" aria-labelledby="pmodal-title">
                {success ? (
                    <div className="pmodal-success">
                        <div className="pmodal-success-mark">
                            <IconCheck size={22} />
                        </div>
                        <h2 className="pmodal-success-title">Position activated.</h2>
                        <p className="pmodal-success-sub">
                            Candidate sourcing is running. Taking you to the position…
                        </p>
                        <div className="pmodal-success-bar" aria-hidden="true" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="pmodal-head">
                            <div>
                                <div className="pmodal-eyebrow">Activate position</div>
                                <h2 id="pmodal-title" className="pmodal-title">Configure hiring parameters</h2>
                                <p className="pmodal-sub">
                                    These settings drive how often we source and how strict the ATS match must be.
                                </p>
                            </div>
                            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
                                <IconX size={16} />
                            </button>
                        </div>

                        <div className="pmodal-body">
                            {error && <div className="pmodal-error">{error}</div>}

                            <div className="pfield">
                                <label className="pfield-label" htmlFor="pf-dept">Department</label>
                                <select
                                    id="pf-dept"
                                    className="pfield-select"
                                    value={formData.department_id}
                                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                                    required
                                >
                                    <option value="" disabled>Select a department…</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pmodal-row">
                                <div className="pfield">
                                    <label className="pfield-label" htmlFor="pf-hc">Headcount</label>
                                    <input
                                        id="pf-hc"
                                        type="number"
                                        className="pfield-input"
                                        min="1"
                                        value={formData.headcount}
                                        onChange={(e) => setFormData({ ...formData, headcount: e.target.value })}
                                    />
                                </div>
                                <div className="pfield">
                                    <label className="pfield-label" htmlFor="pf-pri">Priority</label>
                                    <select
                                        id="pf-pri"
                                        className="pfield-select"
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pmodal-row">
                                <div className="pfield">
                                    <label className="pfield-label" htmlFor="pf-ats">ATS threshold (%)</label>
                                    <input
                                        id="pf-ats"
                                        type="number"
                                        className="pfield-input"
                                        min="0" max="100" step="0.1"
                                        value={formData.ats_threshold}
                                        onChange={(e) => setFormData({ ...formData, ats_threshold: e.target.value })}
                                    />
                                    <span className="pfield-hint">Min score to advance to screening</span>
                                </div>
                                <div className="pfield">
                                    <label className="pfield-label" htmlFor="pf-freq">Sourcing frequency</label>
                                    <select
                                        id="pf-freq"
                                        className="pfield-select"
                                        value={formData.search_interval_hours}
                                        onChange={(e) => setFormData({ ...formData, search_interval_hours: e.target.value })}
                                    >
                                        <option value="12">Every 12 hours</option>
                                        <option value="24">Every 24 hours</option>
                                        <option value="48">Every 48 hours</option>
                                    </select>
                                    <span className="pfield-hint">How often we re-run candidate search</span>
                                </div>
                            </div>
                        </div>

                        <div className="pmodal-foot">
                            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isLoading || !formData.department_id}
                            >
                                {isLoading ? 'Activating…' : (
                                    <>Activate position <IconArrowRight size={14} /></>
                                )}
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
