import React, { useState, useEffect } from 'react'
import { settingsApi } from '../../../utils/api'
import InputField from '../../common/InputField'
import Button from '../../common/Button'
import StatusBadge from '../../common/StatusBadge'

export default function ProvidersTab() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  // Local state for edits
  const [edits, setEdits] = useState({})

  useEffect(() => {
    fetchProviders()
  }, [])

  const fetchProviders = async () => {
    try {
      setLoading(true)
      const res = await settingsApi.getProviders()
      setConfig(res.providers)
      setEdits({
        llm_provider: res.providers.llm_provider || 'groq',
        llm_model: res.providers.llm_model || 'llama-3.3-70b-versatile',
        embedding_provider: res.providers.embedding_provider || 'openai',
        embedding_model: res.providers.embedding_model || 'text-embedding-3-small',
        web_search_provider: res.providers.web_search_provider || 'tavily',
        enrichment_provider: res.providers.enrichment_provider || 'proxycurl',
        email_provider: res.providers.email_provider || 'smtp',
        smtp_host: res.providers.smtp_host || '',
        smtp_port: res.providers.smtp_port || 587,
        smtp_user: res.providers.smtp_user || '',
        from_email: res.providers.from_email || '',
        from_name: res.providers.from_name || '',
      })
    } catch (err) {
      setError(err.message || 'Failed to load provider configurations')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      const res = await settingsApi.updateProviders(edits)
      setConfig(res.providers)
      
      // Clear out API keys from edits so they don't get resent,
      // but keep the dropdowns/text fields that we just saved.
      setEdits(prev => {
        const next = { ...prev }
        delete next.groq_api_key
        delete next.openai_api_key
        delete next.gemini_api_key
        delete next.embedding_api_key
        delete next.tavily_api_key
        delete next.brave_api_key
        delete next.serpapi_api_key
        delete next.exa_api_key
        delete next.proxycurl_api_key
        delete next.apollo_api_key
        delete next.hunter_api_key
        delete next.resend_api_key
        delete next.smtp_password
        return next
      })
      alert('Provider configurations updated successfully.')
    } catch (err) {
      setError(err.message || 'Failed to save configurations')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="skeleton-text" style={{ width: '200px' }} />
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>
  }

  return (
    <div className="tab-pane">
      <div className="tab-header">
        <div>
          <h2>Providers & API Keys</h2>
          <p className="text-secondary">Configure platform-level services for LLMs, search, enrichment, and email. These settings apply globally.</p>
        </div>
        <Button variant="primary" loading={saving} onClick={handleSave}>
          Save Configuration
        </Button>
      </div>

      <div className="form-section">
        <h3>LLM Generation</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Primary LLM Provider</label>
            <select
              className="select-field"
              value={edits.llm_provider || ''}
              onChange={e => setEdits(prev => ({ ...prev, llm_provider: e.target.value }))}
            >
              <option value="groq">Groq (Recommended)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          <InputField
            label="Model Name"
            value={edits.llm_model || ''}
            onChange={e => setEdits(prev => ({ ...prev, llm_model: e.target.value }))}
            placeholder="e.g. llama-3.3-70b-versatile"
          />
        </div>

        <div className="form-grid mt-4">
          <InputField
            label={`Groq API Key ${config?.groq_api_key_masked ? `(${config.groq_api_key_masked})` : ''}`}
            value={edits.groq_api_key || ''}
            onChange={e => setEdits(prev => ({ ...prev, groq_api_key: e.target.value }))}
            placeholder={config?.groq_api_key_masked ? 'Leave blank to keep existing key' : 'gsk_...'}
            type="password"
          />
          <InputField
            label={`OpenAI API Key ${config?.openai_api_key_masked ? `(${config.openai_api_key_masked})` : ''}`}
            value={edits.openai_api_key || ''}
            onChange={e => setEdits(prev => ({ ...prev, openai_api_key: e.target.value }))}
            placeholder={config?.openai_api_key_masked ? 'Leave blank to keep existing key' : 'sk-...'}
            type="password"
          />
          <InputField
            label={`Gemini API Key ${config?.gemini_api_key_masked ? `(${config.gemini_api_key_masked})` : ''}`}
            value={edits.gemini_api_key || ''}
            onChange={e => setEdits(prev => ({ ...prev, gemini_api_key: e.target.value }))}
            placeholder={config?.gemini_api_key_masked ? 'Leave blank to keep existing key' : 'AIza...'}
            type="password"
          />
        </div>
      </div>

      <div className="form-section">
        <h3>Embeddings (Vector Search)</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Embedding Provider</label>
            <select
              className="select-field"
              value={edits.embedding_provider || ''}
              onChange={e => setEdits(prev => ({ ...prev, embedding_provider: e.target.value }))}
            >
              <option value="openai">OpenAI (Recommended)</option>
              <option value="huggingface">HuggingFace (Local/API)</option>
            </select>
          </div>
          <InputField
            label="Embedding Model"
            value={edits.embedding_model || ''}
            onChange={e => setEdits(prev => ({ ...prev, embedding_model: e.target.value }))}
            placeholder="e.g. text-embedding-3-small"
          />
          <InputField
            label={`API Key ${config?.embedding_api_key_masked ? `(${config.embedding_api_key_masked})` : ''}`}
            value={edits.embedding_api_key || ''}
            onChange={e => setEdits(prev => ({ ...prev, embedding_api_key: e.target.value }))}
            placeholder={config?.embedding_api_key_masked ? 'Leave blank to keep existing key' : 'sk-...'}
            type="password"
          />
        </div>
      </div>

      <div className="form-section">
        <h3>Web Search (Candidate Discovery)</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Search Provider</label>
            <select
              className="select-field"
              value={edits.web_search_provider || ''}
              onChange={e => setEdits(prev => ({ ...prev, web_search_provider: e.target.value }))}
            >
              <option value="tavily">Tavily (AI Search)</option>
              <option value="brave">Brave Search</option>
              <option value="serpapi">SerpAPI</option>
              <option value="exa">Exa (Metaphor)</option>
            </select>
          </div>
        </div>
        <div className="form-grid mt-4">
          <InputField
            label={`Tavily API Key ${config?.tavily_api_key_masked ? `(${config.tavily_api_key_masked})` : ''}`}
            value={edits.tavily_api_key || ''}
            onChange={e => setEdits(prev => ({ ...prev, tavily_api_key: e.target.value }))}
            placeholder={config?.tavily_api_key_masked ? 'Leave blank to keep existing key' : 'tvly-...'}
            type="password"
          />
          <InputField
            label={`Brave API Key ${config?.brave_api_key_masked ? `(${config.brave_api_key_masked})` : ''}`}
            value={edits.brave_api_key || ''}
            onChange={e => setEdits(prev => ({ ...prev, brave_api_key: e.target.value }))}
            placeholder={config?.brave_api_key_masked ? 'Leave blank to keep existing key' : 'BSA...'}
            type="password"
          />
          <InputField
            label={`SerpAPI Key ${config?.serpapi_api_key_masked ? `(${config.serpapi_api_key_masked})` : ''}`}
            value={edits.serpapi_api_key || ''}
            onChange={e => setEdits(prev => ({ ...prev, serpapi_api_key: e.target.value }))}
            placeholder={config?.serpapi_api_key_masked ? 'Leave blank to keep existing key' : ''}
            type="password"
          />
        </div>
      </div>

      <div className="form-section">
        <h3>Profile Enrichment (Social / Contact finding)</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Enrichment Provider</label>
            <select
              className="select-field"
              value={edits.enrichment_provider || ''}
              onChange={e => setEdits(prev => ({ ...prev, enrichment_provider: e.target.value }))}
            >
              <option value="proxycurl">Proxycurl (LinkedIn)</option>
              <option value="apollo">Apollo.io</option>
              <option value="hunter">Hunter.io (Emails only)</option>
            </select>
          </div>
        </div>
        <div className="form-grid mt-4">
          <InputField
            label={`Proxycurl API Key ${config?.proxycurl_api_key_masked ? `(${config.proxycurl_api_key_masked})` : ''}`}
            value={edits.proxycurl_api_key || ''}
            onChange={e => setEdits(prev => ({ ...prev, proxycurl_api_key: e.target.value }))}
            placeholder={config?.proxycurl_api_key_masked ? 'Leave blank to keep existing key' : ''}
            type="password"
          />
          <InputField
            label={`Apollo API Key ${config?.apollo_api_key_masked ? `(${config.apollo_api_key_masked})` : ''}`}
            value={edits.apollo_api_key || ''}
            onChange={e => setEdits(prev => ({ ...prev, apollo_api_key: e.target.value }))}
            placeholder={config?.apollo_api_key_masked ? 'Leave blank to keep existing key' : ''}
            type="password"
          />
          <InputField
            label={`Hunter API Key ${config?.hunter_api_key_masked ? `(${config.hunter_api_key_masked})` : ''}`}
            value={edits.hunter_api_key || ''}
            onChange={e => setEdits(prev => ({ ...prev, hunter_api_key: e.target.value }))}
            placeholder={config?.hunter_api_key_masked ? 'Leave blank to keep existing key' : ''}
            type="password"
          />
        </div>
      </div>

      <div className="form-section">
        <h3>Email Delivery</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Email Provider</label>
            <select
              className="select-field"
              value={edits.email_provider || ''}
              onChange={e => setEdits(prev => ({ ...prev, email_provider: e.target.value }))}
            >
              <option value="simulation">Simulation (Console logs)</option>
              <option value="resend">Resend API</option>
              <option value="smtp">Standard SMTP</option>
            </select>
          </div>
          <InputField
            label="From Email"
            value={edits.from_email || ''}
            onChange={e => setEdits(prev => ({ ...prev, from_email: e.target.value }))}
            placeholder="e.g. no-reply@example.com"
          />
          <InputField
            label="From Name"
            value={edits.from_name || ''}
            onChange={e => setEdits(prev => ({ ...prev, from_name: e.target.value }))}
            placeholder="e.g. AI Talent Lab"
          />
        </div>

        {edits.email_provider === 'resend' && (
          <div className="form-grid mt-4">
            <InputField
              label={`Resend API Key ${config?.resend_api_key_masked ? `(${config.resend_api_key_masked})` : ''}`}
              value={edits.resend_api_key || ''}
              onChange={e => setEdits(prev => ({ ...prev, resend_api_key: e.target.value }))}
              placeholder={config?.resend_api_key_masked ? 'Leave blank to keep existing key' : 're_...'}
              type="password"
            />
          </div>
        )}

        {edits.email_provider === 'smtp' && (
          <div className="form-grid mt-4">
            <InputField
              label="SMTP Host"
              value={edits.smtp_host || ''}
              onChange={e => setEdits(prev => ({ ...prev, smtp_host: e.target.value }))}
              placeholder="e.g. smtp.gmail.com"
            />
            <InputField
              label="SMTP Port"
              type="number"
              value={edits.smtp_port || ''}
              onChange={e => setEdits(prev => ({ ...prev, smtp_port: parseInt(e.target.value) || 587 }))}
            />
            <InputField
              label="SMTP User"
              value={edits.smtp_user || ''}
              onChange={e => setEdits(prev => ({ ...prev, smtp_user: e.target.value }))}
            />
            <InputField
              label={`SMTP Password ${config?.smtp_password_masked ? `(${config.smtp_password_masked})` : ''}`}
              value={edits.smtp_password || ''}
              onChange={e => setEdits(prev => ({ ...prev, smtp_password: e.target.value }))}
              placeholder={config?.smtp_password_masked ? 'Leave blank to keep existing password' : ''}
              type="password"
            />
          </div>
        )}
      </div>

    </div>
  )
}
