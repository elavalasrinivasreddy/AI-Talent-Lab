import React, { useEffect, useRef } from 'react'
import Icon from '../common/Icon'
import './OriginalRequestDrawer.css'

export default function OriginalRequestDrawer({ position, onClose }) {
  const drawerRef = useRef(null)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close when clicking outside
  const handleOverlayClick = (e) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target)) {
      onClose()
    }
  }

  const formatComp = (min, max) => {
    if (!min && !max) return 'Not specified'
    const fmt = v => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v?.toLocaleString()}`
    if (min && max) return `${fmt(min)} – ${fmt(max)}`
    return min ? `${fmt(min)}+` : `Up to ${fmt(max)}`
  }

  const formatExp = (min, max) => {
    if (min == null && max == null) return 'Not specified'
    if (min != null && max != null) return `${min}-${max} years`
    if (min != null) return `${min}+ years`
    return `Up to ${max} years`
  }

  return (
    <div className="ord-overlay" onClick={handleOverlayClick}>
      <div className="ord-drawer" ref={drawerRef}>
        <div className="ord-header">
          <h3>Hiring Request Details</h3>
          <button className="ord-close" onClick={onClose} aria-label="Close drawer">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="ord-content">
          <div className="ord-section">
            <h4>Role Snapshot</h4>
            <div className="ord-grid">
              <div className="ord-field">
                <span className="ord-label">Role Name</span>
                <span className="ord-value">{position.role_name}</span>
              </div>
              <div className="ord-field">
                <span className="ord-label">Department</span>
                <span className="ord-value">{position.department_name || 'N/A'}</span>
              </div>
              <div className="ord-field">
                <span className="ord-label">Headcount</span>
                <span className="ord-value">{position.headcount || 1}</span>
              </div>
              <div className="ord-field">
                <span className="ord-label">Priority</span>
                <span className="ord-value" style={{ textTransform: 'capitalize' }}>{position.priority || 'Normal'}</span>
              </div>
            </div>
          </div>

          <div className="ord-section">
            <h4>Logistics & Requirements</h4>
            <div className="ord-grid">
              <div className="ord-field">
                <span className="ord-label">Location</span>
                <span className="ord-value">{position.location || 'Not specified'}</span>
              </div>
              <div className="ord-field">
                <span className="ord-label">Work Type</span>
                <span className="ord-value" style={{ textTransform: 'capitalize' }}>{position.work_type || 'onsite'}</span>
              </div>
              <div className="ord-field">
                <span className="ord-label">Employment Type</span>
                <span className="ord-value" style={{ textTransform: 'capitalize' }}>{(position.employment_type || 'full_time').replace('_', ' ')}</span>
              </div>
              <div className="ord-field">
                <span className="ord-label">Deadline</span>
                <span className="ord-value">{position.target_start || position.deadline || 'No deadline'}</span>
              </div>
            </div>
          </div>

          <div className="ord-section">
            <h4>Candidate Profile</h4>
            <div className="ord-grid">
              <div className="ord-field">
                <span className="ord-label">Experience</span>
                <span className="ord-value">{formatExp(position.experience_min, position.experience_max)}</span>
              </div>
              <div className="ord-field">
                <span className="ord-label">Compensation Range</span>
                <span className="ord-value">{formatComp(position.salary_min || position.comp_min, position.salary_max || position.comp_max)}</span>
              </div>
            </div>
          </div>
          
          <div className="ord-section">
            <h4>Notes & Additional Info</h4>
            <p className="ord-notes-text">
              {position.requirements || position.jd_markdown ? 'Refer to the JD tab for full requirements.' : 'No additional notes provided in the request.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
