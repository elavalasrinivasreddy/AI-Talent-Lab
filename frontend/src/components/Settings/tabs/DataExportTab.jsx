/**
 * DataExportTab.jsx — GDPR / DPDP Article 20 data portability.
 *
 * Standalone Subject Access Request (SAR) export: an admin looks up any
 * candidate in their org and exports everything held about them as JSON.
 * (Export *in the context of a deletion request* lives in the GDPR/DPDP tab;
 * this tab is for proactive SARs where you may only know a name or email.)
 *
 * Backend: GET /api/v1/gdpr/export/{candidate_id} (require_org_head).
 */
import React, { useState, useCallback } from 'react'
import { gdprApi, talentPoolApi } from '../../../utils/api'
import Toast from '../../common/Toast'

export default function DataExportTab() {
  const [candidateId, setCandidateId] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportData, setExportData] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  // Optional lookup helper (talent pool is org-scoped)
  const [lookup, setLookup] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const runExport = useCallback(async (id) => {
    const targetId = String(id ?? candidateId).trim()
    if (!targetId || Number.isNaN(Number(targetId))) {
      setError('Enter a valid numeric candidate ID.')
      return
    }
    setExporting(true)
    setError(null)
    setExportData(null)
    try {
      const data = await gdprApi.exportCandidateData(targetId)
      setExportData(data)
    } catch (e) {
      const status = e?.response?.status
      setError(
        status === 404
          ? `No candidate with ID ${targetId} found in your organization.`
          : (e?.response?.data?.error?.message || 'Failed to export candidate data.')
      )
    } finally {
      setExporting(false)
    }
  }, [candidateId])

  const runLookup = useCallback(async (e) => {
    e?.preventDefault?.()
    const term = lookup.trim()
    if (!term) { setResults([]); return }
    setSearching(true)
    try {
      const res = await talentPoolApi.list({ q: term })
      const rows = res?.candidates ?? res?.items ?? res?.results ?? res?.data ?? []
      setResults(Array.isArray(rows) ? rows.slice(0, 8) : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [lookup])

  const filename = exportData?.candidate
    ? `sar_export_candidate_${exportData.candidate.id ?? candidateId}.json`
    : 'candidate_data_export.json'

  const jsonText = exportData ? JSON.stringify(exportData, null, 2) : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  const handleDownload = () => {
    const blob = new Blob([jsonText], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const sections = exportData
    ? [
        { label: 'Applications', count: exportData.applications?.length ?? 0 },
        { label: 'Consent records', count: exportData.consent_records?.length ?? 0 },
        { label: 'Pipeline events', count: exportData.pipeline_events?.length ?? 0 },
        { label: 'Interviews', count: exportData.interviews?.length ?? 0 },
      ]
    : []

  return (
    <div className="settings-form">
      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
      {copied && <Toast message="Export JSON copied to clipboard." type="success" onClose={() => setCopied(false)} />}

      <div className="settings-form-section">
        <h3>📦 Data Export (Subject Access Request)</h3>
        <p className="section-desc">
          Export everything held about a candidate — profile, applications, consent records,
          pipeline events and interviews — to satisfy a GDPR Article 20 / DPDP access request.
          Deletion-request exports live in the <strong>GDPR / DPDP</strong> tab.
        </p>
      </div>

      {/* Lookup helper */}
      <div className="settings-form-section">
        <label className="settings-label" htmlFor="sar-lookup">Find a candidate (optional)</label>
        <form onSubmit={runLookup} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            id="sar-lookup"
            className="settings-input"
            type="text"
            placeholder="Search your talent pool by name, skill or location…"
            value={lookup}
            onChange={e => setLookup(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-secondary" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {results.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
            {results.map(r => (
              <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 6 }}>
                <span>
                  <strong>{r.name || r.full_name || 'Unnamed'}</strong>
                  {(r.email) && <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8, fontSize: 13 }}>{r.email}</span>}
                  <span style={{ color: 'var(--color-text-muted)', marginLeft: 8, fontSize: 12 }}>#{r.id}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setCandidateId(String(r.id)); runExport(r.id) }}
                >
                  Export →
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Direct ID export */}
      <div className="settings-form-section">
        <label className="settings-label" htmlFor="sar-id">Candidate ID</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            id="sar-id"
            className="settings-input"
            type="number"
            min="1"
            placeholder="e.g. 1024"
            value={candidateId}
            onChange={e => setCandidateId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runExport() }}
            style={{ width: 200 }}
          />
          <button className="btn btn-primary" onClick={() => runExport()} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export data'}
          </button>
        </div>
        <p className="settings-hint">Exports are scoped to your organization — you can only access your own candidates.</p>
      </div>

      {/* Result */}
      {exportData && (
        <div className="settings-form-section">
          <div className="section-header">
            <h3>Export ready</h3>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Generated {exportData.exported_at ? new Date(exportData.exported_at).toLocaleString() : 'just now'}
            </span>
          </div>

          <div className="settings-card" style={{ marginBottom: 'var(--space-4)' }}>
            <h4>{exportData.candidate?.name || 'Candidate'}</h4>
            <p style={{ color: 'var(--color-text-secondary)', margin: '2px 0 0', fontSize: 13 }}>
              {exportData.candidate?.email || '—'} · ID #{exportData.candidate?.id ?? candidateId}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
            {sections.map(s => (
              <div key={s.label} className="settings-card" style={{ flex: 1, minWidth: 140 }}>
                <h4 style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{s.label}</h4>
                <p style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 0' }}>{s.count}</p>
              </div>
            ))}
          </div>

          <label className="settings-label" htmlFor="sar-json">Raw export (JSON)</label>
          <textarea
            id="sar-json"
            readOnly
            value={jsonText}
            aria-label="Candidate data export JSON"
            style={{
              width: '100%', height: 320,
              background: 'var(--color-bg-input)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              fontFamily: 'monospace', fontSize: 12,
              padding: 'var(--space-3)', resize: 'vertical',
            }}
          />
          <div className="btn-row" style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleCopy}>Copy JSON</button>
            <button className="btn btn-primary" onClick={handleDownload}>Download JSON</button>
          </div>
        </div>
      )}
    </div>
  )
}
