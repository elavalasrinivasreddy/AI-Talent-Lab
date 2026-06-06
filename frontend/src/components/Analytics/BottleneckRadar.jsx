import React from 'react';
import './AnalyticsPage.css';

export function BottleneckRadar({ current, previous }) {
  if (!current) return null;

  const axes = [
    { key: 'sourcing', label: 'Sourcing' },
    { key: 'screening', label: 'Screening' },
    { key: 'interview', label: 'Interview Speed' },
    { key: 'offer', label: 'Offer Accept' },
    { key: 'ai_accept', label: 'AI Accept' },
    { key: 'retention', label: 'Retention' },
  ];

  // Radar geometry helper
  const size = 300;
  const center = size / 2;
  const radius = center - 40;

  const getPoint = (value, index) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    // value is 0.0 to 1.0
    const r = value * radius;
    return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
  };

  const currentPoints = axes.map((a, i) => getPoint(current[a.key] || 0, i)).join(' ');
  const previousPoints = previous ? axes.map((a, i) => getPoint(previous[a.key] || 0, i)).join(' ') : '';

  return (
    <div className="analytics-card bottleneck-radar-card">
      <div className="analytics-card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <h3 className="analytics-card-title" style={{ margin: 0 }}>Bottleneck Radar</h3>
        <span 
          className="radar-info-icon" 
          title="Sourcing: Volume of new candidates&#10;Screening: % of applicants passing screening&#10;Interview Speed: Speed of the interview phase (faster is better)&#10;Offer Accept: Interview to Hire conversion rate&#10;AI Accept: AI Copilot suggestions accepted&#10;Retention: Post-hire retention"
          style={{ cursor: 'help', color: 'var(--color-text-tertiary)', fontSize: '14px', border: '1px solid var(--color-border)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ?
        </span>
      </div>
      <div className="radar-container">
        <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="radar-svg">
          {/* Background circles */}
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((r, i) => (
            <circle key={i} cx={center} cy={center} r={r * radius} className="radar-grid" />
          ))}
          {/* Axis lines */}
          {axes.map((_, i) => {
            const end = getPoint(1, i);
            return <line key={i} x1={center} y1={center} x2={end.split(',')[0]} y2={end.split(',')[1]} className="radar-grid" />;
          })}
          
          {/* Previous polygon */}
          {previous && (
            <polygon points={previousPoints} className="radar-poly-prev" />
          )}
          
          {/* Current polygon */}
          <polygon points={currentPoints} className="radar-poly-current" />
          
          {/* Axis Labels */}
          {axes.map((a, i) => {
            const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
            const r = radius + 25;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);
            return (
              <text key={a.key} x={x} y={y} className="radar-label" textAnchor="middle" dominantBaseline="middle">
                {a.label}
              </text>
            );
          })}
        </svg>
      </div>
      <div className="radar-legend">
        <span><span className="legend-dot" style={{ backgroundColor: 'rgba(16, 185, 129, 0.8)' }} /> Current</span>
        {previous && <span><span className="legend-dot" style={{ backgroundColor: 'rgba(99, 102, 241, 0.4)' }} /> Previous</span>}
      </div>
    </div>
  );
}
