import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'
import SlideOver from '../../common/SlideOver'
import Icon from '../../common/Icon'
import ConfirmModal from '../../common/ConfirmModal'

export default function InterviewTemplatesTab() {
  const [templates, setTemplates] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState(null)
  const [form, setForm] = useState({
    name: '', dimensions: [
      { name: '', weight: 25, description: '' },
    ]
  })
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

  const openEdit = (t) => {
    setEditingId(t.id)
    setForm({
      name: t.name,
      dimensions: parseDimensions(t.dimensions)
    })
    setMsg('')
    setShowModal(true)
  }

  const openAdd = () => {
    setEditingId(null)
    setForm({ name: '', dimensions: [{ name: '', weight: 25, description: '' }] })
    setMsg('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setMsg('')
    try {
      if (editingId) {
        await api.patch(`/settings/scorecard-templates/${editingId}`, {
          name: form.name,
          dimensions: JSON.stringify(form.dimensions),
        })
      } else {
        await api.post('/settings/scorecard-templates', {
          name: form.name,
          dimensions: JSON.stringify(form.dimensions),
        })
      }
      setForm({ name: '', dimensions: [{ name: '', weight: 25, description: '' }] })
      fetchTemplates()
      setShowModal(false)
    } catch (e) {
      setMsg(e.message || 'Failed to save')
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

  const confirmDelete = (id) => {
    setTemplateToDelete(id)
    setShowConfirm(true)
  }

  const handleDelete = async () => {
    if (!templateToDelete) return;
    try {
      await api.delete(`/settings/scorecard-templates/${templateToDelete}`)
      setShowConfirm(false)
      setTemplateToDelete(null)
      fetchTemplates()
    } catch (e) { console.error(e) }
  }

  const handleSetDefault = async (id) => {
    try {
      await api.post(`/settings/scorecard-templates/${id}/set-default`)
      fetchTemplates()
    } catch (e) { console.error(e) }
  }

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="section-header">
          <h3>🎯 Interview Scorecard Templates</h3>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            + New Template
          </button>
        </div>
        <p className="section-desc">
          AI auto-generates position-specific scorecards from the JD.
          These templates are fallback defaults if AI generation is disabled.
        </p>

        {templates.length > 0 ? (
          <div className="premium-list">
            {templates.map(t => {
              const dims = parseDimensions(t.dimensions)
              return (
                <div key={t.id} className="premium-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px' }}>{t.name}</h4>
                      {t.is_default && (
                        <span className="phase-tag" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' }}>
                          Active Default
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!t.is_default && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleSetDefault(t.id)} style={{ fontSize: '12px', padding: '4px 8px' }}>
                          Make Default
                        </button>
                      )}
                      <button className="action-menu-btn" onClick={() => openEdit(t)} title="Edit">
                        <Icon name="edit" size={16} />
                      </button>
                      <button className="action-menu-btn" onClick={() => confirmDelete(t.id)} title="Delete">
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </div>
                  <div style={{ width: '100%' }}>
                    {dims.map((d, i) => (
                      <div key={i} className="dimension-row" style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-text-secondary)', padding: '4px 0' }}>
                        <span style={{ fontWeight: 500, minWidth: '120px' }}>• {d.name}</span>
                        <span style={{ minWidth: '80px' }}>Weight: {d.weight}%</span>
                        <span style={{ flex: 1 }}>{d.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="premium-empty">
            <div className="premium-empty-icon">
              <Icon name="target" size={32} />
            </div>
            <h4>No scorecard templates</h4>
            <p>Create templates to structure your interview evaluations.</p>
          </div>
        )}
      </div>

      <SlideOver
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "✏️ Edit Scorecard Template" : "➕ New Scorecard Template"}
      >
        <div className="form-row">
          <div className="form-group full-width" style={{ marginBottom: 'var(--space-3)' }}>
            <label>Template Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
        </div>

        <label className="dim-label" style={{ fontWeight: 500, display: 'block', marginBottom: '8px' }}>Dimensions</label>
        {form.dimensions.map((d, i) => (
          <div key={i} className="dimension-edit-row" style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
            <input placeholder="Name" value={d.name} style={{ width: 140 }}
              onChange={e => updateDim(i, 'name', e.target.value)} />
            <div className="dimension-weight-edit" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="range" min={0} max={100} value={d.weight} style={{ width: '80px' }}
                onChange={e => updateDim(i, 'weight', Number(e.target.value))} />
              <span style={{ fontSize: '12px' }}>{d.weight}%</span>
            </div>
            <input placeholder="Description" value={d.description} style={{ flex: 1 }}
              onChange={e => updateDim(i, 'description', e.target.value)} />
            <button className="btn btn-sm btn-ghost" onClick={() => removeDim(i)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
        <button className="btn btn-sm btn-secondary" onClick={addDim} style={{ marginTop: 'var(--space-2)' }}>
          + Add Dimension
        </button>

        {msg && <p className="form-msg error" style={{ marginTop: 'var(--space-4)' }}>{msg}</p>}
        <div className="btn-row" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-primary" onClick={handleSave}>{editingId ? 'Save Changes' : 'Create Template'}</button>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
        </div>
      </SlideOver>

      {showConfirm && (
        <ConfirmModal
          isOpen={showConfirm}
          title="Delete Template?"
          message="Are you sure you want to delete this scorecard template? This cannot be undone."
          confirmText="Yes, Delete"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onClose={() => {
            setShowConfirm(false)
            setTemplateToDelete(null)
          }}
        />
      )}
    </div>
  )
}
