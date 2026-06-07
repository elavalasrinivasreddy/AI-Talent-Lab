import React from 'react'
import Icon from '../../common/Icon'
import Toggle from '../../common/Toggle'

// Dummy Slider component - ideally moved to common/Slider.jsx
const Slider = ({ value, onChange, min = 0, max = 100, step = 1, label, suffix = '%' }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
      <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-primary)' }}>{value}{suffix}</span>
    </div>
    <input 
      type="range" 
      min={min} max={max} step={step} 
      value={value} 
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: '100%', accentColor: 'var(--color-primary)' }}
    />
  </div>
)

export default function AtsRulesTab({ isReadOnly }) {
  // In a real implementation, this would sync with parent aiSettings
  const [threshold, setThreshold] = React.useState(80)
  const [weightEmb, setWeightEmb] = React.useState(40)
  const [weightSkills, setWeightSkills] = React.useState(40)
  const [weightExp, setWeightExp] = React.useState(20)
  
  const [autoArchive, setAutoArchive] = React.useState(true)
  const [rescoreOnJd, setRescoreOnJd] = React.useState(true)
  const [showReasoning, setShowReasoning] = React.useState(false)

  // Auto-balance weights to ensure they sum to 100
  const handleWeightChange = (key, value) => {
    // simplified balancing logic for UI
    if (key === 'emb') {
      setWeightEmb(value)
      setWeightSkills(Math.max(0, 100 - value - weightExp))
    }
    if (key === 'skills') {
      setWeightSkills(value)
      setWeightExp(Math.max(0, 100 - value - weightEmb))
    }
    if (key === 'exp') {
      setWeightExp(value)
      setWeightEmb(Math.max(0, 100 - value - weightSkills))
    }
  }

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="section-header">
          <h3><Icon name="bar-chart" size={18} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--color-primary)' }}/> ATS Scoring Rules</h3>
        </div>
        <p className="section-desc">
          Defines the mathematical threshold and weights for candidate scoring. 
          Changes here affect how candidates advance through the pipeline.
        </p>

        <div className="premium-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 24, padding: 24 }}>
          <div>
            <h4 style={{ marginBottom: 16 }}>Minimum ATS Threshold</h4>
            <Slider 
              label="Candidates scoring below this are not advanced" 
              value={threshold} 
              onChange={val => !isReadOnly && setThreshold(val)} 
              min={50} max={95} step={1} 
            />
          </div>
          
          <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />

          <div>
            <h4 style={{ marginBottom: 16 }}>Score Weights (Must sum to 100%)</h4>
            <Slider 
              label="Semantic Match (Embeddings)" 
              value={weightEmb} 
              onChange={val => !isReadOnly && handleWeightChange('emb', val)} 
            />
            <Slider 
              label="Hard Skills Match" 
              value={weightSkills} 
              onChange={val => !isReadOnly && handleWeightChange('skills', val)} 
            />
            <Slider 
              label="Experience Match" 
              value={weightExp} 
              onChange={val => !isReadOnly && handleWeightChange('exp', val)} 
            />
          </div>

          <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 0' }} />

          <div>
            <h4 style={{ marginBottom: 16 }}>Auto-Behaviors</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Toggle checked={autoArchive} onChange={val => !isReadOnly && setAutoArchive(val)} disabled={isReadOnly} />
                <span style={{ fontSize: 14 }}>Auto-archive candidates scoring below threshold</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Toggle checked={rescoreOnJd} onChange={val => !isReadOnly && setRescoreOnJd(val)} disabled={isReadOnly} />
                <span style={{ fontSize: 14 }}>Re-score all candidates immediately if JD is edited</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Toggle checked={showReasoning} onChange={val => !isReadOnly && setShowReasoning(val)} disabled={isReadOnly} />
                <span style={{ fontSize: 14 }}>Show AI reasoning to candidate on rejection</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => {}} disabled={isReadOnly}>Reset</button>
            <button className="btn btn-primary" onClick={() => {}} disabled={isReadOnly}>Save ATS Rules</button>
          </div>
        </div>
      </div>
    </div>
  )
}
