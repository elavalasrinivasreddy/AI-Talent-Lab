import { useState, useEffect } from 'react'
import api from '../../../utils/api'

export default function CareerBrandTab({ onPreviewUpdate }) {
  const [branding, setBranding] = useState({
    name: 'TechCorp',
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
        name: org.name || 'TechCorp',
        career_primary_color: org.career_primary_color || '#0D9488',
        career_banner_url: org.career_banner_url || '',
        career_tagline: org.career_tagline || '',
      })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (onPreviewUpdate) onPreviewUpdate(branding)
  }, [branding, onPreviewUpdate])

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

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <h3>🏢 Career Page Branding</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
          Customise how your public career page looks to candidates. The live preview on the right shows how these changes will appear.
        </p>

        <div className="settings-field">
          <label className="settings-label">Brand Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color"
              value={branding.career_primary_color || '#0D9488'}
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
              value={branding.career_primary_color || ''}
              onChange={e => setBranding(b => ({ ...b, career_primary_color: e.target.value }))}
              placeholder="#0D9488"
              style={{ width: 120, fontFamily: 'monospace' }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Applied to buttons, accents, and highlights on the career page.
            </span>
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">Banner Image URL</label>
          <input
            className="settings-input"
            type="url"
            value={branding.career_banner_url || ''}
            onChange={e => setBranding(b => ({ ...b, career_banner_url: e.target.value }))}
            placeholder="https://your-company.com/images/careers-banner.jpg"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
            <p className="settings-hint" style={{ margin: 0, flex: 1 }}>
              Provide a public URL (e.g. from your company website) for your banner image. Recommended: 1200×400px. Leave blank to use a sleek color gradient.
            </p>
            <button 
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '4px 8px', marginTop: 0 }}
              onClick={() => setBranding(b => ({ ...b, career_banner_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80' }))}
            >
              Use stock image
            </button>
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">Custom Tagline</label>
          <input
            className="settings-input"
            type="text"
            maxLength={100}
            value={branding.career_tagline || ''}
            onChange={e => setBranding(b => ({ ...b, career_tagline: e.target.value }))}
            placeholder="Join us and build something great."
          />
          <p className="settings-hint">Shown below your org name on the career page. Max 100 characters.</p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Branding'}
          </button>
        </div>
      </div>
    </div>
  )
}
