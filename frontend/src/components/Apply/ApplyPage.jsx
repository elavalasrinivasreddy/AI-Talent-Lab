import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './ApplyPage.css';
import * as api from '../../api/client';

export default function ApplyPage({ token }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    
    const [formData, setFormData] = useState({
        prev_company: '',
        notice_period: '',
        total_experience: '',
        relevant_experience: '',
        current_salary: '',
        expected_salary: '',
        availability: '',
        interview_availability: '',
        additional_info: ''
    });

    useEffect(() => {
        // Fetch verification data
        api.verifyApplicationLink(token)
            .then(res => {
                setData(res);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                if (err.response?.status === 409) {
                    setError('You have already applied for this position.');
                } else if (err.response?.status === 404) {
                    setError('This position is no longer active.');
                } else {
                    setError('This link has expired or is invalid. Please contact the recruiter.');
                }
                setLoading(false);
            });
    }, [token]);

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.submitApplication(token, formData);
            setSuccess(true);
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to submit application.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data) return <div className="apply-page-message">Loading details...</div>;
    if (error) return <div className="apply-page-message error"><h2>Oops!</h2><p>{error}</p></div>;
    if (success) return <div className="apply-page-message success"><h2>✅ Success!</h2><p>Your application has been received. We will contact you soon!</p></div>;

    const { position, candidate } = data;

    return (
        <div className="apply-page-container">
            <header className="apply-header">
                <div className="apply-header-content">
                    <div className="org-brand">
                        <div className="org-logo">{position.org_name.charAt(0)}</div>
                        <span>{position.org_name}</span>
                    </div>
                    <h1>{position.role_name}</h1>
                </div>
            </header>
            
            <main className="apply-main">
                <aside className="apply-sidebar">
                    <section className="apply-section">
                        <h3>About the Welcome</h3>
                        <p>Hi <strong>{candidate.name}</strong>, thank you for showing interest in our opening for {position.role_name}. Please fill out the screening questions below so we can move forward.</p>
                    </section>

                    <section className="apply-section">
                        <h3>Job Description</h3>
                        <div className="apply-jd-content markdown">
                            <ReactMarkdown>{position.jd_markdown || "_No detailed description provided._"}</ReactMarkdown>
                        </div>
                    </section>
                </aside>

                <div className="apply-form-container">
                    <h2>Screening Questions</h2>
                    <form className="apply-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Current / Previous Company</label>
                            <input type="text" name="prev_company" required value={formData.prev_company} onChange={handleChange} />
                        </div>
                        <div className="form-group-row">
                            <div className="form-group">
                                <label>Total Experience (Years)</label>
                                <input type="number" step="0.5" name="total_experience" required value={formData.total_experience} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Relevant Experience (Years)</label>
                                <input type="number" step="0.5" name="relevant_experience" required value={formData.relevant_experience} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-group-row">
                            <div className="form-group">
                                <label>Current Salary/Compensation</label>
                                <input type="text" name="current_salary" required value={formData.current_salary} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Expected Salary/Compensation</label>
                                <input type="text" name="expected_salary" required value={formData.expected_salary} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-group-row">
                            <div className="form-group">
                                <label>Notice Period / Availability</label>
                                <input type="text" name="notice_period" placeholder="e.g. 30 days, Immediate" required value={formData.notice_period} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Immediate Joiner Availability</label>
                                <input type="text" name="availability" placeholder="Earliest start date" required value={formData.availability} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Interview Availability Info</label>
                            <input type="text" name="interview_availability" placeholder="e.g. Any time this week after 3 PM EST" required value={formData.interview_availability} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Additional Information (Optional)</label>
                            <textarea name="additional_info" rows="3" value={formData.additional_info} onChange={handleChange}></textarea>
                        </div>
                        <div className="form-actions">
                            <button type="submit" disabled={loading} className="btn-submit">
                                {loading ? 'Submitting...' : 'Submit Application'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
            <footer className="apply-footer">
                <p>Powered by AI Talent Lab</p>
            </footer>
        </div>
    );
}
