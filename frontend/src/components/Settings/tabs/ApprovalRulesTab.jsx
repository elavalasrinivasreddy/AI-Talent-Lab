import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import Icon from '../../common/Icon'
import Toggle from '../../common/Toggle'
import Toast from '../../common/Toast'
import api from '../../../utils/api'

export default function ApprovalRulesTab() {
  const { user } = useAuth()
  
  const isOrgHead = user?.role === 'org_head'
  const isDeptAdmin = user?.role === 'dept_admin' || isOrgHead
  const isHM = user?.role === 'team_lead'

  // States
  const [departments, setDepartments] = useState([])
  const [selectedDeptId, setSelectedDeptId] = useState(user?.department_id || '')
  const [hrAutoApprove, setHrAutoApprove] = useState(false)
  const [jdAutoApprove, setJdAutoApprove] = useState(user?.auto_approve_jds || false)
  const [allowAutoApproveJds, setAllowAutoApproveJds] = useState(true)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        // 1. Fetch departments if org_head or dept_admin
        if (isDeptAdmin) {
          const res = await api.get('/settings/departments')
          const deptList = res.data.departments || []
          setDepartments(deptList)
          
          // Set initial hrAutoApprove
          const targetDeptId = isOrgHead ? (deptList[0]?.id || '') : user?.department_id
          setSelectedDeptId(targetDeptId)
          if (targetDeptId) {
            const dept = deptList.find(d => d.id === targetDeptId)
            setHrAutoApprove(dept?.auto_approve_hire_requests || false)
          }
        }
        
        // 2. Fetch org settings to get global JD approval policy
        if (isOrgHead || isHM) {
          const orgRes = await api.get('/settings/org')
          // If undefined, default to true
          const isAllowed = orgRes.data?.org?.allow_auto_approve_jds !== false
          setAllowAutoApproveJds(isAllowed)
          if (!isAllowed && isHM) {
            setJdAutoApprove(false) // Force false if not allowed
          }
        }
      } catch (err) {
        console.error('Failed to load settings', err)
        showToast('Failed to load settings', 'error')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [isDeptAdmin, isOrgHead, isHM, user?.department_id])

  // Handle department change for Org Head
  const handleDeptChange = (e) => {
    const deptId = parseInt(e.target.value)
    setSelectedDeptId(deptId)
    const dept = departments.find(d => d.id === deptId)
    setHrAutoApprove(dept?.auto_approve_hire_requests || false)
  }

  const handleHrToggle = async (checked) => {
    if (!selectedDeptId) return
    const prev = hrAutoApprove
    setHrAutoApprove(checked)
    try {
      await api.patch(`/settings/departments/${selectedDeptId}`, {
        auto_approve_hire_requests: checked
      })
      
      // Update local departments array
      setDepartments(prevDepts => prevDepts.map(d => 
        d.id === selectedDeptId ? { ...d, auto_approve_hire_requests: checked } : d
      ))
      
      showToast('Department rules updated successfully')
    } catch (err) {
      setHrAutoApprove(prev)
      showToast(err.message || 'Failed to update rule', 'error')
    }
  }

  const handleJdToggle = async (checked) => {
    const prev = jdAutoApprove
    setJdAutoApprove(checked)
    try {
      await api.patch('/auth/profile', {
        auto_approve_jds: checked
      })
      showToast('Your JD approval rule was updated')
    } catch (err) {
      setJdAutoApprove(prev)
      showToast(err.message || 'Failed to update rule', 'error')
    }
  }

  const handleGlobalJdToggle = async (checked) => {
    const prev = allowAutoApproveJds
    setAllowAutoApproveJds(checked)
    try {
      await api.patch('/settings/org', {
        allow_auto_approve_jds: checked
      })
      showToast('Organization policies updated successfully')
    } catch (err) {
      setAllowAutoApproveJds(prev)
      showToast(err.message || 'Failed to update organization policies', 'error')
    }
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="settings-form relative">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* ORG HEAD ONLY: Global Override for JDs */}
        {isOrgHead && (
          <div className="settings-card" style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            borderLeft: allowAutoApproveJds ? '4px solid var(--color-success)' : '4px solid var(--color-warning)',
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
                background: allowAutoApproveJds ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                color: allowAutoApproveJds ? 'var(--color-success)' : 'var(--color-warning)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'all var(--transition-base)',
                flexShrink: 0
              }}>
                <Icon name={allowAutoApproveJds ? "shield" : "shield-off"} size={20} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Allow Team Leads to Auto-Approve JDs
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Global Policy: If turned off, Team Leads will be forced to manually review all AI-generated JDs, overriding their personal settings.
                </p>
              </div>
            </div>
            <div style={{ marginTop: '10px' }}>
              <Toggle checked={allowAutoApproveJds} onChange={checked => handleGlobalJdToggle(checked)} />
            </div>
          </div>
        )}

        {/* DEPT ADMIN / ORG HEAD: Department-level Hire Request Rules */}
        {isDeptAdmin && (
          <div className="settings-card" style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '20px',
            borderLeft: hrAutoApprove ? '4px solid var(--color-primary)' : '4px solid var(--color-border)',
            transition: 'all var(--transition-base)',
            padding: '24px',
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)'
          }}>
            {/* Org Head Dept Selector */}
            {isOrgHead && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  Configure rules for:
                </span>
                <select 
                  className="form-input" 
                  value={selectedDeptId} 
                  onChange={handleDeptChange}
                  style={{ width: '250px', padding: '6px 12px', height: '36px' }}
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                  {departments.length === 0 && <option value="">No departments available</option>}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '16px', maxWidth: '85%' }}>
                <div style={{ 
                  width: '42px', 
                  height: '42px', 
                  borderRadius: '10px', 
                  background: hrAutoApprove ? 'var(--color-primary-bg)' : 'var(--color-bg-elevated)',
                  color: hrAutoApprove ? 'var(--color-primary)' : 'var(--color-text-muted)',
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
                    Skip the manual Department Admin review. New requests submitted by Team Leads will go straight to the HR queue.
                  </p>
                </div>
              </div>
              <div style={{ marginTop: '10px' }}>
                <Toggle checked={hrAutoApprove} onChange={checked => handleHrToggle(checked)} disabled={!selectedDeptId} />
              </div>
            </div>
          </div>
        )}

        {/* TEAM LEAD: Personal JD Auto-Approve Rule */}
        {isHM && (
          <div className="settings-card" style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            borderLeft: (!allowAutoApproveJds) ? '4px solid var(--color-danger)' : (jdAutoApprove ? '4px solid var(--color-primary)' : '4px solid var(--color-border)'),
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
                background: (!allowAutoApproveJds) ? 'var(--color-danger-bg)' : (jdAutoApprove ? 'var(--color-primary-bg)' : 'var(--color-bg-elevated)'),
                color: (!allowAutoApproveJds) ? 'var(--color-danger)' : (jdAutoApprove ? 'var(--color-primary)' : 'var(--color-text-muted)'),
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'all var(--transition-base)',
                flexShrink: 0
              }}>
                <Icon name={!allowAutoApproveJds ? "lock" : "zap"} size={20} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Auto-Approve Final JDs
                </h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Skip the final sign-off. Once HR completes the Job Description with the AI, the position will open automatically.
                </p>
                {!allowAutoApproveJds && (
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--color-danger)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="alert-circle" size={14} /> Locked by organization policy
                  </p>
                )}
              </div>
            </div>
            <div style={{ marginTop: '10px' }}>
              <Toggle checked={allowAutoApproveJds ? jdAutoApprove : false} onChange={checked => handleJdToggle(checked)} disabled={!allowAutoApproveJds} />
            </div>
          </div>
        )}

        {!isDeptAdmin && !isHM && !isOrgHead && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Approval rules are configured by Department Admins (hire requests) and Hiring Managers (job descriptions).
            </p>
          </div>
        )}
      </div>

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  )
}
