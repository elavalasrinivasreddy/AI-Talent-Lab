import React, { useState, useEffect } from 'react'
import { settingsApi } from '../../../utils/api'
import Icon from '../../common/Icon'
import Toggle from '../../common/Toggle'
import Toast from '../../common/Toast'
import ConfirmModal from '../../common/ConfirmModal'

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
  const [toast, setToast] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await settingsApi.getSourcingConfig()
      setConfig({ ...DEFAULT_CONFIG, ...(res.settings || {}) })
    } catch (err) {
      console.error('Failed to load sourcing config', err)
      showToast('Failed to load sourcing configuration', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.updateSourcingConfig(config)
      showToast('Sourcing configuration saved successfully')
    } catch (err) {
      console.error('Failed to save sourcing config', err)
      showToast('Failed to save configuration', 'error')
      throw err // Let ConfirmModal catch the error
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-lg">Loading...</div>

  return (
    <div className="settings-form relative">
      <div className="flex justify-between items-center mb-xl">
        <div>
          <h3>Candidate Sourcing</h3>
          <p className="text-muted" style={{ marginTop: '4px' }}>Configure outbound search adapters and inbound candidate workflows.</p>
        </div>
        {!isReadOnly && (
          <button className="btn btn-primary" onClick={() => setShowConfirm(true)} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Source Adapter Card */}
        <div className="settings-card" style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'space-between',
          borderLeft: '4px solid var(--color-primary)',
          transition: 'all var(--transition-base)',
          padding: '24px',
          background: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <div style={{ display: 'flex', gap: '16px', maxWidth: '85%' }}>
            <div style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '10px', 
              background: 'var(--color-primary-bg)',
              color: 'var(--color-primary)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Icon name="search" size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Source Adapter
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Select which adapter to use for finding new candidates during automated sourcing runs.
              </p>
              <select
                className="form-input"
                value={config.source_adapter || 'simulation'}
                onChange={e => setConfig({ ...config, source_adapter: e.target.value })}
                disabled={isReadOnly}
                style={{ width: '100%', maxWidth: '300px', padding: '8px 12px', height: '40px' }}
              >
                <option value="simulation">Simulation (local testing only)</option>
                <option value="tavily">Tavily (web search)</option>
                <option value="linkedin">LinkedIn API (Phase 3)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Enrichment Card */}
        <div className="settings-card" style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'space-between',
          borderLeft: config.enrichment_enabled ? '4px solid var(--color-success)' : '4px solid var(--color-border)',
          transition: 'all var(--transition-base)',
          padding: '24px',
          background: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <div style={{ display: 'flex', gap: '16px', maxWidth: '85%' }}>
            <div style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '10px', 
              background: config.enrichment_enabled ? 'var(--color-success-bg)' : 'var(--color-bg-elevated)',
              color: config.enrichment_enabled ? 'var(--color-success)' : 'var(--color-text-muted)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'all var(--transition-base)',
              flexShrink: 0
            }}>
              <Icon name="mail" size={20} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Candidate Enrichment
              </h4>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Find contact emails for candidates sourced without one. When off (or no provider is configured), such candidates are kept as no-contact leads for manual outreach — we never fabricate email addresses.
              </p>
              {config.enrichment_enabled && (
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="info" size={14} /> Uses the Enrichment Provider configured under Settings &gt; Providers.
                </p>
              )}
            </div>
          </div>
          <div style={{ marginTop: '10px' }}>
            <Toggle 
              checked={!!config.enrichment_enabled} 
              onChange={checked => setConfig({ ...config, enrichment_enabled: checked })} 
              disabled={isReadOnly}
            />
          </div>
        </div>

        {/* Inbound Applications Card */}
        <div className="settings-card" style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'space-between',
          borderLeft: config.inbound_enabled !== false ? '4px solid var(--color-success)' : '4px solid var(--color-border)',
          transition: 'all var(--transition-base)',
          padding: '24px',
          background: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <div style={{ display: 'flex', gap: '16px', maxWidth: '85%' }}>
            <div style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '10px', 
              background: config.inbound_enabled !== false ? 'var(--color-success-bg)' : 'var(--color-bg-elevated)',
              color: config.inbound_enabled !== false ? 'var(--color-success)' : 'var(--color-text-muted)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'all var(--transition-base)',
              flexShrink: 0
            }}>
              <Icon name="link" size={20} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Inbound Applications
              </h4>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Allow candidates to apply organically via a magic link from the careers page.
              </p>
            </div>
          </div>
          <div style={{ marginTop: '10px' }}>
            <Toggle 
              checked={config.inbound_enabled !== false} 
              onChange={checked => setConfig({ ...config, inbound_enabled: checked })} 
              disabled={isReadOnly}
            />
          </div>
        </div>

      </div>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSave}
        title="Update Sourcing Configuration"
        message="Are you sure you want to update the sourcing configuration? These changes apply to all new automated sourcing runs and candidate imports across the organization."
        confirmText="Save Settings"
        confirmVariant="primary"
      />

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  )
}
