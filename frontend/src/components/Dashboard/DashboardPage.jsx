import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import './Dashboard.css';

export default function DashboardPage({ onNavigateChat }) {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [positions, setPositions] = useState([]);
    const [pipeline, setPipeline] = useState(null);
    const [selectedPositionId, setSelectedPositionId] = useState(null);
    const [funnel, setFunnel] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [statsRes, posRes, funnelRes] = await Promise.all([
                api.get('/api/dashboard/stats'),
                api.get('/api/dashboard/positions'),
                api.get('/api/dashboard/funnel'),
            ]);
            setStats(statsRes.data);
            setPositions(posRes.data.positions || []);
            setFunnel(funnelRes.data.funnel || []);
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const loadPipeline = async (posId) => {
        setSelectedPositionId(posId);
        try {
            const res = await api.get(`/api/dashboard/pipeline/${posId}`);
            setPipeline(res.data);
        } catch (err) {
            console.error('Pipeline load error:', err);
        }
    };

    if (loading) {
        return (
            <div className="dashboard">
                <div className="dashboard__loading">
                    <div className="typing-indicator"><span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/></div>
                    <p>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const pipelineStages = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected', 'rejected'];
    const stageLabels = { sourced: '🔍 Sourced', emailed: '📧 Emailed', applied: '📝 Applied', screening: '🔬 Screening', interview: '🎙️ Interview', selected: '✅ Selected', rejected: '❌ Rejected' };
    const stageColors = { sourced: '#6366f1', emailed: '#8b5cf6', applied: '#06b6d4', screening: '#f59e0b', interview: '#10b981', selected: '#22c55e', rejected: '#ef4444' };

    if (selectedPositionId) {
        const activePos = positions.find(p => p.id === selectedPositionId);
        return (
            <div className="dashboard">
                <div className="dashboard__header">
                    <button className="back-btn" onClick={() => setSelectedPositionId(null)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', marginBottom: '16px' }}>
                        ← Back to Dashboard
                    </button>
                    <h1 className="dashboard__title" style={{ marginTop: '0' }}>
                        {activePos?.role_name || 'Position Details'}
                    </h1>
                </div>

                <div className="dashboard__stats" style={{ marginBottom: '24px' }}>
                    <div className="stat-card">
                        <div className="stat-card__value">{activePos?.candidate_count || 0}</div>
                        <div className="stat-card__label">Candidates Sourced</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card__value">{activePos?.applied_count || 0}</div>
                        <div className="stat-card__label">Applications</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card__value">{activePos?.interview_count || 0}</div>
                        <div className="stat-card__label">In Interviews</div>
                    </div>
                </div>

                {pipeline && (
                    <div className="dashboard__section">
                        <h2 className="dashboard__section-title">Candidate Pipeline</h2>
                        <div className="pipeline">
                            {pipelineStages.map(stage => {
                                const candidates = pipeline.pipeline?.[stage] || [];
                                return (
                                    <div key={stage} className="pipeline__column">
                                        <div className="pipeline__column-header" style={{ borderColor: stageColors[stage] }}>
                                            <span>{stageLabels[stage]}</span>
                                            <span className="pipeline__count">{candidates.length}</span>
                                        </div>
                                        <div className="pipeline__cards">
                                            {candidates.map(c => (
                                                <div key={c.id} className="pipeline__card">
                                                    <div className="pipeline__card-name">{c.name}</div>
                                                    <div className="pipeline__card-email">{c.email}</div>
                                                    {c.skill_match_score != null && (
                                                        <div className="pipeline__card-score">
                                                            Match: <strong>{Math.round(c.skill_match_score)}%</strong>
                                                        </div>
                                                    )}
                                                    {c.source && (
                                                        <span className="pipeline__card-source">{c.source}</span>
                                                    )}
                                                </div>
                                            ))}
                                            {candidates.length === 0 && (
                                                <div className="pipeline__empty">No candidates</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Header */}
            <div className="dashboard__header">
                <div>
                    <h1 className="dashboard__title">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '8px' }}>
                            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        Dashboard
                    </h1>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="dashboard__stats">
                <div className="stat-card stat-card--positions">
                    <div className="stat-card__value">{stats?.open_positions || 0}</div>
                    <div className="stat-card__label">Open Positions</div>
                    <div className="stat-card__icon">💼</div>
                </div>
                <div className="stat-card stat-card--candidates">
                    <div className="stat-card__value">{stats?.total_candidates || 0}</div>
                    <div className="stat-card__label">Total Candidates</div>
                    <div className="stat-card__icon">👥</div>
                </div>
                <div className="stat-card stat-card--emails">
                    <div className="stat-card__value">{stats?.emails_sent || 0}</div>
                    <div className="stat-card__label">Emails Sent</div>
                    <div className="stat-card__icon">📧</div>
                </div>
                <div className="stat-card stat-card--applications">
                    <div className="stat-card__value">{stats?.applications || 0}</div>
                    <div className="stat-card__label">Applications</div>
                    <div className="stat-card__icon">📝</div>
                </div>
            </div>

            {/* Hiring Funnel */}
            {funnel.length > 0 && (
                <div className="dashboard__section">
                    <h2 className="dashboard__section-title">Hiring Funnel</h2>
                    <div className="funnel">
                        {funnel.map((stage, i) => {
                            const maxCount = Math.max(...funnel.map(f => f.count), 1);
                            const widthPct = Math.max(20, (stage.count / maxCount) * 100);
                            return (
                                <div key={stage.status} className="funnel__stage" style={{ '--stage-width': `${widthPct}%`, '--stage-color': stageColors[stage.status] || '#6366f1' }}>
                                    <div className="funnel__bar" />
                                    <div className="funnel__info">
                                        <span className="funnel__label">{stageLabels[stage.status] || stage.status}</span>
                                        <span className="funnel__count">{stage.count}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Positions */}
            <div className="dashboard__section">
                <h2 className="dashboard__section-title">Positions ({positions.length})</h2>
                {positions.length === 0 ? (
                    <div className="dashboard__empty">
                        <p style={{ textAlign: 'center', opacity: 0.6, padding: '2rem 0' }}>
                            📋 No open positions yet. Use <strong>+ New Hire</strong> to create your first JD.
                        </p>
                    </div>
                ) : (
                    <div className="positions-grid">
                        {positions.map(pos => (
                            <div
                                key={pos.id}
                                className="position-card"
                                onClick={() => loadPipeline(pos.id)}
                            >
                                <div className="position-card__header">
                                    <h3 className="position-card__title">{pos.role_name}</h3>
                                    <span className={`position-card__status position-card__status--${pos.status}`}>
                                        {pos.status}
                                    </span>
                                </div>
                                <div className="position-card__stats">
                                    <span>👥 {pos.candidate_count || 0} candidates</span>
                                    <span>📝 {pos.applied_count || 0} applied</span>
                                    <span>🎙️ {pos.interview_count || 0} interviews</span>
                                    <span>✅ {pos.selected_count || 0} selected</span>
                                </div>
                                <div className="position-card__meta">
                                    {pos.has_jd ? '📄 JD available' : '⚠️ No JD'} · Threshold: {pos.ats_threshold || 80}%
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
