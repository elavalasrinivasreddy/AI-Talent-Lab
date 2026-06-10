import React, { useState, useEffect } from 'react'
import { Card, Input, Button, Toggle, Select, Chip, Icon } from '../../shared/ui'
import { settingsApi } from '../../../utils/api'

export default function SourcingTab({ isReadOnly }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState({
    source_adapter: 'simulation',
    inbound_enabled: true,
    auto_enrich: false,
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await settingsApi.getSourcingConfig()
      setConfig(res.settings || {
        source_adapter: 'simulation',
        inbound_enabled: true,
        auto_enrich: false,
      })
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
      // Show toast
    } catch (err) {
      console.error('Failed to save sourcing config', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-lg">Loading...</div>

  return (
    <div className="pd-tab-content">
      <div className="pd-tab-header">
        <div>
          <h2>Candidate Sourcing</h2>
          <p className="text-muted">Configure outbound search adapters and inbound candidate workflows.</p>
        </div>
        {!isReadOnly && (
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        )}
      </div>

      <div className="st-card-grid">
        <Card title="Source Adapter">
          <p className="text-muted text-sm mb-md">
            Select which adapter to use for finding new candidates.
          </p>
          <Select
            label="Search Adapter"
            value={config.source_adapter || 'simulation'}
            onChange={e => setConfig({ ...config, source_adapter: e.target.value })}
            disabled={isReadOnly}
            options={[
              { value: 'simulation', label: 'Simulation (Local testing)' },
              { value: 'tavily', label: 'Tavily (Web Search)' },
              { value: 'linkedin', label: 'LinkedIn API (Phase 3)' }
            ]}
          />
        </Card>

        <Card title="Candidate Enrichment">
          <p className="text-muted text-sm mb-md">
            Automatically find contact information (emails) for candidates sourced without it.
          </p>
          <div className="form-group row align-center">
            <Toggle
              checked={config.auto_enrich || false}
              onChange={e => setConfig({ ...config, auto_enrich: e.target.checked })}
              disabled={isReadOnly}
            />
            <span className="ml-sm">Enable Auto-Enrichment</span>
          </div>
          {config.auto_enrich && (
            <div className="mt-md p-md bg-subtle rounded text-sm">
              <Icon name="info" size={14} className="mr-xs text-primary" />
              This will use the configured Enrichment Provider (Settings &gt; Platform Providers) to discover emails.
            </div>
          )}
        </Card>

        <Card title="Inbound Magic Links">
          <p className="text-muted text-sm mb-md">
            Allow candidates to apply organically via a magic link generated from the career page.
          </p>
          <div className="form-group row align-center">
            <Toggle
              checked={config.inbound_enabled !== false}
              onChange={e => setConfig({ ...config, inbound_enabled: e.target.checked })}
              disabled={isReadOnly}
            />
            <span className="ml-sm">Enable Inbound Applications</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
