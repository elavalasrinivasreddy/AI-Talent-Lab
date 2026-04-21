import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'

export default function InterviewTemplatesTab() {
  const [templates, setTemplates] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', dimensions: [
    { name: '', weight: 25, description: '' },
  ]})
  const [msg, setMsg] = useState('')

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/settings/scorecard-templates')
      setTemplates(res.data.templates || [])
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const parseDimensions = (dims) => {
    try { return JSON.parse(dims) } catch { return [] }
  }

  const handleAdd = async () => {
    setMsg('')
    try {
      await api.post('/settings/scorecard-templates', {
        name: form.name,
        dimensions: JSON.stringify(form.dimensions),
      })
      setForm({ name: '', dimensions: [{ name: '', weight: 25, description: '' }] })
      fetchTemplates()
      setShowModal(false)
    } catch (e) {
      setMsg(e.message || 'Failed to add')
    }
  }

  const updateDim = (idx, field, val) => {
    const dims = [...form.dimensions]
    dims[idx] = { ...dims[idx], [field]: val }
    setForm({ ...form, dimensions: dims })
  }

  const addDim = () => {
    setForm({ ...form, dimensions: [...form.dimensions, { name: '', weight: 25, description: '' }] })
  }

  const removeDim = (idx) => {
    setForm({ ...form, dimensions: form.dimensions.filter((_, i) => i !== idx) })
  }

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="section-header">
          <h3>🎯 Interview Scorecard Templates</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowModal(true); setMsg('') }}>
            + New Template
          </button>
        </div>
        <p className="section-desc">
          AI auto-generates position-specific scorecards from the JD.
          These templates are fallback defaults if AI generation is disabled.
        </p>

        {templates.length > 0 ? (
          templates.map(t => {
            const dims = parseDimensions(t.dimensions)
            return (
              <div key={t.id} className="template-card">
                <h4>
                  {t.name}
                  {t.is_default && <span className="template-category default-badge">Default ✅</span>}
                </h4>
                {dims.map((d, i) => (
                  <div key={i} className="dimension-row">
                    <span className="dimension-name">• {d.name}</span>
                    <span className="dimension-weight">Weight: {d.weight}%</span>
                    <span className="dimension-desc">{d.description}</span>
                  </div>
                ))}
              </div>
            )
          })
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h4>No scorecard templates</h4>
            <p>Create templates to structure your interview evaluations.</p>
          </div>
        )}
      </div>

      {/* Add Template Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ New Scorecard Template</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-group" style={{marginBottom: 'var(--space-3)'}}>
              <label>Template Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>

            <label className="dim-label">Dimensions</label>
            {form.dimensions.map((d, i) => (
              <div key={i} className="dimension-edit-row">
                <input placeholder="Name" value={d.name} style={{width: 140}}
                       onChange={e => updateDim(i, 'name', e.target.value)} />
                <div className="dimension-weight-edit">
                  <input type="range" min={0} max={100} value={d.weight}
                         onChange={e => updateDim(i, 'weight', Number(e.target.value))} />
                  <span>{d.weight}%</span>
                </div>
                <input placeholder="Description" value={d.description} style={{flex: 1}}
                       onChange={e => updateDim(i, 'description', e.target.value)} />
                <button className="btn btn-sm btn-ghost" onClick={() => removeDim(i)}>🗑️</button>
              </div>
            ))}
            <button className="btn btn-sm btn-secondary" onClick={addDim} style={{marginTop: 'var(--space-2)'}}>
              + Add Dimension
            </button>

            {msg && <p className="form-msg error" style={{marginTop: 'var(--space-2)'}}>{msg}</p>}
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleAdd}>Create Template</button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
