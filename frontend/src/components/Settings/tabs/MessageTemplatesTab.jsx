import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../../utils/api'
import SlideOver from '../../common/SlideOver'
import Icon from '../../common/Icon'
import ConfirmModal from '../../common/ConfirmModal'
import Toast from '../../common/Toast'

const VARIABLES = ['{{candidate_name}}', '{{role_name}}', '{{org_name}}',
  '{{magic_link}}', '{{interview_date}}', '{{interview_time}}', '{{round_name}}']

const CATEGORIES = ['outreach', 'interview_process_overview', 'rejection',
  'interview_invite', 'follow_up', 'custom']

// Helper for preview
const DUMMY_DATA = {
  '{{candidate_name}}': 'Jane Doe',
  '{{role_name}}': 'Senior Frontend Engineer',
  '{{org_name}}': 'AI Talent Lab',
  '{{magic_link}}': 'https://aitalentlab.com/apply/xyz123',
  '{{interview_date}}': 'October 15, 2026',
  '{{interview_time}}': '10:00 AM PST',
  '{{round_name}}': 'Technical Architecture Round'
}

export default function MessageTemplatesTab() {
  const [templates, setTemplates] = useState([])
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'custom', subject: '', body: '' })
  const [msg, setMsg] = useState('')
  const [viewingPreview, setViewingPreview] = useState(null)
  
  // Application-level Modals & Notifications
  const [deletingTemplate, setDeletingTemplate] = useState(null)
  const [toast, setToast] = useState(null)
  
  // AI states
  const [isDrafting, setIsDrafting] = useState(false)
  const [draftTone, setDraftTone] = useState('Professional')
  const [draftScenario, setDraftScenario] = useState('')
  const [showDraftMenu, setShowDraftMenu] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)

  const textareaRef = useRef(null)

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
      setMsg(e.response?.data?.error?.message || e.message || 'Failed to add')
    }
  }

  const handleSaveEdit = async () => {
    try {
      await api.patch(`/settings/message-templates/${editing.id}`, {
        name: editing.name, subject: editing.subject, body: editing.body,
      })
      setToast({ message: 'Template saved successfully', type: 'success' })
      setEditing(null)
      fetchTemplates()
    } catch (e) {
      setMsg(e.response?.data?.error?.message || e.message || 'Failed to save changes')
    }
  }

  const confirmDelete = async () => {
    if (!deletingTemplate) return
    try {
      await api.delete(`/settings/message-templates/${deletingTemplate.id}`)
      setToast({ message: 'Template deleted', type: 'success' })
      setDeletingTemplate(null)
      fetchTemplates()
    } catch (e) {
      setToast({ message: e.response?.data?.error?.message || e.message || 'Failed to delete template', type: 'error' })
      setDeletingTemplate(null)
    }
  }

  const handleDuplicate = async (t) => {
    try {
      const res = await api.post('/settings/message-templates', {
        name: `${t.name} (Copy)`,
        category: t.category,
        subject: t.subject,
        body: t.body
      })
      await fetchTemplates()
      setEditing(res.data.template || res.data)
      setAnalysisResult(null)
      setShowDraftMenu(false)
      setToast({ message: 'Template duplicated', type: 'success' })
    } catch (e) {
      setToast({ message: e.response?.data?.error?.message || e.message || 'Failed to duplicate template', type: 'error' })
    }
  }

  const insertVariable = (variable) => {
    const activeForm = editing || form
    const currentBody = activeForm.body || ''
    
    // Attempt to insert at cursor if textarea is focused
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart
      const end = textareaRef.current.selectionEnd
      const newBody = currentBody.substring(0, start) + variable + currentBody.substring(end)
      
      if (editing) {
        setEditing({...editing, body: newBody})
      } else {
        setForm({...form, body: newBody})
      }
      
      // Restore cursor focus (timeout needed for React render cycle)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(start + variable.length, start + variable.length)
        }
      }, 0)
    } else {
      // Append to end
      if (editing) setEditing({...editing, body: currentBody + variable})
      else setForm({...form, body: currentBody + variable})
    }
  }

  const handleAutoDraft = async () => {
    if (!draftScenario.trim()) return
    setIsDrafting(true)
    try {
      const activeCat = editing ? editing.category : form.category
      const res = await api.post('/settings/message-templates/auto-draft', {
        category: activeCat,
        tone: draftTone,
        scenario: draftScenario
      })
      if (res.data.error) throw new Error(res.data.error)
      
      if (editing) {
        setEditing({...editing, name: res.data.name || editing.name, subject: res.data.subject, body: res.data.body})
      } else {
        setForm({...form, name: res.data.name || form.name, subject: res.data.subject, body: res.data.body})
      }
      setShowDraftMenu(false)
      setAnalysisResult(null)
      setToast({ message: 'Draft generated successfully', type: 'success' })
    } catch (e) {
      setMsg(e.response?.data?.error?.message || e.message || 'Auto-draft failed')
    } finally {
      setIsDrafting(false)
    }
  }

  const handleAnalyzeTone = async () => {
    const activeForm = editing || form
    if (!activeForm.body.trim()) return
    
    setIsAnalyzing(true)
    try {
      const res = await api.post('/settings/message-templates/analyze-tone', {
        subject: activeForm.subject || '',
        body: activeForm.body
      })
      if (res.data.error) throw new Error(res.data.error)
      setAnalysisResult(res.data.analysis)
    } catch (e) {
      setAnalysisResult('Failed to analyze: ' + e.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const renderPreviewText = (text) => {
    if (!text) return ''
    let parsed = text
    // Simple HTML escape
    parsed = parsed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    
    VARIABLES.forEach(v => {
      parsed = parsed.replace(new RegExp(v.replace(/[{}]/g, '\\$&'), 'g'), `<span class="preview-pill" style="background:var(--color-primary-bg);color:var(--color-primary);padding:2px 6px;border-radius:12px;font-size:12px;font-weight:600;white-space:nowrap;">${DUMMY_DATA[v]}</span>`)
    })
    return parsed
  }

  const catLabel = (cat) => cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const renderFormContent = (activeForm, setFn, isEditing) => (
    <div className="template-form-content" style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 180px)' }}>
      {/* Left Column: Edit Form */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0 }}>{isEditing ? 'Edit Template' : 'New Template'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => isEditing ? setEditing(null) : setShowModal(false)}>
            <Icon name="x" size={16} /> Close
          </button>
        </div>
          {/* Magic Draft Header */}
          <div style={{ marginBottom: 'var(--space-6)', background: 'var(--color-primary-bg)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--color-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showDraftMenu ? '12px' : '0' }}>
              <div>
                <h5 style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="zap" size={16} /> AI Magic Draft
                </h5>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>Generate a template based on tone and scenario.</p>
              </div>
              {!showDraftMenu && (
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => setShowDraftMenu(true)}
                  disabled={isDrafting}
                >
                  ✨ Auto-Draft
                </button>
              )}
            </div>
            
            {showDraftMenu && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                <input 
                  placeholder="Scenario (e.g. Rejecting after final round)" 
                  value={draftScenario}
                  onChange={e => setDraftScenario(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text)' }}
                />
                <select value={draftTone} onChange={e => setDraftTone(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text)' }}>
                  <option value="Professional">Professional</option>
                  <option value="Warm & Empathetic">Warm & Empathetic</option>
                  <option value="Direct & Concise">Direct & Concise</option>
                  <option value="Excited & Persuasive">Excited & Persuasive</option>
                </select>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowDraftMenu(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleAutoDraft} disabled={!draftScenario.trim() || isDrafting}>
                    <Icon name="zap" size={16} /> {isDrafting ? 'Generating...' : 'Generate Content'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group full-width">
              <label>Name</label>
              <input value={activeForm.name} onChange={e => setFn({...activeForm, name: e.target.value})} placeholder="e.g. Tech Screen Follow-up" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Category</label>
              <select value={activeForm.category} onChange={e => setFn({...activeForm, category: e.target.value})}>
                {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Subject</label>
              <input value={activeForm.subject || ''} onChange={e => setFn({...activeForm, subject: e.target.value})} placeholder="e.g. Next Steps at {{org_name}}" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group full-width">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                <label style={{ marginBottom: 0 }}>Body</label>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={handleAnalyzeTone}
                  disabled={isAnalyzing || !activeForm.body.trim()}
                  style={{ color: 'var(--color-primary)', fontSize: '12px', padding: '2px 8px' }}
                >
                  {isAnalyzing ? 'Analyzing...' : '🔍 Analyze Tone'}
                </button>
              </div>
              <textarea 
                ref={textareaRef}
                rows={10} 
                value={activeForm.body} 
                onChange={e => setFn({...activeForm, body: e.target.value})} 
                style={{ width: '100%', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text)', fontFamily: 'monospace' }} 
              />
            </div>
          </div>

          {analysisResult && (
            <div style={{ padding: '12px', background: 'var(--color-bg-card)', borderLeft: '4px solid var(--color-primary)', borderRadius: '4px', marginTop: '12px', fontSize: '13px' }}>
              <strong>AI Tone Analysis:</strong> {analysisResult}
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Click to insert variable at cursor:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {VARIABLES.map(v => (
                <button 
                  key={v} 
                  type="button"
                  onClick={() => insertVariable(v)}
                  style={{ 
                    background: 'var(--color-bg-elevated)', 
                    border: '1px solid var(--color-border)', 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = 'var(--color-primary-bg)'; e.currentTarget.style.color = 'var(--color-primary)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'var(--color-bg-elevated)'; e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          
          {msg && <p className="form-msg error" style={{ marginTop: '16px' }}>{msg}</p>}
          <div className="btn-row" style={{ marginTop: 'auto', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
            <button className="btn btn-primary" onClick={isEditing ? handleSaveEdit : handleAdd}>
              {isEditing ? 'Save Changes' : 'Add Template'}
            </button>
            <button className="btn btn-secondary" onClick={() => isEditing ? setEditing(null) : setShowModal(false)}>Cancel</button>
          </div>
        </div> {/* Close Left Column */}

      {/* Right Column: Live Preview Pane */}
      <div style={{ width: '400px', flexShrink: 0, overflowY: 'auto', background: 'var(--color-bg-elevated)', padding: '24px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
        <h4 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="eye" size={16} /> Live Preview</h4>
        {/* Email Client Mockup */}
        <div style={{ background: '#fff', color: '#333', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
          <div style={{ background: '#f5f5f5', padding: '12px 16px', borderBottom: '1px solid #ddd', display: 'flex', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }} />
          </div>
          <div style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
            <div style={{ fontSize: '13px', color: '#666' }}>
              <strong>Subject:</strong> <span dangerouslySetInnerHTML={{ __html: renderPreviewText(activeForm.subject) }} />
            </div>
          </div>
          <div style={{ padding: '24px', fontSize: '14px', lineHeight: '1.6', color: '#333', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: renderPreviewText(activeForm.body) }} />
        </div>
      </div> {/* Close Right Column */}
    </div>
  )

  return (
    <div className="settings-form" style={{ padding: (editing || showModal) ? '0' : 'var(--space-6)' }}>
      {editing ? renderFormContent(editing, setEditing, true) : showModal ? renderFormContent(form, setForm, false) : (
      <div className="settings-form-section">
        <div className="section-header">
          <h3>📧 Message Templates</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { 
            setForm({ name: '', category: 'custom', subject: '', body: '' }); 
            setMsg(''); 
            setAnalysisResult(null);
            setShowDraftMenu(false);
            setShowModal(true); 
          }}>
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
                  <button className="action-menu-btn" onClick={() => setViewingPreview(t)} title="Preview">
                    <Icon name="eye" size={16} />
                  </button>
                  <button className="action-menu-btn" onClick={() => handleDuplicate(t)} title="Duplicate">
                    <Icon name="copy" size={16} />
                  </button>
                  <button className="action-menu-btn" onClick={() => {
                    setEditing({...t});
                    setAnalysisResult(null);
                    setShowDraftMenu(false);
                  }} title="Edit">
                    <Icon name="edit-2" size={16} />
                  </button>
                  {!t.is_default && (
                    <button className="action-menu-btn" onClick={() => setDeletingTemplate(t)} title="Delete">
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
      </div>
      )}

      {/* Preview Modal */}
      <SlideOver
        isOpen={!!viewingPreview}
        onClose={() => setViewingPreview(null)}
        title="Template Preview"
      >
        {viewingPreview && (
          <div style={{ background: '#fff', color: '#333', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
            <div style={{ background: '#f5f5f5', padding: '12px 16px', borderBottom: '1px solid #ddd', display: 'flex', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }} />
            </div>
            <div style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
              <div style={{ fontSize: '13px', color: '#666' }}>
                <strong>Subject:</strong> <span dangerouslySetInnerHTML={{ __html: renderPreviewText(viewingPreview.subject) }} />
              </div>
            </div>
            <div style={{ padding: '24px', fontSize: '14px', lineHeight: '1.6', color: '#333', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: renderPreviewText(viewingPreview.body) }} />
          </div>
        )}
      </SlideOver>

      <ConfirmModal
        isOpen={!!deletingTemplate}
        title="Delete Template"
        message={deletingTemplate ? `Are you sure you want to delete the "${deletingTemplate.name}" template? This action cannot be undone.` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingTemplate(null)}
        confirmText="Delete"
        isDestructive={true}
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
