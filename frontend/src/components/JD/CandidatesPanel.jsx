import { useState, useEffect } from 'react';
import * as api from '../../api/client';
import './CandidatesPanel.css';
import { useChat } from '../../context/ChatContext';

export default function CandidatesPanel({ positionId }) {
    const { activeSessionId } = useChat();
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterExp, setFilterExp] = useState('All');
    const [filterScore, setFilterScore] = useState('All');
    const [sortBy, setSortBy] = useState('score');
    const [selectedIds, setSelectedIds] = useState([]);
    const [sendingEmails, setSendingEmails] = useState(false);

    useEffect(() => {
        if (!activeSessionId) return;
        
        setLoading(true);
        api.fetchCandidates(activeSessionId)
            .then(data => {
                setCandidates(data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load candidates", err);
                setError("Failed to load candidates");
                setLoading(false);
            });
    }, [activeSessionId]);

    const handleSelect = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(x => x !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleSelectAll = (filteredList) => {
        if (selectedIds.length === filteredList.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredList.map(c => c.id));
        }
    };

    const getScoreBadge = (score) => {
        if (!score && score !== 0) return '⚪';
        if (score >= 80) return '✅';
        if (score >= 60) return '🟡';
        return '⚠️';
    };

    const getScoreBar = (score) => {
        if (!score && score !== 0) return '';
        const pct = Math.min(100, Math.max(0, score));
        return (
            <div className="score-bar-bg">
                <div className={`score-bar-fill ${score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low'}`} style={{ width: `${pct}%` }}></div>
            </div>
        );
    };

    const filteredCandidates = candidates.filter(c => {
        if (filterScore !== 'All') {
            const sc = c.skill_match_score || 0;
            if (filterScore === '≥80%' && sc < 80) return false;
            if (filterScore === '≥60%' && sc < 60) return false;
            if (filterScore === '<60%' && sc >= 60) return false;
        }
        return true;
    }).sort((a, b) => {
        if (sortBy === 'score') {
            return (b.skill_match_score || 0) - (a.skill_match_score || 0);
        }
        return 0; // extendable for experience when experience field is available correctly
    });

    const handleSendEmails = async () => {
        if (selectedIds.length === 0) return;
        setSendingEmails(true);
        try {
            // Assume Role Name for now, could be passed as prop later. 
            await api.sendOutreachEmails(selectedIds, positionId || 1, 'AI Talent Engineer', activeSessionId);
            alert('Outreach emails started in background!');
            // Update status locally
            setCandidates(prev => prev.map(c => selectedIds.includes(c.id) ? { ...c, status: 'emailed' } : c));
            setSelectedIds([]);
        } catch (err) {
            console.error(err);
            alert('Failed to send emails.');
        } finally {
            setSendingEmails(false);
        }
    };

    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async () => {
        setIsSearching(true);
        try {
            await api.searchCandidates(activeSessionId);
            // Sourcing takes a few seconds in background, so poll or show message
            alert('Candidate sourcing started in background! Check back in a few seconds.');
        } catch (err) {
            console.error('Failed to trigger search', err);
            alert('Failed to start search');
        } finally {
            setIsSearching(false);
        }
    };

    if (loading) return <div className="candidates-panel loading">Loading candidates...</div>;
    if (error) return <div className="candidates-panel error">{error}</div>;
    
    if (candidates.length === 0) {
        return (
            <div className="candidates-panel empty-state" style={{ textAlign: 'center', padding: '2rem' }}>
                <h3>🔍 Ready to Find Candidates?</h3>
                <p>Your JD is finalized and saved. Ready to run ATS matching against our candidate pool?</p>
                <button 
                    className="primary-btn" 
                    onClick={handleSearch} 
                    disabled={isSearching}
                    style={{ marginTop: '1rem' }}
                >
                    {isSearching ? 'Starting Search...' : 'Search & Source Candidates'}
                </button>
            </div>
        );
    }

    return (
        <div className="candidates-panel">
            <div className="candidates-header">
                <h3>📋 Sourced Candidates</h3>
                <div className="candidates-controls">
                    <label>
                        Score: 
                        <select value={filterScore} onChange={e => setFilterScore(e.target.value)}>
                            <option value="All">All</option>
                            <option value="≥80%">≥80%</option>
                            <option value="≥60%">≥60%</option>
                            <option value="<60%">&lt;60%</option>
                        </select>
                    </label>
                    <label>
                        Sort: 
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                            <option value="score">Score</option>
                            <option value="name">Name</option>
                        </select>
                    </label>
                </div>
            </div>

            <div className="candidates-list">
                <div className="candidate-rows-header">
                    <input 
                        type="checkbox" 
                        checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0} 
                        onChange={() => handleSelectAll(filteredCandidates)} 
                    />
                    <span className="col-name">Name</span>
                    <span className="col-status">Status</span>
                    <span className="col-score">ATS Match</span>
                </div>
                {filteredCandidates.map(c => (
                    <div key={c.id} className="candidate-row">
                        <input 
                            type="checkbox" 
                            checked={selectedIds.includes(c.id)} 
                            onChange={() => handleSelect(c.id)} 
                            disabled={c.status === 'emailed' || c.status === 'applied'}
                        />
                        <span className="col-name">{c.name}</span>
                        <span className="col-status">
                            <span className={`status-badge ${c.status}`}>{c.status}</span>
                        </span>
                        <span className="col-score">
                            {c.skill_match_score ? `${c.skill_match_score.toFixed(0)}%` : 'N/A'}
                            {getScoreBar(c.skill_match_score)}
                            <span className="score-icon">{getScoreBadge(c.skill_match_score)}</span>
                        </span>
                    </div>
                ))}
            </div>

            <div className="candidates-footer">
                <button 
                    className="primary-btn" 
                    disabled={selectedIds.length === 0 || sendingEmails}
                    onClick={handleSendEmails}
                >
                    {sendingEmails ? 'Sending...' : `📧 Send Outreach to ${selectedIds.length} Selected`}
                </button>
            </div>
        </div>
    );
}
