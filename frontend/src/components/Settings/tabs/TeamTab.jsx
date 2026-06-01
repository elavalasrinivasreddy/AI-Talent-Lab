import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'
import { useAuth } from '../../../context/AuthContext'
import Chip from '../../common/Chip'
import Icon from '../../common/Icon'
import SlideOver from '../../common/SlideOver'
import ConfirmModal from '../../common/ConfirmModal'

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
  const [confirmToggleUser, setConfirmToggleUser] = useState(null)

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

  const confirmToggle = async () => {
    if (!confirmToggleUser) return
    try {
      await api.patch(`/auth/users/${confirmToggleUser.id}`, { is_active: !confirmToggleUser.is_active })
      setConfirmToggleUser(null)
      fetchUsers()
    } catch (e) { console.error(e) }
  }



  const roleBadge = (role) => {
    const map = {
      org_head:    { cls: 'admin', icon: '🟣', label: 'Org Head' },
      dept_admin:  { cls: 'admin', icon: '🟠', label: 'Dept Admin' },
      hr:          { cls: 'hr', icon: '🔵', label: 'HR' },
      team_lead:   { cls: 'hiring_manager', icon: '🟢', label: 'Team Lead' },
    }
    return map[role] || { cls: '', icon: '⚪', label: role }
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

            <div className="premium-list">
              {filtered.map(u => {
                const badgeInfo = roleBadge(u.role);
                return (
                  <div key={u.id} className="premium-list-item">
                    <div className="premium-list-item-left">
                      <div className="avatar-placeholder">
                        {u.name ? u.name.substring(0, 2).toUpperCase() : '👤'}
                      </div>
                      <div>
                        <span className="item-title">{u.name}</span>
                        <span className="item-subtitle">{u.email}</span>
                      </div>
                    </div>
                    
                    <div className="premium-list-item-right">
                      <div className="item-col-dept">
                        {getDeptName(u.department_id)}
                      </div>
                      
                      <div className="item-col-role">
                        <span className={`role-badge ${badgeInfo.cls}`}>
                          {badgeInfo.icon} {badgeInfo.label}
                        </span>
                      </div>

                      <div className="item-col-status">
                        {u.is_active ? (
                          !u.last_login_at ? (
                            <Chip variant="warning" dot style={{ cursor: 'default' }}>
                              Pending
                            </Chip>
                          ) : (
                            <Chip variant="success" dot 
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => setConfirmToggleUser(u)}
                                  title="Click to deactivate">
                              Active
                            </Chip>
                          )
                        ) : (
                          <Chip variant="neutral" dot
                                style={{ cursor: 'pointer' }}
                                onClick={() => setConfirmToggleUser(u)}
                                title="Click to activate">
                            Deactivated
                          </Chip>
                        )}
                      </div>

                      {/* Hover action menu placeholder */}
                      <button className="action-menu-btn" title="More actions">
                        <Icon name="more-vertical" size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {filtered.length === 0 && search && (
              <p className="empty-text">No results for "{search}"</p>
            )}
          </>
        ) : (
          <div className="premium-empty">
            <div className="premium-empty-icon">
              <Icon name="users" size={32} />
            </div>
            <h4>No team members yet</h4>
            <p>Add your first team member to get started collaborating on hiring pipelines.</p>
            <button className="btn btn-primary" onClick={() => { setShowModal(true); setMsg('') }}>
              + Invite Member
            </button>
          </div>
        )}
      </div>

      {/* Add Member SlideOver */}
      <SlideOver 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title="Invite Team Member"
      >
        <div className="form-row">
          <div className="form-group full-width">
            <label>Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Jane Doe" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="jane@company.com" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full-width">
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
          <div className="form-group full-width">
            <label>Department</label>
            <select 
              value={form.department_id} 
              onChange={e => setForm({...form, department_id: e.target.value})}
              disabled={currentUser?.role === 'dept_admin'}
            >
              {currentUser?.role === 'org_head' && (
                <option value="">{form.role === 'hr' ? 'Global (All Departments)' : 'None (Org Level)'}</option>
              )}
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
        <div className="btn-row" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
            {adding ? 'Sending...' : 'Send Invite'}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
        </div>
      </SlideOver>

      <ConfirmModal
        isOpen={!!confirmToggleUser}
        onClose={() => setConfirmToggleUser(null)}
        onConfirm={confirmToggle}
        title={confirmToggleUser?.is_active ? "Deactivate User" : "Activate User"}
        message={confirmToggleUser?.is_active 
          ? `Are you sure you want to deactivate ${confirmToggleUser?.name}? They will lose access to the platform.`
          : `Are you sure you want to activate ${confirmToggleUser?.name}? They will regain access to the platform.`}
        confirmText={confirmToggleUser?.is_active ? "Deactivate" : "Activate"}
        confirmVariant={confirmToggleUser?.is_active ? "danger" : "primary"}
      />
    </div>
  )
}
