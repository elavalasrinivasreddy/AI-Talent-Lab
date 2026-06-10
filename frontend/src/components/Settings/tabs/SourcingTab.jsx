import React, { useState, useEffect } from 'react'
import { settingsApi } from '../../../utils/api'

const DEFAULT_CONFIG = {
  source_adapter: 'simulation',
  inbound_enabled: true,
  enrichment_enabled: false,
  enrichment_provider: 'proxycurl',
}

export default function SourcingTab({ isReadOnly }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await settingsApi.getSourcingConfig()
      setConfig({ ...DEFAULT_CONFIG, ...(res.settings || {}) })
    } catch (err) {
      console.error('Failed to load sourcing config', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.updateSourcingConfig(config)
    } catch (err) {
      console.error('Failed to save sourcing config', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-lg">Loading...</div>

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="flex justify-between items-center mb-md">
          <div>
            <h3>Candidate Sourcing</h3>
            <p className="text-muted">Configure outbound search adapters and inbound candidate workflows.</p>
          </div>
          {!isReadOnly && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          )}
        </div>

        <div className="settings-card" style={{ padding: 16, marginBottom: 16 }}>
          <h4>Source Adapter</h4>
          <p className="text-muted text-sm mb-md">Select which adapter to use for finding new candidates.</p>
          <select
            className="form-input"
            value={config.source_adapter || 'simulation'}
            onChange={e => setConfig({ ...config, source_adapter: e.target.value })}
            disabled={isReadOnly}
          >
            <option value="simulation">Simulation (local testing only)</option>
            <option value="tavily">Tavily (web search)</option>
            <option value="linkedin">LinkedIn API (Phase 3)</option>
          </select>
        </div>

        <div className="settings-card" style={{ padding: 16, marginBottom: 16 }}>
          <h4>Candidate Enrichment</h4>
          <p className="text-muted text-sm mb-md">
            Find contact emails for candidates sourced without one. When off (or no provider is
            configured), such candidates are kept as no-contact leads for manual outreach — we never
            fabricate email addresses.
          </p>
          <label className="flex items-center gap-sm">
            <input
              type="checkbox"
              checked={!!config.enrichment_enabled}
              onChange={e => setConfig({ ...config, enrichment_enabled: e.target.checked })}
              disabled={isReadOnly}
            />
            <span>Enable enrichment</span>
          </label>
          {config.enrichment_enabled && (
            <p className="mt-md text-sm text-muted">
              Uses the Enrichment Provider configured under Settings &gt; Providers.
            </p>
          )}
        </div>

        <div className="settings-card" style={{ padding: 16 }}>
          <h4>Inbound Applications</h4>
          <p className="text-muted text-sm mb-md">
            Allow candidates to apply organically via a magic link from the careers page.
          </p>
          <label className="flex items-center gap-sm">
            <input
              type="checkbox"
              checked={config.inbound_enabled !== false}
              onChange={e => setConfig({ ...config, inbound_enabled: e.target.checked })}
              disabled={isReadOnly}
            />
            <span>Enable inbound applications</span>
          </label>
        </div>
      </div>
    </div>
  )
}
