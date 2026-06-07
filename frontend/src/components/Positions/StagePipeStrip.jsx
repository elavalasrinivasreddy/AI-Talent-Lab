const STAGES = [
  { key: 'sourced',   label: 'Src', fullLabel: 'Sourced',   color: 'var(--color-primary, #0D9488)' },
  { key: 'emailed',   label: 'Eml', fullLabel: 'Emailed',   color: 'var(--color-primary, #0D9488)' },
  { key: 'applied',   label: 'App', fullLabel: 'Applied',   color: 'var(--color-primary, #0D9488)' },
  { key: 'screening', label: 'Scr', fullLabel: 'Screening', color: 'var(--color-primary, #0D9488)' },
  { key: 'interview', label: 'Int', fullLabel: 'Interview', color: 'var(--color-primary, #0D9488)' },
  { key: 'selected',  label: 'Sel', fullLabel: 'Selected',  color: 'var(--color-success, #10B981)' },
  { key: 'rejected',  label: 'Rej', fullLabel: 'Rejected',  color: 'var(--color-text-muted, #64748B)' },
]

export default function StagePipeStrip({ counts = {} }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
      {STAGES.map(({ key, label, fullLabel, color }) => (
        <div
          key={key}
          title={fullLabel}
          style={{
            flex: 1,
            borderTop: `3px solid ${color}`,
            background: 'var(--surface-2, rgba(255,255,255,0.04))',
            borderRadius: '0 0 6px 6px',
            padding: '6px 4px 4px',
            textAlign: 'center',
            minWidth: 0,
          }}
        >
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
