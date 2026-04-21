import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'

const VARIABLES = ['{{candidate_name}}', '{{role_name}}', '{{org_name}}',
  '{{magic_link}}', '{{interview_date}}', '{{interview_time}}', '{{round_name}}']

const CATEGORIES = ['outreach', 'interview_process_overview', 'rejection',
  'interview_invite', 'follow_up', 'custom']

export default function MessageTemplatesTab() {
  const [templates, setTemplates] = useState([])
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'custom', subject: '', body: '' })
  const [msg, setMsg] = useState('')

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/settings/message-templates')
      setTemplates(res.data.templates || [])
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const filtered = filter ? templates.filter(t => t.category === filter) : templates

  const handleAdd = async () => {
    setMsg('')
    try {
      await api.post('/settings/message-templates', form)
      setForm({ name: '', category: 'custom', subject: '', body: '' })
      fetchTemplates()
      setShowModal(false)
    } catch (e) {
      setMsg(e.message || 'Failed to add')
    }
  }

  const handleSaveEdit = async () => {
    try {
      await api.patch(`/settings/message-templates/${editing.id}`, {
        name: editing.name, subject: editing.subject, body: editing.body,
      })
      setEditing(null)
      fetchTemplates()
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/settings/message-templates/${id}`)
      fetchTemplates()
    } catch (e) { console.error(e) }
  }

  const catLabel = (cat) => cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="section-header">
          <h3>📧 Message Templates</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowModal(true); setMsg('') }}>
            + New Template
          </button>
        </div>

        <div className="filter-row">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="filter-select">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
          </select>
        </div>

        {filtered.length > 0 ? (
          filtered.map(t => (
            <div key={t.id} className="template-card">
              <h4>
                {t.name}
                <span className="template-category">{catLabel(t.category)}</span>
                {t.is_default && <span className="template-category default-badge">Default</span>}
              </h4>
              {t.subject && <div className="template-subject">Subject: {t.subject}</div>}
              <div className="template-preview">{t.body?.substring(0, 120)}...</div>
              <div className="template-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => setEditing({...t})}>✏️ Edit</button>
                {!t.is_default && <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(t.id)}>🗑️ Delete</button>}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📧</div>
            <h4>No message templates</h4>
            <p>Create templates for outreach, interview invites, and rejections.</p>
          </div>
        )}

        <div className="variable-chips">
          <span className="variable-label">Variables:</span>
          {VARIABLES.map(v => <span key={v} className="variable-chip">{v}</span>)}
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Template</h2>
              <button className="modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="form-group" style={{marginBottom: 'var(--space-3)'}}>
              <label>Name</label>
              <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} />
            </div>
            <div className="form-group" style={{marginBottom: 'var(--space-3)'}}>
              <label>Subject</label>
              <input value={editing.subject || ''} onChange={e => setEditing({...editing, subject: e.target.value})} />
            </div>
            <div className="form-group" style={{marginBottom: 'var(--space-3)'}}>
              <label>Body</label>
              <textarea rows={8} value={editing.body} onChange={e => setEditing({...editing, body: e.target.value})} />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleSaveEdit}>Save</button>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Template Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ New Template</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{marginBottom: 'var(--space-3)'}}>
              <label>Subject</label>
              <input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} />
            </div>
            <div className="form-group" style={{marginBottom: 'var(--space-3)'}}>
              <label>Body</label>
              <textarea rows={5} value={form.body} onChange={e => setForm({...form, body: e.target.value})} />
            </div>
            {msg && <p className="form-msg error">{msg}</p>}
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleAdd}>Add Template</button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
