import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'

export default function ScreeningQuestionsTab() {
  const [questions, setQuestions] = useState([])
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    field_key: '', label: '', field_type: 'text', options: '', is_required: false, department_id: '',
  })
  const [msg, setMsg] = useState('')

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

  const handleAdd = async () => {
    setMsg('')
    try {
      await api.post('/settings/screening-questions', {
        ...form,
        department_id: form.department_id ? Number(form.department_id) : null,
        sort_order: questions.length + 1,
      })
      setForm({ field_key: '', label: '', field_type: 'text', options: '', is_required: false, department_id: '' })
      fetchQs()
      setShowModal(false)
    } catch (e) {
      setMsg(e.message || 'Failed to add')
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/settings/screening-questions/${id}`)
      fetchQs()
    } catch (e) { console.error(e) }
  }

  const moveItem = async (idx, direction) => {
    const items = [...filtered]
    const target = idx + direction
    if (target < 0 || target >= items.length) return
    ;[items[idx], items[target]] = [items[target], items[idx]]
    const order = items.map((q, i) => ({ id: q.id, sort_order: i + 1 }))
    try {
      await api.patch('/settings/screening-questions/reorder', { order })
      fetchQs()
    } catch (e) { console.error(e) }
  }

  const typeLabel = (t) => {
    const map = { text: '📝 Text', number: '🔢 Number', select: '📋 Select', date: '📅 Date', boolean: '✅ Yes/No' }
    return map[t] || t
  }

  if (loading) return <div className="skeleton-card" style={{height: 200}} />

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="section-header">
          <h3>❓ Screening Questions</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowModal(true); setMsg('') }}>
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

            <table className="settings-table">
              <thead>
                <tr>
                  <th>#</th><th>Label</th><th>Type</th><th>Dept</th><th>Required</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, i) => (
                  <tr key={q.id}>
                    <td>{i + 1}</td>
                    <td>
                      <strong>{q.label}</strong>
                      {q.options && <div className="cell-sub">{q.options}</div>}
                    </td>
                    <td>{typeLabel(q.field_type)}</td>
                    <td><span className="dept-badge">{getDeptName(q.department_id)}</span></td>
                    <td>{q.is_required ? '✅' : '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => moveItem(i, -1)} title="Move up">⬆️</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => moveItem(i, 1)} title="Move down">⬇️</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(q.id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">❓</div>
            <h4>No screening questions yet</h4>
            <p>Add questions that candidates will answer during their chat application.</p>
          </div>
        )}
      </div>

      {/* Add Question Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Add Screening Question</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Field Key (unique ID)</label>
                <input value={form.field_key} onChange={e => setForm({...form, field_key: e.target.value})}
                       placeholder="e.g. notice_period" />
              </div>
              <div className="form-group">
                <label>Label</label>
                <input value={form.label} onChange={e => setForm({...form, label: e.target.value})}
                       placeholder="Question shown to candidate" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select value={form.field_type} onChange={e => setForm({...form, field_type: e.target.value})}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="select">Select (dropdown)</option>
                  <option value="date">Date</option>
                  <option value="boolean">Yes/No</option>
                </select>
              </div>
              <div className="form-group">
                <label>Options (for select, comma-separated)</label>
                <input value={form.options} onChange={e => setForm({...form, options: e.target.value})}
                       placeholder="Option 1, Option 2, ..." disabled={form.field_type !== 'select'} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Department (optional)</label>
                <select value={form.department_id} onChange={e => setForm({...form, department_id: e.target.value})}>
                  <option value="">Org Default</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{display: 'flex', alignItems: 'center', paddingTop: 'var(--space-6)'}}>
                <label style={{display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer'}}>
                  <input type="checkbox" checked={form.is_required}
                         onChange={e => setForm({...form, is_required: e.target.checked})} />
                  Required
                </label>
              </div>
            </div>
            {msg && <p className="form-msg error">{msg}</p>}
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleAdd}>Add Question</button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
