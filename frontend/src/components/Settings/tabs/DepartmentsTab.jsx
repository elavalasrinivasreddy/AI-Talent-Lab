import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'

export default function DepartmentsTab() {
  const [depts, setDepts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', parent_dept_id: '', head_user_id: '' })
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState('')
  const [formMsg, setFormMsg] = useState('')

  const fetchDepts = useCallback(async () => {
    try {
      const res = await api.get('/settings/departments')
      setDepts(res.data.departments || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/auth/users')
      setUsers(res.data.users || [])
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { fetchDepts(); fetchUsers() }, [fetchDepts, fetchUsers])

  const buildTree = (items, parentId = null, depth = 0) => {
    return items
      .filter(d => (d.parent_dept_id || null) === parentId)
      .map(d => ({ ...d, depth, children: buildTree(items, d.id, depth + 1) }))
  }

  const flatTree = (nodes) => {
    let result = []
    for (const n of nodes) {
      result.push(n)
      result = [...result, ...flatTree(n.children)]
    }
    return result
  }

  const tree = flatTree(buildTree(depts))

  const getUserName = (id) => {
    const u = users.find(u => u.id === id)
    return u ? u.name : ''
  }

  const handleAdd = async () => {
    setFormMsg('')
    try {
      await api.post('/settings/departments', {
        name: form.name,
        description: form.description || null,
        parent_dept_id: form.parent_dept_id ? Number(form.parent_dept_id) : null,
        head_user_id: form.head_user_id ? Number(form.head_user_id) : null,
      })
      setForm({ name: '', description: '', parent_dept_id: '', head_user_id: '' })
      fetchDepts()
      setShowModal(false)
    } catch (e) {
      setFormMsg(e.message || 'Failed to add')
    }
  }

  const handleDelete = async (id) => {
    setMsg('')
    try {
      await api.delete(`/settings/departments/${id}`)
      fetchDepts()
    } catch (e) {
      setMsg(e.message || 'Cannot delete — has dependencies')
    }
  }

  const handleUpdate = async (id) => {
    try {
      await api.patch(`/settings/departments/${id}`, { name: editing.name })
      setEditing(null)
      fetchDepts()
    } catch (e) {
      setMsg(e.message || 'Failed to update')
    }
  }

  if (loading) return <div className="skeleton-card" style={{height: 200}} />

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="section-header">
          <h3>🏗 Departments</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowModal(true); setFormMsg('') }}>
            + Add Department
          </button>
        </div>

        {depts.length > 0 ? (
          <>
            {msg && <p className="form-msg error">{msg}</p>}
            {tree.map(d => (
              <div key={d.id} className="dept-tree-row">
                <div className="dept-indent" style={{'--depth': d.depth}}>
                  {d.depth > 0 && <span className="tree-connector">└─</span>}
                  {editing?.id === d.id ? (
                    <input value={editing.name} className="inline-edit"
                           onChange={e => setEditing({...editing, name: e.target.value})}
                           onKeyDown={e => { if (e.key === 'Enter') handleUpdate(d.id) }} />
                  ) : (
                    <span className="dept-name">{d.name}</span>
                  )}
                </div>
                <span className="dept-meta">
                  {d.head_user_id ? `👤 ${getUserName(d.head_user_id)}` : ''}
                  {d.user_count > 0 && ` · ${d.user_count} members`}
                </span>
                <div className="row-actions">
                  {editing?.id === d.id ? (
                    <>
                      <button className="btn btn-sm btn-primary" onClick={() => handleUpdate(d.id)}>Save</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing({id: d.id, name: d.name})} title="Edit">✏️</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(d.id)} title="Delete">🗑️</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🏗</div>
            <h4>No departments yet</h4>
            <p>Create departments to organize your hiring by team.</p>
          </div>
        )}
      </div>

      {/* Add Department Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Add Department</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Engineering" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Parent Department</label>
                <select value={form.parent_dept_id} onChange={e => setForm({...form, parent_dept_id: e.target.value})}>
                  <option value="">None (Top Level)</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Department Head</label>
                <select value={form.head_user_id} onChange={e => setForm({...form, head_user_id: e.target.value})}>
                  <option value="">Select user</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            {formMsg && <p className="form-msg error">{formMsg}</p>}
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
