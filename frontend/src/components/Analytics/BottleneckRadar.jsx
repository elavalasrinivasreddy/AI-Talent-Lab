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
      <h3 className="analytics-card-title">Bottleneck Radar</h3>
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
