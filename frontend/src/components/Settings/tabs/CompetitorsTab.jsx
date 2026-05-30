import { useState, useEffect, useCallback } from 'react'
import api from '../../../utils/api'
import { useAuth } from '../../../context/AuthContext'

export default function CompetitorsTab() {
  const { user } = useAuth()
  const [comps, setComps] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', website: '', industry: '', notes: '', department_id: '' })
  const [msg, setMsg] = useState('')

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

  const handleAdd = async () => {
    setMsg('')
    if (!form.department_id) {
      setMsg('Please select a department.')
      return
    }
    
    // Enforce 3 limit client-side for UX
    const deptComps = comps.filter(c => c.department_id === Number(form.department_id))
    if (deptComps.length >= 3) {
      setMsg('Maximum of 3 competitors allowed per department.')
      return
    }

    try {
      await api.post('/settings/competitors', {
        ...form,
        department_id: Number(form.department_id)
      })
      setForm({ name: '', website: '', industry: '', notes: '', department_id: isOrgHead ? '' : (user?.dept_id ?? user?.department_id) })
      fetchData()
      setShowModal(false)
    } catch (e) {
      setMsg(e.response?.data?.error?.message || e.message || 'Failed to add')
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/settings/competitors/${id}`)
      fetchData()
    } catch (e) { 
      alert(e.response?.data?.error?.message || 'Failed to delete competitor')
    }
  }

  const openAddModal = () => {
    setForm({ 
      name: '', website: '', industry: '', notes: '', 
      department_id: isOrgHead ? '' : (user?.dept_id ?? user?.department_id) 
    })
    setMsg('')
    setShowModal(true)
  }

  if (loading) return <div className="skeleton-card" style={{height: 200}} />

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
              <div key={deptId} className="settings-group-block" style={{ marginBottom: '2rem' }}>
                <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  {data.deptName}
                </h4>
                {data.competitors.length > 0 ? (
                  <div className="card-grid">
                    {data.competitors.map(c => (
                      <div key={c.id} className="settings-card">
                        <div className="card-header-row">
                          <h4>{c.name}</h4>
                          <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(c.id)} title="Delete">🗑️</button>
                        </div>
                        {c.industry && <p className="card-meta">{c.industry}</p>}
                        {c.website && <p className="card-link">{c.website}</p>}
                        {c.notes && <p className="card-notes">{c.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="section-desc" style={{ fontStyle: 'italic' }}>No competitors added for this department.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🏷</div>
            <h4>No departments found</h4>
            <p>You need to be assigned to a department to manage competitors.</p>
          </div>
        )}
      </div>

      {/* Add Competitor Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Add Competitor</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            {isOrgHead && (
              <div className="form-row">
                <div className="form-group" style={{ width: '100%' }}>
                  <label>Department</label>
                  <select 
                    value={form.department_id} 
                    onChange={e => setForm({...form, department_id: e.target.value})}
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
              <div className="form-group">
                <label>Company Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g., Acme Corp" />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="https://" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Industry</label>
                <input value={form.industry} onChange={e => setForm({...form, industry: e.target.value})} placeholder="Technology" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
            </div>
            {msg && <p className="form-msg error">{msg}</p>}
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
