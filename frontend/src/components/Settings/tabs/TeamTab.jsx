import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'
import { useAuth } from '../../../context/AuthContext'
import Chip from '../../common/Chip'

export default function TeamTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ 
    name: '', 
    email: '', 
    role: 'hr', 
    department_id: currentUser?.role === 'dept_admin' ? (currentUser.department_id || '') : '' 
  })
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

  const filtered = users.filter(u => {
    if (u.id === currentUser?.id) return false;
    
    if (currentUser?.role === 'dept_admin') {
      if (u.department_id !== currentUser.department_id) return false;
      if (u.role === 'org_head' || u.role === 'dept_admin') return false;
    }
    
    return (u.name?.toLowerCase().includes(search.toLowerCase()) ||
            u.email?.toLowerCase().includes(search.toLowerCase()));
  })

  const handleAdd = async () => {
    setAdding(true); setMsg('')
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        department_id: form.department_id ? Number(form.department_id) : null,
      }
      await api.post('/auth/add-user', payload)
      setMsg(`Invite email sent to ${form.email}`)
      setForm({ 
        name: '', 
        email: '', 
        role: 'hr', 
        department_id: currentUser?.role === 'dept_admin' ? (currentUser.department_id || '') : '' 
      })
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
    const map = {
      org_head:    { icon: '🟣', label: 'Org Head' },
      dept_admin:  { icon: '🟠', label: 'Dept Admin' },
      hr:          { icon: '🔵', label: 'HR' },
      team_lead:   { icon: '🟢', label: 'Team Lead' },
    }
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
            + Invite Member
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
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                      </td>
                      <td style={{color: 'var(--color-text-secondary)'}}>{u.email}</td>
                      <td>
                        <select value={u.role} onChange={e => updateRole(u.id, e.target.value)} className="inline-select">
                          {currentUser?.role === 'org_head' && (
                            <>
                              <option value="org_head">{roleBadge('org_head').icon} Org Head</option>
                              <option value="dept_admin">{roleBadge('dept_admin').icon} Dept Admin</option>
                            </>
                          )}
                          <option value="hr">{roleBadge('hr').icon} HR</option>
                          <option value="team_lead">{roleBadge('team_lead').icon} Team Lead</option>
                        </select>
                      </td>
                      <td>
                        <select 
                          value={u.department_id || ''} 
                          onChange={e => updateDept(u.id, e.target.value)} 
                          className="inline-select"
                          disabled={currentUser?.role === 'dept_admin'}
                        >
                          {currentUser?.role === 'org_head' && <option value="">—</option>}
                          {depts
                            .filter(d => currentUser?.role === 'org_head' || d.id === currentUser?.department_id)
                            .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                          }
                        </select>
                      </td>
                      <td>
                        {u.is_active ? (
                          !u.last_login_at ? (
                            <Chip variant="warning" dot style={{ cursor: 'default' }}>
                              Pending
                            </Chip>
                          ) : (
                            <Chip variant="success" dot 
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => toggleActive(u.id, u.is_active)}
                                  title="Click to deactivate">
                              Active
                            </Chip>
                          )
                        ) : (
                          <Chip variant="neutral" dot
                                style={{ cursor: 'pointer' }}
                                onClick={() => toggleActive(u.id, u.is_active)}
                                title="Click to activate">
                            Deactivated
                          </Chip>
                        )}
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
                <label>Role</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="hr">HR</option>
                  <option value="team_lead">Team Lead</option>
                  {currentUser?.role === 'org_head' && (
                    <>
                      <option value="dept_admin">Dept Admin</option>
                      <option value="org_head">Org Head</option>
                    </>
                  )}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Department</label>
                <select 
                  value={form.department_id} 
                  onChange={e => setForm({...form, department_id: e.target.value})}
                  disabled={currentUser?.role === 'dept_admin'}
                >
                  {currentUser?.role === 'org_head' && <option value="">None</option>}
                  {depts
                    .filter(d => currentUser?.role === 'org_head' || d.id === currentUser?.department_id)
                    .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                  }
                </select>
              </div>
            </div>
            {msg && (
              <p className={`form-msg ${msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('error') ? 'error' : 'success'}`}>
                {msg}
              </p>
            )}
            <div className="btn-row">
              <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
                {adding ? 'Sending...' : 'Send Invite'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
