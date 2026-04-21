import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'
import { useAuth } from '../../../context/AuthContext'

export default function TeamTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'recruiter', department_id: '' })
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/auth/users')
      setUsers(res.data.users || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  const fetchDepts = useCallback(async () => {
    try {
      const res = await api.get('/settings/departments')
      setDepts(res.data.departments || [])
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { fetchUsers(); fetchDepts() }, [fetchUsers, fetchDepts])

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = async () => {
    setAdding(true); setMsg('')
    try {
      await api.post('/auth/add-user', {
        ...form,
        department_id: form.department_id ? Number(form.department_id) : null,
      })
      setMsg('User added!')
      setForm({ name: '', email: '', password: '', role: 'recruiter', department_id: '' })
      fetchUsers()
      setTimeout(() => setShowModal(false), 800)
    } catch (e) {
      setMsg(e.message || 'Failed to add user')
    }
    setAdding(false)
  }

  const toggleActive = async (userId, isActive) => {
    try {
      await api.patch(`/auth/users/${userId}`, { is_active: !isActive })
      fetchUsers()
    } catch (e) { console.error(e) }
  }

  const updateRole = async (userId, role) => {
    try {
      await api.patch(`/auth/users/${userId}`, { role })
      fetchUsers()
    } catch (e) { console.error(e) }
  }

  const updateDept = async (userId, deptId) => {
    try {
      await api.patch(`/auth/users/${userId}`, {
        department_id: deptId ? Number(deptId) : null,
      })
      fetchUsers()
    } catch (e) { console.error(e) }
  }

  const roleBadge = (role) => {
    const map = { admin: { icon: '🟣', label: 'Admin' }, recruiter: { icon: '🔵', label: 'Recruiter' }, hiring_manager: { icon: '🟢', label: 'Hiring Mgr' } }
    return map[role] || { icon: '⚪', label: role }
  }

  const getDeptName = (deptId) => {
    const d = depts.find(d => d.id === deptId)
    return d ? d.name : '—'
  }

  if (loading) return <div className="skeleton-card" style={{height: 200}} />

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="section-header">
          <h3>👥 Team Directory</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowModal(true); setMsg('') }}>
            + Add Member
          </button>
        </div>

        {users.length > 0 ? (
          <>
            <div className="search-bar">
              <span>🔍</span>
              <input placeholder="Search by name or email..." value={search}
                     onChange={e => setSearch(e.target.value)} />
            </div>

            <table className="settings-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Role</th><th>Dept</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        {isCurrent && <span className="dept-badge" style={{ marginLeft: 8 }}>You</span>}
                      </td>
                      <td style={{color: 'var(--color-text-secondary)'}}>{u.email}</td>
                      <td>
                        {isCurrent && u.role === 'admin' ? (
                          <span>{roleBadge('admin').icon} Admin</span>
                        ) : (
                          <select value={u.role} onChange={e => updateRole(u.id, e.target.value)} className="inline-select" disabled={isCurrent}>
                            <option value="admin">{roleBadge('admin').icon} Admin</option>
                            <option value="recruiter">{roleBadge('recruiter').icon} Recruiter</option>
                            <option value="hiring_manager">{roleBadge('hiring_manager').icon} Hiring Mgr</option>
                          </select>
                        )}
                      </td>
                      <td>
                        <select value={u.department_id || ''} onChange={e => updateDept(u.id, e.target.value)} className="inline-select" disabled={isCurrent}>
                          <option value="">—</option>
                          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <button className={`status-pill ${u.is_active ? 'active' : 'inactive'}`}
                                onClick={() => toggleActive(u.id, u.is_active)}
                                disabled={isCurrent}>
                          {u.is_active ? '✅ Active' : '❌ Inactive'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && search && (
              <p className="empty-text">No results for "{search}"</p>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h4>No team members yet</h4>
            <p>Add your first team member to get started collaborating on hiring.</p>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Add Team Member</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="recruiter">Recruiter</option>
                  <option value="hiring_manager">Hiring Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Department</label>
                <select value={form.department_id} onChange={e => setForm({...form, department_id: e.target.value})}>
                  <option value="">None</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            {msg && <p className={`form-msg ${msg.includes('added') ? 'success' : 'error'}`}>{msg}</p>}
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
                {adding ? 'Adding...' : 'Add User'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
