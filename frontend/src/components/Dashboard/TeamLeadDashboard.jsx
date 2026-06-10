import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import CopilotBar from './CopilotBar';
import TodaysBriefing from './TodaysBriefing';
import PositionPulse from './PositionPulse';

export default function TeamLeadDashboard({ 
  user, 
  data, 
  greetingSuffix, 
  period, 
  setPeriod 
}) {
  const { lanes, suggestions, positions, loading, error, dismiss, dismissAll } = data;
  
  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const hasPositions = Array.isArray(positions) && positions.some(p => p.status === 'open' || p.status === 'active')
  const isOnboarding = !lanes.now.loading && !hasPositions && positions !== undefined && positions.length === 0

  return (
    <div className="dash-v3">
      {/* ── TopBar ── */}
      <div className="dash-topbar">
        <div className="dash-greeting">
          <h1 className="dash-greeting-title">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}
            <span className="dash-role-badge">Hiring Manager</span>
          </h1>
          {greetingSuffix && <p className="dash-greeting-sub">{greetingSuffix}</p>}
        </div>

        <div className="dash-topbar-actions">
          {!isOnboarding && (
            <Link to="/hire-requests/new" className="dash-new-hire-btn">
              <Icon name="plus" size={14} />
              File Hire Request
            </Link>
          )}
          <div
            className="dash-period-switcher"
            title="Period controls the health metrics above. Lane content refreshes in real-time."
          >
            {['today', 'week', 'month'].map(p => (
              <button
                key={p}
                className={`dash-period-btn${period === p ? ' active' : ''}`}
                onClick={() => setPeriod(p)}
                type="button"
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Copilot Bar ── */}
      <CopilotBar
        suggestions={suggestions}
        onDismiss={dismiss}
        onDismissAll={dismissAll}
      />

      {/* ── Today's Briefing — 3 lanes ── */}
      <TodaysBriefing
        lanes={lanes}
        positions={positions}
        role="team_lead"
      />

      {/* ── Bottom row: My Requisitions ── */}
      {!isOnboarding && (
        <div className="dash-bottom-row" style={{ display: 'block' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>My Requisitions</h3>
          <PositionPulse
            positions={positions}
            loading={loading.positions}
            error={error.positions}
          />
        </div>
      )}
    </div>
  );
}
