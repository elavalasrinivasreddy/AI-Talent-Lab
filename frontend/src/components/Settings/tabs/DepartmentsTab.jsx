import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'
import SlideOver from '../../common/SlideOver'
import ConfirmModal from '../../common/ConfirmModal'
import Icon from '../../common/Icon'

export default function DepartmentsTab() {
  const [depts, setDepts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', parent_dept_id: '' })
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState('')
  const [formMsg, setFormMsg] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [deptToDelete, setDeptToDelete] = useState(null)

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
    const u = users.find(u => u.id == id)
    return u ? u.name : ''
  }

  const handleAdd = async () => {
    setFormMsg('')
    try {
      await api.post('/settings/departments', {
        name: form.name,
        description: form.description || null,
        parent_dept_id: form.parent_dept_id ? Number(form.parent_dept_id) : null,
      })
      setForm({ name: '', description: '', parent_dept_id: '' })
      fetchDepts()
      setShowModal(false)
    } catch (e) {
      setFormMsg(e.message || 'Failed to add')
    }
  }

  const confirmDelete = (id) => {
    setDeptToDelete(id)
    setShowConfirm(true)
  }

  const executeDelete = async () => {
    if (!deptToDelete) return
    setMsg('')
    try {
      await api.delete(`/settings/departments/${deptToDelete}`)
      setShowConfirm(false)
      setDeptToDelete(null)
      fetchDepts()
    } catch (e) {
      setMsg(e.message || 'Cannot delete — has dependencies')
      setShowConfirm(false)
      setDeptToDelete(null)
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
          <div className="premium-list">
            {msg && <p className="form-msg error">{msg}</p>}
            {tree.map(d => (
              <div key={d.id} className="premium-list-item" style={{ marginLeft: `${d.depth * 24}px` }}>
                <div className="premium-list-item-left">
                  <div className="avatar-placeholder" style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
                    🏢
                  </div>
                  <div>
                    {editing?.id === d.id ? (
                      <input value={editing.name} className="inline-edit"
                             autoFocus
                             style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '4px 8px', color: 'var(--color-text)' }}
                             onChange={e => setEditing({...editing, name: e.target.value})}
                             onKeyDown={e => { if (e.key === 'Enter') handleUpdate(d.id) }} />
                    ) : (
                      <span className="item-title">
                        {d.depth > 0 && <span style={{ color: 'var(--color-text-muted)', marginRight: '6px' }}>└─</span>}
                        {d.name}
                      </span>
                    )}
                    <span className="item-subtitle">
                      {d.user_count > 0 ? `${d.user_count} members` : 'No members yet'}
                    </span>
                  </div>
                </div>
                
                <div className="premium-list-item-right">
                  {editing?.id === d.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => handleUpdate(d.id)}>Save</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="action-menu-btn" onClick={() => setEditing({id: d.id, name: d.name})} title="Edit">
                        <Icon name="edit-2" size={16} />
                      </button>
                      <button className="action-menu-btn" onClick={() => confirmDelete(d.id)} title="Delete">
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="premium-empty">
            <div className="premium-empty-icon">
              <Icon name="grid" size={32} />
            </div>
            <h4>No departments yet</h4>
            <p>Create departments to organize your hiring pipelines by team.</p>
            <button className="btn btn-primary" onClick={() => { setShowModal(true); setFormMsg('') }}>
              + Add Department
            </button>
          </div>
        )}
      </div>

      <SlideOver 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title="Add Department"
      >
        <div className="form-row">
          <div className="form-group full-width">
            <label>Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Engineering" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Description</label>
            <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Responsible for product development" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Parent Department</label>
            <select value={form.parent_dept_id} onChange={e => setForm({...form, parent_dept_id: e.target.value})}>
              <option value="">None (Top Level)</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        {formMsg && <p className="form-msg error">{formMsg}</p>}
        <div className="btn-row" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-primary" onClick={handleAdd}>Add Department</button>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
        </div>
      </SlideOver>

      {showConfirm && (
        <ConfirmModal
          isOpen={showConfirm}
          title="Delete Department?"
          message="Are you sure you want to delete this department? This action cannot be undone."
          confirmText="Yes, Delete"
          confirmVariant="danger"
          onConfirm={executeDelete}
          onClose={() => {
            setShowConfirm(false)
            setDeptToDelete(null)
          }}
        />
      )}
    </div>
  )
}
