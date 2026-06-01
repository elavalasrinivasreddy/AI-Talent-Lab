import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'
import SlideOver from '../../common/SlideOver'
import Icon from '../../common/Icon'
import Toggle from '../../common/Toggle'
import ConfirmModal from '../../common/ConfirmModal'

export default function ScreeningQuestionsTab() {
  const [questions, setQuestions] = useState([])
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    id: null, field_key: '', label: '', field_type: 'text', options: '', is_required: false, department_id: '',
  })
  const [msg, setMsg] = useState('')
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const fetchQs = useCallback(async () => {
    try {
      const res = await api.get('/settings/screening-questions')
      setQuestions(res.data.questions || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  const fetchDepts = useCallback(async () => {
    try {
      const res = await api.get('/settings/departments')
      setDepts(res.data.departments || [])
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { fetchQs(); fetchDepts() }, [fetchQs, fetchDepts])

  // Show all by default, filter optionally
  const filtered = deptFilter
    ? questions.filter(q => String(q.department_id) === deptFilter || !q.department_id)
    : questions

  const getDeptName = (deptId) => {
    if (!deptId) return 'Org Default'
    const d = depts.find(d => d.id === deptId)
    return d ? d.name : 'Dept #' + deptId
  }

  const handleSave = async () => {
    setMsg('')
    try {
      const payload = {
        ...form,
        department_id: form.department_id ? Number(form.department_id) : null,
      }
      if (form.id) {
        await api.patch(`/settings/screening-questions/${form.id}`, payload)
      } else {
        await api.post('/settings/screening-questions', {
          ...payload,
          sort_order: questions.length + 1,
        })
      }
      setForm({ id: null, field_key: '', label: '', field_type: 'text', options: '', is_required: false, department_id: '' })
      fetchQs()
      setShowModal(false)
    } catch (e) {
      setMsg(e.message || 'Failed to save')
    }
  }

  const handleEdit = (q) => {
    setForm({
      id: q.id,
      field_key: q.field_key || '',
      label: q.label,
      field_type: q.field_type,
      options: q.options || '',
      is_required: q.is_required,
      department_id: q.department_id || ''
    })
    setMsg('')
    setShowModal(true)
  }

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/settings/screening-questions/${deleteId}`)
      setDeleteId(null)
      fetchQs()
    } catch (e) { console.error(e) }
  }

  const handleDragSort = async () => {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null)
      setDragOverIdx(null)
      return
    }
    const items = [...filtered]
    const [moved] = items.splice(dragIdx, 1)
    items.splice(dragOverIdx, 0, moved)
    
    // Create new order mapping
    const order = items.map((q, i) => ({ id: q.id, sort_order: i + 1 }))
    
    setDragIdx(null)
    setDragOverIdx(null)
    
    try {
      await api.patch('/settings/screening-questions/reorder', { order })
      fetchQs()
    } catch (e) { console.error(e) }
  }

  const typeLabel = (t) => {
    const map = { text: '📝 Text', number: '🔢 Number', select: '📋 Select', date: '📅 Date', boolean: '✅ Yes/No' }
    return map[t] || t
  }

  if (loading) return <div className="skeleton-card" style={{ height: 200 }} />

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="section-header">
          <h3>❓ Screening Questions</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { 
            setForm({ id: null, field_key: '', label: '', field_type: 'text', options: '', is_required: false, department_id: '' })
            setShowModal(true); setMsg('') 
          }}>
            + Add Question
          </button>
        </div>
        <p className="section-desc">
          These questions are asked during the candidate magic link chat. Order determines chat flow.
        </p>

        {questions.length > 0 ? (
          <>
            <div className="filter-row">
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="filter-select">
                <option value="">All Departments</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div className="premium-list">
              {filtered.map((q, i) => (
                <div 
                  key={q.id} 
                  className={`premium-list-item ${dragOverIdx === i ? 'drag-over' : ''}`}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragEnter={() => setDragOverIdx(i)}
                  onDragEnd={handleDragSort}
                  onDragOver={(e) => e.preventDefault()}
                  style={{ 
                    cursor: dragIdx === i ? 'grabbing' : 'grab',
                    opacity: dragIdx === i ? 0.5 : 1,
                    transform: dragOverIdx === i && dragIdx !== i ? (dragIdx > i ? 'translateY(-4px)' : 'translateY(4px)') : 'none',
                    transition: 'transform 0.2s ease',
                    boxShadow: dragOverIdx === i ? '0 0 0 2px var(--color-primary)' : 'none'
                  }}
                >
                  <div className="premium-list-item-left">
                    <div className="drag-handle" style={{ cursor: 'inherit', marginRight: '8px', opacity: 0.4 }}>
                      <Icon name="more-vertical" size={16} />
                    </div>
                    <div className="avatar-placeholder" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}>
                      {i + 1}
                    </div>
                    <div>
                      <span className="item-title">
                        {q.label} {q.is_required && <span style={{ color: 'var(--color-danger)', marginLeft: '4px' }}>*</span>}
                      </span>
                      <span className="item-subtitle">
                        {typeLabel(q.field_type)}
                        {q.options && ` · Options: ${q.options}`}
                      </span>
                    </div>
                  </div>

                  <div className="premium-list-item-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="item-col-dept" style={{ minWidth: '120px' }}>
                      {getDeptName(q.department_id)}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="action-menu-btn" onClick={() => handleEdit(q)} title="Edit">
                        <Icon name="edit-2" size={16} />
                      </button>
                      <button className="action-menu-btn" onClick={() => setDeleteId(q.id)} title="Delete">
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="premium-empty">
            <div className="premium-empty-icon">
              <Icon name="help-circle" size={32} />
            </div>
            <h4>No screening questions yet</h4>
            <p>Add questions that candidates will answer during their chat application.</p>
            <button className="btn btn-primary" onClick={() => { setShowModal(true); setMsg('') }}>
              + Add Question
            </button>
          </div>
        )}
      </div>

      <SlideOver
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? "Edit Screening Question" : "Add Screening Question"}
      >
        <div className="form-row">
          <div className="form-group full-width">
            <label>Field Key (unique ID)</label>
            <input value={form.field_key} onChange={e => setForm({ ...form, field_key: e.target.value })}
              placeholder="e.g. notice_period" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Label</label>
            <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
              placeholder="Question shown to candidate" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Type</label>
            <select value={form.field_type} onChange={e => setForm({ ...form, field_type: e.target.value })}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="select">Select (dropdown)</option>
              <option value="date">Date</option>
              <option value="boolean">Yes/No</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Options (for select, comma-separated)</label>
            <input value={form.options} onChange={e => setForm({ ...form, options: e.target.value })}
              placeholder="Option 1, Option 2, ..." disabled={form.field_type !== 'select'} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Department (optional)</label>
            <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
              <option value="">Org Default</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width" style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: 'var(--space-2)' }}>
            <Toggle checked={form.is_required} onChange={checked => setForm({ ...form, is_required: checked })} />
            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>Required Field</span>
          </div>
        </div>
        {msg && <p className="form-msg error">{msg}</p>}
        <div className="btn-row" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-primary" onClick={handleSave}>{form.id ? "Save Changes" : "Add Question"}</button>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
        </div>
      </SlideOver>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete Question"
        message="Are you sure you want to delete this screening question? Candidates will no longer be asked this during application."
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  )
}
