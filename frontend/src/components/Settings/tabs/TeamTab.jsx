import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'
import { useAuth } from '../../../context/AuthContext'
import Chip from '../../common/Chip'
import Icon from '../../common/Icon'

export default function TeamTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
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
    
    if (roleFilter && u.role !== roleFilter) return false;
    if (deptFilter && u.department_id !== Number(deptFilter)) return false;
    
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

        {filtered.length > 0 ? (
          <>
            <div className="settings-filters" style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
              <div className="search-input-wrapper" style={{ flex: 1, position: 'relative' }}>
                <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input 
                  placeholder="Search team members by name or email..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                />
              </div>
              <select 
                value={roleFilter} 
                onChange={e => setRoleFilter(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', maxWidth: '140px' }}
              >
                <option value="">All Roles</option>
                {currentUser?.role === 'org_head' && (
                  <>
                    <option value="org_head">Org Head</option>
                    <option value="dept_admin">Dept Admin</option>
                  </>
                )}
                <option value="team_lead">Team Lead</option>
                <option value="hr">HR</option>
              </select>
              {currentUser?.role === 'org_head' && (
                <select 
                  value={deptFilter} 
                  onChange={e => setDeptFilter(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', maxWidth: '160px' }}
                >
                  <option value="">All Departments</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>{roleBadge(u.role).icon}</span>
                          <span>{roleBadge(u.role).label}</span>
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                          {getDeptName(u.department_id)}
                        </span>
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
