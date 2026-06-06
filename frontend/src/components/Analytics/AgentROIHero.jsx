import React from 'react';
import './AnalyticsPage.css';

export function AgentROIHero({ data }) {
  if (!data) return null;

  return (
    <div className="roi-hero">
      <div className="roi-hero-main">
        <h3 className="roi-hero-title">AI Sourcing Impact</h3>
        <div className="roi-hero-value">{data.ai_sourcing_share}%</div>
        <div className="roi-hero-subtitle">of total pipeline sourced by AI</div>
      </div>
      
      <div className="roi-hero-metrics">
        <div className="roi-metric">
          <div className="roi-metric-label">Hours Saved</div>
          <div className="roi-metric-value">{data.hours_saved}h</div>
          <div className="roi-metric-sub">{data.weekly_hours_saved}h / week avg</div>
        </div>
        <div className="roi-metric">
          <div className="roi-metric-label">Candidates Found</div>
          <div className="roi-metric-value">{data.ai_candidates}</div>
          <div className="roi-metric-sub">out of {data.total_candidates} total</div>
        </div>
      </div>
    </div>
  );
}
