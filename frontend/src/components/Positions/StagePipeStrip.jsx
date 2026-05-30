import React from 'react'

const STAGES = [
  { key: 'sourced',   label: 'Src', color: '#6366F1' },
  { key: 'emailed',   label: 'Eml', color: '#8B5CF6' },
  { key: 'applied',   label: 'App', color: '#3B82F6' },
  { key: 'screening', label: 'Scr', color: '#0D9488' },
  { key: 'interview', label: 'Int', color: '#F59E0B' },
  { key: 'selected',  label: 'Sel', color: '#10B981' },
  { key: 'rejected',  label: 'Rej', color: '#EF4444' },
]

export default function StagePipeStrip({ counts = {} }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
      {STAGES.map(({ key, label, color }) => (
        <div key={key} style={{
          flex: 1,
          borderTop: `3px solid ${color}`,
          background: 'var(--surface-2, rgba(255,255,255,0.04))',
          borderRadius: '0 0 6px 6px',
          padding: '6px 4px 4px',
          textAlign: 'center',
          minWidth: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F1F5F9)' }}>
            {counts[key] ?? 0}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary, #94A3B8)', marginTop: 1 }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
