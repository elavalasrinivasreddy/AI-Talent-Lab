import React from 'react';
import './AnalyticsPage.css';

export function RecruiterLeaderboard({ data }) {
  if (!data || !data.recruiters) return null;
  
  return (
    <div className="analytics-card leaderboard-card">
      <h3 className="analytics-card-title">Recruiter Performance</h3>
      <div className="leaderboard-list">
        {data.recruiters.map((recruiter) => (
          <div key={recruiter.id} className="leaderboard-row">
            <div className="leaderboard-name">
              {recruiter.name}
              {recruiter.department_name && <span className="leaderboard-dept"> • {recruiter.department_name}</span>}
            </div>
            <div className="leaderboard-bar-track">
              <div className="leaderboard-bar-fill" style={{ width: `${recruiter.pct}%` }} />
            </div>
            <div className="leaderboard-stats">
              <span className="leaderboard-hires">{recruiter.hires} hires</span>
              <span className="leaderboard-positions">{recruiter.active_positions} active</span>
            </div>
          </div>
        ))}
        {data.recruiters.length === 0 && (
          <div className="analytics-empty">No recruiter data for this period</div>
        )}
      </div>
    </div>
  );
}
