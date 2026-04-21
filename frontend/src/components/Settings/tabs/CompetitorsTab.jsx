import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'

export default function CompetitorsTab() {
  const [comps, setComps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', website: '', industry: '', notes: '' })
  const [msg, setMsg] = useState('')

  const fetchComps = useCallback(async () => {
    try {
      const res = await api.get('/settings/competitors')
      setComps(res.data.competitors || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchComps() }, [fetchComps])

  const handleAdd = async () => {
    setMsg('')
    try {
      await api.post('/settings/competitors', form)
      setForm({ name: '', website: '', industry: '', notes: '' })
      fetchComps()
      setShowModal(false)
    } catch (e) {
      setMsg(e.message || 'Failed to add')
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/settings/competitors/${id}`)
      fetchComps()
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="skeleton-card" style={{height: 200}} />

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="section-header">
          <h3>🏷 Competitor Companies</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowModal(true); setMsg('') }}>
            + Add Competitor
          </button>
        </div>
        <p className="section-desc">
          These companies are used in JD market research (top 3 selected per search).
        </p>

        {comps.length > 0 ? (
          <div className="card-grid">
            {comps.map(c => (
              <div key={c.id} className="settings-card">
                <div className="card-header-row">
                  <h4>{c.name}</h4>
                  <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(c.id)} title="Delete">🗑️</button>
                </div>
                {c.industry && <p className="card-meta">{c.industry}</p>}
                {c.website && <p className="card-link">{c.website}</p>}
                {c.notes && <p className="card-notes">{c.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🏷</div>
            <h4>No competitors added yet</h4>
            <p>Add competitor companies to enhance AI-powered JD market research.</p>
          </div>
        )}
      </div>

      {/* Add Competitor Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Add Competitor</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Company Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g., Acme Corp" />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="https://" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Industry</label>
                <input value={form.industry} onChange={e => setForm({...form, industry: e.target.value})} placeholder="Technology" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
            </div>
            {msg && <p className="form-msg error">{msg}</p>}
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleAdd}>Add</button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
