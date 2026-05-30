import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import Icon from '../../common/Icon'

export default function ApprovalRulesTab() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'org_head' || user?.role === 'dept_admin'
  const isHM = user?.role === 'team_lead'

  const [hrAutoApprove, setHrAutoApprove] = useState(false)
  const [jdAutoApprove, setJdAutoApprove] = useState(false)

  return (
    <div className="settings-form">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {isAdmin && (
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
              <input type="checkbox" checked={hrAutoApprove} onChange={e => setHrAutoApprove(e.target.checked)} />
              <span className="st-slider"></span>
            </label>
          </div>
        )}

        {(isHM || isAdmin) && (
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
              <input type="checkbox" checked={jdAutoApprove} onChange={e => setJdAutoApprove(e.target.checked)} />
              <span className="st-slider"></span>
            </label>
          </div>
        )}

      </div>
    </div>
  )
}
