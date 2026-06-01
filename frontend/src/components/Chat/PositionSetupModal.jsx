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
    const { token, user } = useAuth();
    const { currentSessionId, fetchSessions } = useChat();
    const navigate = useNavigate();

    // Most recruiters chat off an accepted hire request, so the session already
    // carries a department and the backend uses it. Only users without a department
    // of their own (e.g. an org_head starting a fresh JD chat) must pick one here.
    const needsDept = !user?.department_id;

    const [departments, setDepartments] = useState([]);
    const [formData, setFormData] = useState({
        department_id: '',
        headcount: 1,
        priority: 'normal',
        ats_threshold: 80.0,
        search_interval_hours: 24,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isDraftLoading, setIsDraftLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [draftSuccess, setDraftSuccess] = useState(false);

    useEffect(() => {
        if (!show) return;
        setError(null);
        setSuccess(false);
        setDraftSuccess(false);
        const fetchDeps = async () => {
            try {
                const res = await fetch('/api/v1/settings/departments', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setDepartments(data.departments || []);
                    // Only pre-select a department when the user actually needs to
                    // choose one. Pre-filling it for everyone silently overrode the
                    // session's (hire request's) department on save.
                    if (needsDept && data.departments?.length > 0) {
                        setFormData((prev) => ({ ...prev, department_id: data.departments[0].id }));
                    }
                }
            } catch (err) {
                console.error('Failed to fetch departments', err);
            }
        };
        fetchDeps();
    }, [show, token, needsDept]);

    const _savePosition = async (asDraft) => {

        if (asDraft) setIsDraftLoading(true);
        else setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/v1/chat/sessions/${currentSessionId}/save-position`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...(formData.department_id && { department_id: parseInt(formData.department_id) }),
                    headcount: parseInt(formData.headcount),
                    priority: formData.priority,
                    ats_threshold: parseFloat(formData.ats_threshold),
                    search_interval_hours: parseInt(formData.search_interval_hours),
                    as_draft: asDraft,
                }),
            });

            if (res.ok) {
                fetchSessions();
                if (asDraft) {
                    setDraftSuccess(true);
                    setTimeout(() => {
                        onClose();
                        navigate('/dashboard');
                    }, 1800);
                } else {
                    const data = await res.json();
                    setSuccess(true);
                    setTimeout(() => {
                        onClose();
                        navigate(data.position_id ? `/positions/${data.position_id}` : '/positions');
                    }, 1200);
                }
            } else {
                const errData = await res.json();
                setError(errData?.error?.message || errData?.detail || 'Failed to save position.');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error(err);
        } finally {
            if (asDraft) setIsDraftLoading(false);
            else setIsLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        _savePosition(false);
    };

    const handleSaveAsDraft = (e) => {
        e.preventDefault();
        _savePosition(true);
    };

    if (!show) return null;

    return ReactDOM.createPortal(
        <div
            className="pmodal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget && !success && !draftSuccess) onClose();
            }}
        >
            <div className="pmodal" role="dialog" aria-modal="true" aria-labelledby="pmodal-title">
                {draftSuccess ? (
                    <div className="pmodal-success">
                        <div className="pmodal-success-mark">
                            <IconCheck size={22} />
                        </div>
                        <h2 className="pmodal-success-title">Saved as draft.</h2>
                        <p className="pmodal-success-sub">
                            Resume this position from your dashboard whenever you're ready.
                        </p>
                        <div className="pmodal-success-bar" aria-hidden="true" />
                    </div>
                ) : success ? (
                    <div className="pmodal-success">
                        <div className="pmodal-success-mark">
                            <IconCheck size={22} />
                        </div>
                        <h2 className="pmodal-success-title">JD submitted for approval.</h2>
                        <p className="pmodal-success-sub">
                            Your team lead has been notified. You'll receive an email once they review it. Taking you to the position…
                        </p>
                        <div className="pmodal-success-bar" aria-hidden="true" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="pmodal-head">
                            <div>
                                <div className="pmodal-eyebrow">Submit for team lead approval</div>
                                <h2 id="pmodal-title" className="pmodal-title">Configure hiring parameters</h2>
                                <p className="pmodal-sub">
                                    Set the hiring parameters below. Your team lead will review the JD before candidate sourcing begins.
                                </p>
                            </div>
                            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
                                <IconX size={16} />
                            </button>
                        </div>

                        <div className="pmodal-body">
                            {error && <div className="pmodal-error">{error}</div>}



                            {needsDept && (
                                <div className="pmodal-row">
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
                                        <span className="pfield-hint">Which department this role belongs to</span>
                                    </div>
                                </div>
                            )}

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
                                type="button"
                                className="btn-ghost"
                                disabled={isDraftLoading || isLoading || (needsDept && !formData.department_id)}
                                onClick={handleSaveAsDraft}
                            >
                                {isDraftLoading ? 'Saving…' : 'Save as draft'}
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isLoading || isDraftLoading || (needsDept && !formData.department_id)}
                            >
                                {isLoading ? 'Submitting…' : (
                                    <>Submit for approval <IconArrowRight size={14} /></>
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
