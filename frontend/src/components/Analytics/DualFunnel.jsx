import React from 'react';
import './AnalyticsPage.css';

export function DualFunnel({ aiFunnel, humanFunnel }) {
  if (!aiFunnel || !humanFunnel) return null;
  const stages = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected'];
  
  const getMaxValue = () => {
    let max = 1;
    stages.forEach(s => {
      max = Math.max(max, aiFunnel[s] || 0, humanFunnel[s] || 0);
    });
    return max;
  };
  
  const max = getMaxValue();

  return (
    <div className="analytics-card dual-funnel-card">
      <h3 className="analytics-card-title">Pipeline Efficiency: AI vs Human</h3>
      <div className="dual-funnel-container">
        {stages.map((stage) => {
          const aiVal = aiFunnel[stage] || 0;
          const humanVal = humanFunnel[stage] || 0;
          
          return (
            <div key={stage} className="dual-funnel-row">
              <div className="dual-funnel-human">
                <span className="dual-funnel-val">{humanVal}</span>
                <div className="dual-funnel-bar-wrapper right">
                  <div className="dual-funnel-bar" style={{ width: `${Math.max((humanVal / max) * 100, 1)}%`, backgroundColor: '#6366F1' }} />
                </div>
              </div>
              <div className="dual-funnel-label">
                {stage.charAt(0).toUpperCase() + stage.slice(1)}
              </div>
              <div className="dual-funnel-ai">
                <div className="dual-funnel-bar-wrapper left">
                  <div className="dual-funnel-bar" style={{ width: `${Math.max((aiVal / max) * 100, 1)}%`, backgroundColor: '#10B981' }} />
                </div>
                <span className="dual-funnel-val">{aiVal}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="dual-funnel-legend">
        <span><span className="legend-dot" style={{ backgroundColor: '#6366F1' }} /> Human Sourced</span>
        <span><span className="legend-dot" style={{ backgroundColor: '#10B981' }} /> AI Sourced</span>
      </div>
    </div>
  );
}
