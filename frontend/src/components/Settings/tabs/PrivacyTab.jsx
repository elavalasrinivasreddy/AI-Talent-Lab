/**
 * PrivacyTab.jsx – GDPR/DPDP compliance admin settings tab.
 * Shows deletion requests, allows processing, data export, and consent review.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { gdprApi } from '../../../utils/api'

export default function PrivacyTab() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [exportModal, setExportModal] = useState(null)

  const loadRequests = useCallback(async () => {
    try {
      const data = await gdprApi.getDeletionRequests()
      setRequests(data.requests || [])
    } catch (err) {
      console.error('Failed to load deletion requests:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadRequests() }, [loadRequests])

  const handleProcess = async (id) => {
    if (!confirm('This will permanently anonymize the candidate\'s data. Continue?')) return
    setProcessing(id)
    try {
      await gdprApi.processDeletion(id)
      await loadRequests()
    } catch (err) {
      alert('Failed to process deletion. ' + (err.message || ''))
    } finally {
      setProcessing(null)
    }
  }

  const handleExport = async (candidateId) => {
    try {
      const data = await gdprApi.exportCandidateData(candidateId)
      setExportModal(JSON.stringify(data, null, 2))
    } catch (err) {
      alert('Failed to export data.')
    }
  }

  const statusColors = {
    pending: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
    verified: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
    processing: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' },
    completed: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
    rejected: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
  }

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <h3>🔒 Privacy & Data Compliance</h3>
        <p className="section-desc">
          Manage GDPR/DPDP compliance. View deletion requests, process data removals, 
          and export candidate data for Subject Access Requests (SAR).
        </p>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <div className="settings-card" style={{ flex: 1, minWidth: 160 }}>
          <h4>📋 Total Requests</h4>
          <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
            {requests.length}
          </p>
        </div>
        <div className="settings-card" style={{ flex: 1, minWidth: 160 }}>
          <h4>⏳ Pending</h4>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b', margin: '4px 0 0' }}>
            {requests.filter(r => r.status === 'pending' || r.status === 'verified').length}
          </p>
        </div>
        <div className="settings-card" style={{ flex: 1, minWidth: 160 }}>
          <h4>✅ Completed</h4>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#22c55e', margin: '4px 0 0' }}>
            {requests.filter(r => r.status === 'completed').length}
          </p>
        </div>
      </div>

      {/* Deletion Requests Table */}
      <div className="settings-form-section">
        <div className="section-header">
          <h3>Data Deletion Requests</h3>
          <button className="btn btn-secondary btn-sm" onClick={loadRequests}>↻ Refresh</button>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h4>Loading requests…</h4>
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔒</div>
            <h4>No deletion requests</h4>
            <p>Data deletion requests from candidates will appear here.</p>
          </div>
        ) : (
          <table className="settings-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Candidate</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req.id}>
                  <td>{req.request_email}</td>
                  <td>{req.candidate_name || `#${req.candidate_id}`}</td>
                  <td>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: statusColors[req.status]?.bg || 'rgba(255,255,255,0.05)',
                      color: statusColors[req.status]?.color || 'inherit',
                    }}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {new Date(req.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {(req.status === 'verified') && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleProcess(req.id)}
                          disabled={processing === req.id}
                        >
                          {processing === req.id ? '…' : '🗑 Process'}
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleExport(req.candidate_id)}
                      >
                        📦 Export
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Data Retention Policy */}
      <div className="settings-form-section">
        <h3>📅 Data Retention Policy</h3>
        <p className="section-desc">
          Candidate data is automatically anonymized after the retention period expires. 
          Default: 24 months from last interaction.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label>Retention Period</label>
            <select defaultValue="24" disabled style={{ opacity: 0.6 }}>
              <option value="12">12 months</option>
              <option value="18">18 months</option>
              <option value="24">24 months</option>
              <option value="36">36 months</option>
            </select>
            <span className="form-hint">Configurable in a future update</span>
          </div>
          <div className="form-group">
            <label>Cleanup Frequency</label>
            <input type="text" value="Weekly (every Sunday, 3:00 AM)" disabled />
          </div>
        </div>
      </div>

      {/* Consent Config */}
      <div className="settings-form-section">
        <h3>✅ Consent Collection</h3>
        <p className="section-desc">
          Consent is automatically collected during the candidate application chat flow.
          Three types of consent are captured:
        </p>
        <div className="card-grid">
          <div className="settings-card">
            <h4>📋 Data Processing</h4>
            <p>Processing of personal data for evaluating candidacy</p>
          </div>
          <div className="settings-card">
            <h4>🤖 AI Analysis</h4>
            <p>AI-powered resume and skill match analysis</p>
          </div>
          <div className="settings-card">
            <h4>📧 Communication</h4>
            <p>Receiving application and opportunity updates</p>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {exportModal && (
        <div className="modal-overlay" onClick={() => setExportModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>📦 Candidate Data Export</h2>
            <p className="section-desc">
              This is the full Subject Access Request (SAR) data export for this candidate.
            </p>
            <textarea
              readOnly
              value={exportModal}
              style={{
                width: '100%',
                height: '400px',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: 'var(--space-3)',
                resize: 'vertical',
              }}
            />
            <div className="btn-row">
              <button className="btn btn-secondary" onClick={() => {
                navigator.clipboard.writeText(exportModal)
                alert('Copied to clipboard!')
              }}>
                📋 Copy JSON
              </button>
              <button className="btn btn-primary" onClick={() => {
                const blob = new Blob([exportModal], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = 'candidate_data_export.json'
                a.click(); URL.revokeObjectURL(url)
              }}>
                💾 Download
              </button>
              <button className="btn btn-ghost" onClick={() => setExportModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
