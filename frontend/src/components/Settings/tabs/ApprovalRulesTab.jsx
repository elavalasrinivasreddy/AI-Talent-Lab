import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import Icon from '../../common/Icon'
import api from '../../../utils/api'

export default function ApprovalRulesTab() {
  const { user, login } = useAuth() // Assuming login or updateUser can be used, but let's just trigger a re-fetch or rely on local state
  // We can just rely on local state and the user context
  
  const isDeptAdmin = user?.role === 'dept_admin'
  const isHM = user?.role === 'team_lead'

  const [hrAutoApprove, setHrAutoApprove] = useState(false)
  const [jdAutoApprove, setJdAutoApprove] = useState(user?.auto_approve_jds || false)
  const [loading, setLoading] = useState(true)
  const [deptId, setDeptId] = useState(user?.department_id)

  useEffect(() => {
    async function loadData() {
      try {
        if (isDeptAdmin && user?.department_id) {
          const res = await api.get('/settings/departments')
          const myDept = res.departments.find(d => d.id === user.department_id)
          if (myDept) {
            setHrAutoApprove(myDept.auto_approve_hire_requests || false)
            setDeptId(myDept.id)
          }
        }
      } catch (err) {
        console.error('Failed to load department settings', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [isDeptAdmin, user?.department_id])

  const handleHrToggle = async (checked) => {
    setHrAutoApprove(checked)
    if (!deptId) return
    try {
      await api.patch(`/settings/departments/${deptId}`, {
        auto_approve_hire_requests: checked
      })
    } catch (err) {
      alert('Failed to update rule')
      setHrAutoApprove(!checked)
    }
  }

  const handleJdToggle = async (checked) => {
    setJdAutoApprove(checked)
    try {
      await api.patch('/auth/profile', {
        auto_approve_jds: checked
      })
    } catch (err) {
      alert('Failed to update rule')
      setJdAutoApprove(!checked)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="settings-form">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {isDeptAdmin && (
          <div className="settings-card" style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            borderLeft: hrAutoApprove ? '4px solid var(--color-success)' : '4px solid var(--color-border)',
            transition: 'all var(--transition-base)',
            padding: '24px',
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div style={{ display: 'flex', gap: '16px', maxWidth: '85%' }}>
              <div style={{ 
                width: '42px', 
                height: '42px', 
                borderRadius: '10px', 
                background: hrAutoApprove ? 'var(--color-success-bg)' : 'var(--color-bg-elevated)',
                color: hrAutoApprove ? 'var(--color-success)' : 'var(--color-text-muted)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'all var(--transition-base)',
                flexShrink: 0
              }}>
                <Icon name="file-text" size={20} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Auto-Approve Hire Requests
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Skip the manual Department Admin review. New requests submitted by your Team Leads will go straight to the HR queue.
                </p>
              </div>
            </div>
            <label className="st-toggle" style={{ marginTop: '10px' }}>
              <input type="checkbox" checked={hrAutoApprove} onChange={e => handleHrToggle(e.target.checked)} />
              <span className="st-slider"></span>
            </label>
          </div>
        )}

        {(isHM || isDeptAdmin) && (
          <div className="settings-card" style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            borderLeft: jdAutoApprove ? '4px solid var(--color-primary)' : '4px solid var(--color-border)',
            transition: 'all var(--transition-base)',
            padding: '24px',
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div style={{ display: 'flex', gap: '16px', maxWidth: '85%' }}>
              <div style={{ 
                width: '42px', 
                height: '42px', 
                borderRadius: '10px', 
                background: jdAutoApprove ? 'var(--color-primary-bg)' : 'var(--color-bg-elevated)',
                color: jdAutoApprove ? 'var(--color-primary)' : 'var(--color-text-muted)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'all var(--transition-base)',
                flexShrink: 0
              }}>
                <Icon name="zap" size={20} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Auto-Approve Final JDs
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Skip the final sign-off. Once HR completes the Job Description with the AI, the position will open automatically.
                </p>
              </div>
            </div>
            <label className="st-toggle" style={{ marginTop: '10px' }}>
              <input type="checkbox" checked={jdAutoApprove} onChange={e => handleJdToggle(e.target.checked)} />
              <span className="st-slider"></span>
            </label>
          </div>
        )}

      </div>
    </div>
  )
}
