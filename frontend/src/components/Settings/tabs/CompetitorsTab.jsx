import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'
import { useAuth } from '../../../context/AuthContext'
import SlideOver from '../../common/SlideOver'
import Chip from '../../common/Chip'
import Icon from '../../common/Icon'
import ConfirmModal from '../../common/ConfirmModal'

export default function CompetitorsTab() {
  const { user } = useAuth()
  const [comps, setComps] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', website: '', industry: '', notes: '', department_id: '' })
  const [msg, setMsg] = useState('')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null })
  const [expandedDepts, setExpandedDepts] = useState({})

  const isOrgHead = user?.role === 'org_head'

  const fetchData = useCallback(async () => {
    try {
      const [compsRes, deptsRes] = await Promise.all([
        api.get('/settings/competitors'),
        api.get('/settings/departments')
      ])
      setComps(compsRes.data.competitors || [])
      setDepartments(deptsRes.data.departments || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    setMsg('')
    if (!form.department_id) {
      setMsg('Please select a department.')
      return
    }

    // Enforce 3 limit client-side for UX
    const deptComps = comps.filter(c => c.department_id === Number(form.department_id) && c.id !== editingId)
    if (deptComps.length >= 3) {
      setMsg('Maximum of 3 competitors allowed per department.')
      return
    }

    try {
      if (editingId) {
        await api.patch(`/settings/competitors/${editingId}`, {
          name: form.name,
          website: form.website,
          industry: form.industry,
          notes: form.notes
        })
      } else {
        await api.post('/settings/competitors', {
          ...form,
          department_id: Number(form.department_id)
        })
      }
      setForm({ name: '', website: '', industry: '', notes: '', department_id: isOrgHead ? '' : (user?.dept_id ?? user?.department_id) })
      setEditingId(null)
      fetchData()
      setShowModal(false)
    } catch (e) {
      setMsg(e.response?.data?.error?.message || e.message || 'Failed to save')
    }
  }

  const handleDeleteClick = (id) => {
    setConfirmModal({ isOpen: true, id })
  }

  const confirmDelete = async () => {
    try {
      await api.delete(`/settings/competitors/${confirmModal.id}`)
      fetchData()
    } catch (e) {
      alert(e.response?.data?.error?.message || 'Failed to delete competitor')
    }
    setConfirmModal({ isOpen: false, id: null })
  }

  const openAddModal = () => {
    setEditingId(null)
    setForm({
      name: '', website: '', industry: '', notes: '',
      department_id: isOrgHead ? '' : (user?.dept_id ?? user?.department_id)
    })
    setMsg('')
    setShowModal(true)
  }

  const openEditModal = (comp) => {
    setEditingId(comp.id)
    setForm({
      name: comp.name || '',
      website: comp.website || '',
      industry: comp.industry || '',
      notes: comp.notes || '',
      department_id: comp.department_id || ''
    })
    setMsg('')
    setShowModal(true)
  }

  const toggleDept = (deptId) => {
    setExpandedDepts(prev => ({ ...prev, [deptId]: !prev[deptId] }))
  }

  if (loading) return <div className="skeleton-card" style={{ height: 200 }} />

  // Group competitors by department
  const compsByDept = departments.reduce((acc, dept) => {
    acc[dept.id] = {
      deptName: dept.name,
      competitors: comps.filter(c => c.department_id === dept.id)
    }
    return acc
  }, {})

  // If dept admin, they only see their own department
  const myDeptId = user?.dept_id ?? user?.department_id
  const displayDepts = isOrgHead
    ? Object.entries(compsByDept)
    : Object.entries(compsByDept).filter(([deptId]) => Number(deptId) === myDeptId)

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="section-header">
          <h3>🏷 Competitor Companies</h3>
          <button className="btn btn-primary btn-sm" onClick={openAddModal}>
            + Add Competitor
          </button>
        </div>
        <p className="section-desc">
          These companies are used in JD market research. Limit: 3 per department.
        </p>

        {displayDepts.length > 0 ? (
          <div className="department-groups">
            {displayDepts.map(([deptId, data]) => (
              <div key={deptId} className="settings-group-block" style={{ marginBottom: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div 
                  onClick={() => toggleDept(deptId)}
                  style={{ 
                    padding: '12px 16px', 
                    background: 'var(--color-bg-card)', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderBottom: expandedDepts[deptId] ? '1px solid var(--color-border)' : 'none'
                  }}
                >
                  <h4 style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {data.deptName}
                    <Chip variant="neutral" size="xs">{data.competitors.length} / 3</Chip>
                  </h4>
                  <div style={{ color: 'var(--color-text-muted)' }}>
                    <Icon name={expandedDepts[deptId] ? 'chevron-up' : 'chevron-down'} size={16} />
                  </div>
                </div>

                {expandedDepts[deptId] && (
                  <div style={{ padding: '16px', background: 'var(--color-bg-elevated)' }}>
                    {data.competitors.length > 0 ? (
                      <div className="premium-list">
                        {data.competitors.map(c => (
                          <div key={c.id} className="premium-list-item">
                            <div className="premium-list-item-left">
                              <div className="avatar-placeholder" style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}>
                                <Icon name="briefcase" size={16} />
                              </div>
                              <div>
                                <span className="item-title">{c.name}</span>
                                <span className="item-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                  <Chip variant="neutral" size="xs">{c.industry || 'No industry'}</Chip>
                                  {c.website && <span style={{ color: 'var(--color-primary)' }}>{c.website}</span>}
                                </span>
                                {c.notes && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{c.notes}</div>}
                              </div>
                            </div>
                            <div className="premium-list-item-right" style={{ display: 'flex', gap: '8px' }}>
                              <button className="action-menu-btn" onClick={() => openEditModal(c)} title="Edit">
                                <Icon name="pencil" size={16} />
                              </button>
                              <button className="action-menu-btn" onClick={() => handleDeleteClick(c.id)} title="Delete">
                                <Icon name="trash" size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="premium-empty" style={{ padding: 'var(--space-4)', minHeight: '120px' }}>
                        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>No competitors added for this department.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="premium-empty">
            <div className="premium-empty-icon">
              <Icon name="briefcase" size={32} />
            </div>
            <h4>No departments found</h4>
            <p>You need to be assigned to a department to manage competitors.</p>
          </div>
        )}
      </div>

      <SlideOver
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? "Edit Competitor" : "Add Competitor"}
      >
        {isOrgHead && !editingId && (
          <div className="form-row">
            <div className="form-group full-width">
              <label>Department</label>
              <select
                value={form.department_id}
                onChange={e => setForm({ ...form, department_id: e.target.value })}
              >
                <option value="">Select Department...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group full-width">
            <label>Company Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Acme Corp" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Website</label>
            <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Industry</label>
            <input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="Technology" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full-width">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Key insights, strengths, weaknesses..." rows={3} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text)' }} />
          </div>
        </div>

        {msg && <p className="form-msg error">{msg}</p>}

        <div className="btn-row" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-primary" onClick={handleSave}>
            {editingId ? 'Save Changes' : 'Add Competitor'}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
        </div>
      </SlideOver>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Competitor"
        message="Are you sure you want to delete this competitor? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmModal({ isOpen: false, id: null })}
        variant="danger"
      />
    </div>
  )
}
