import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

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

    // Fetch departments for dropdown
    useEffect(() => {
        if (!show) return;
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
                onClose();
                // We'd navigate to position detail in real app, but for now navigate to dashboard or refresh session
                // Assuming Phase 4 endpoint works, refresh the session list so it is removed/updated
                fetchSessions();
                navigate(data.position_id ? `/positions/${data.position_id}` : '/'); 
            } else {
                const errData = await res.json();
                setError(errData.detail || "Failed to create position.");
            }
        } catch (err) {
            setError("Network error. Please try again.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Complete Position Setup</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger p-2 small">{error}</div>}
                            
                            <div className="mb-3">
                                <label className="form-label fw-bold small">Department</label>
                                <select 
                                    className="form-select" 
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

                            <div className="row g-3 mb-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-bold small">Headcount</label>
                                    <input 
                                        type="number" 
                                        className="form-control" 
                                        min="1" 
                                        value={formData.headcount}
                                        onChange={(e) => setFormData({...formData, headcount: e.target.value})}
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-bold small">Priority</label>
                                    <select 
                                        className="form-select"
                                        value={formData.priority}
                                        onChange={(e) => setFormData({...formData, priority: e.target.value})}
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-bold small">ATS Scoring Threshold (%)</label>
                                    <input 
                                        type="number" 
                                        className="form-control" 
                                        min="0" max="100" step="0.1"
                                        value={formData.ats_threshold}
                                        onChange={(e) => setFormData({...formData, ats_threshold: e.target.value})}
                                    />
                                    <div className="form-text" style={{fontSize: '0.7em'}}>Min fit score to move to screening</div>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-bold small">Sourcing Agent Frequency</label>
                                    <select 
                                        className="form-select"
                                        value={formData.search_interval_hours}
                                        onChange={(e) => setFormData({...formData, search_interval_hours: e.target.value})}
                                    >
                                        <option value="12">Every 12 hours</option>
                                        <option value="24">Every 24 hours</option>
                                        <option value="48">Every 48 hours</option>
                                    </select>
                                    <div className="form-text" style={{fontSize: '0.7em'}}>How often to search talent pool</div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={isLoading || !formData.department_id}>
                                {isLoading ? 'Saving...' : 'Create & Activate Position'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PositionSetupModal;
