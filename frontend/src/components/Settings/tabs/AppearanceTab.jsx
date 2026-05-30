import { useState, useEffect } from 'react'
import { useTheme } from '../../../context/ThemeContext'
import api from '../../../utils/api'

export default function AppearanceTab() {
  const { theme, setTheme } = useTheme()
  const [branding, setBranding] = useState({
    career_primary_color: '#0D9488',
    career_banner_url: '',
    career_tagline: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/settings/org').then(({ data }) => {
      const org = data.org || {}
      setBranding({
        career_primary_color: org.career_primary_color || '#0D9488',
        career_banner_url: org.career_banner_url || '',
        career_tagline: org.career_tagline || '',
      })
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await api.patch('/settings/org', {
        career_primary_color: branding.career_primary_color || null,
        career_banner_url: branding.career_banner_url || null,
        career_tagline: branding.career_tagline || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      // surface error via toast in a future iteration
    } finally {
      setSaving(false)
    }
  }

  const themes = [
    { key: 'dark',   icon: '🌙', label: 'Dark',   desc: 'Default dark theme' },
    { key: 'light',  icon: '☀️', label: 'Light',  desc: 'Clean light theme' },
    { key: 'system', icon: '💻', label: 'System', desc: 'Follow OS preference' },
  ]

  return (
    <div className="settings-form">

      {/* ── App Theme ── */}
      <div className="settings-form-section">
        <h3>🎨 App Theme</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
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
                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
                  Active
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Career Page Branding ── */}
      <div className="settings-form-section">
        <h3>🏢 Career Page Branding</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
          Customise how your public career page looks to candidates.
        </p>

        <div className="settings-field">
          <label className="settings-label">Brand Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color"
              value={branding.career_primary_color}
              onChange={e => setBranding(b => ({ ...b, career_primary_color: e.target.value }))}
              style={{
                width: 44, height: 36, padding: 2, borderRadius: 6,
                border: '1px solid var(--color-border)', cursor: 'pointer',
                background: 'transparent',
              }}
            />
            <input
              className="settings-input"
              type="text"
              value={branding.career_primary_color}
              onChange={e => setBranding(b => ({ ...b, career_primary_color: e.target.value }))}
              placeholder="#0D9488"
              style={{ width: 120, fontFamily: 'monospace' }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Applied to buttons, accents, and highlights on the career page.
            </span>
          </div>
          {branding.career_primary_color && (
            <div style={{
              marginTop: 8, height: 4, borderRadius: 2,
              background: branding.career_primary_color, maxWidth: 200,
            }} />
          )}
        </div>

        <div className="settings-field">
          <label className="settings-label">Banner Image URL</label>
          <input
            className="settings-input"
            type="url"
            value={branding.career_banner_url}
            onChange={e => setBranding(b => ({ ...b, career_banner_url: e.target.value }))}
            placeholder="https://your-company.com/images/careers-banner.jpg"
          />
          <p className="settings-hint">Recommended: 1200×400px, JPG or PNG. Leave blank to use default gradient.</p>
          {branding.career_banner_url && (
            <img
              src={branding.career_banner_url}
              alt="Banner preview"
              onError={e => { e.target.style.display = 'none' }}
              style={{ marginTop: 8, maxHeight: 80, borderRadius: 6, border: '1px solid var(--color-border)' }}
            />
          )}
        </div>

        <div className="settings-field">
          <label className="settings-label">Custom Tagline</label>
          <input
            className="settings-input"
            type="text"
            maxLength={100}
            value={branding.career_tagline}
            onChange={e => setBranding(b => ({ ...b, career_tagline: e.target.value }))}
            placeholder="Join us and build something great."
          />
          <p className="settings-hint">Shown below your org name on the career page. Max 100 characters.</p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Branding'}
        </button>
      </div>

    </div>
  )
}
