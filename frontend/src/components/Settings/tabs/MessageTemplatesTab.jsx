import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'
import SlideOver from '../../common/SlideOver'
import Icon from '../../common/Icon'

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
    if (!window.confirm('Are you sure you want to delete this template?')) return
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
          <div className="premium-list">
            {filtered.map(t => (
              <div key={t.id} className="premium-list-item">
                <div className="premium-list-item-left" style={{ flex: 1 }}>
                  <div className="avatar-placeholder" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}>
                    <Icon name="mail" size={16} />
                  </div>
                  <div>
                    <span className="item-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {t.name}
                      {t.is_default && <span style={{ fontSize: '10px', background: 'var(--color-primary-bg)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: '12px', fontWeight: 600 }}>Default</span>}
                    </span>
                    <span className="item-subtitle">
                      {catLabel(t.category)} {t.subject && `· Subject: ${t.subject}`}
                    </span>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', maxWidth: '600px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.body}
                    </div>
                  </div>
                </div>
                <div className="premium-list-item-right" style={{ flexShrink: 0, gap: '8px' }}>
                  <button className="action-menu-btn" onClick={() => setEditing({...t})} title="Edit">
                    <Icon name="edit-2" size={16} />
                  </button>
                  {!t.is_default && (
                    <button className="action-menu-btn" onClick={() => handleDelete(t.id)} title="Delete">
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
      <SlideOver
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Template"
      >
        {editing && (
          <>
            <div className="form-row">
              <div className="form-group full-width">
                <label>Name</label>
                <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group full-width">
                <label>Subject</label>
                <input value={editing.subject || ''} onChange={e => setEditing({...editing, subject: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group full-width">
                <label>Body</label>
                <textarea rows={8} value={editing.body} onChange={e => setEditing({...editing, body: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text)' }} />
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Save</button>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </>
        )}
      </SlideOver>

      {/* Add Template Modal */}
      <SlideOver
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="New Template"
      >
        <div className="form-row">
          <div className="form-group full-width">
            <label>Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Subject</label>
            <input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Body</label>
            <textarea rows={8} value={form.body} onChange={e => setForm({...form, body: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text)' }} />
          </div>
        </div>
        {msg && <p className="form-msg error">{msg}</p>}
        <div className="btn-row" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-primary" onClick={handleAdd}>Add Template</button>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
        </div>
      </SlideOver>
    </div>
  )
}
