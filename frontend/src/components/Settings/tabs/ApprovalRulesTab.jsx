import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext'

export default function ApprovalRulesTab() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'org_head' || user?.role === 'dept_admin'
  const isHM = user?.role === 'team_lead'

  const [hrAutoApprove, setHrAutoApprove] = useState(false)
  const [jdAutoApprove, setJdAutoApprove] = useState(false)

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <h3>✅ Approval Rules</h3>
        <p className="section-desc">
          Configure how hire requests and job descriptions (JDs) are approved. Enabling auto-approval speeds up the pipeline but bypasses manual review.
        </p>
      </div>

      {isAdmin && (
        <div className="settings-form-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px' }}>Auto-Approve Hire Requests</h4>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                When a hiring manager submits a new hire request, automatically approve it and send to HR. Default is off (manual review required).
              </p>
            </div>
            <label className="st-toggle">
              <input type="checkbox" checked={hrAutoApprove} onChange={e => setHrAutoApprove(e.target.checked)} />
              <span className="st-slider"></span>
            </label>
          </div>
        </div>
      )}

      {(isHM || isAdmin) && (
        <div className="settings-form-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px' }}>Auto-Approve Final JDs</h4>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                When HR finalizes the JD generation, automatically approve it without a final review stage. Position will immediately open.
              </p>
            </div>
            <label className="st-toggle">
              <input type="checkbox" checked={jdAutoApprove} onChange={e => setJdAutoApprove(e.target.checked)} />
              <span className="st-slider"></span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
