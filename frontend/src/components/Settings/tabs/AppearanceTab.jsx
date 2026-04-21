import { useTheme } from '../../../context/ThemeContext'

export default function AppearanceTab() {
  const { theme, setTheme } = useTheme()

  const themes = [
    { key: 'dark', icon: '🌙', label: 'Dark', desc: 'Default dark theme' },
    { key: 'light', icon: '☀️', label: 'Light', desc: 'Clean light theme' },
    { key: 'system', icon: '💻', label: 'System', desc: 'Follow OS preference' },
  ]

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <h3>🎨 Theme</h3>
        <p style={{color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)'}}>
          Changes apply immediately — no save needed.
        </p>

        <div className="theme-grid">
          {themes.map(t => (
            <div
              key={t.key}
              className={`theme-card ${theme === t.key ? 'active' : ''}`}
              onClick={() => setTheme(t.key)}
            >
              <div className="theme-icon">{t.icon}</div>
              <div className="theme-label">{t.label}</div>
              <div className="theme-desc">{t.desc}</div>
              {theme === t.key && (
                <div style={{
                  marginTop: 'var(--space-2)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                }}>Active</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
