/**
 * Shared logic for the hire-request UI: status badges, relay state computation,
 * and the small bits of formatting that appear in both list and detail views.
 */

import { timeAgo } from '../../utils/date'

// 4-step relay: filed → dept → hr → position
// (Finance step dropped — still Phase 2 placeholder, not wired to backend)
// dept step is now REAL: backed by dept_admin approval workflow.
export const RELAY_STAGES = [
  { key: 'filed', label: 'Filed', who: req => req.requested_by_name || 'Requester' },
  { key: 'dept', label: 'Dept approval', who: req => req.approved_by_name || 'Dept admin' },
  { key: 'hr', label: 'JD Generation', who: req => req.accepted_by_name || 'HR Recruiter' },
  { key: 'jd_approval', label: 'JD Approval', who: req => 'Team Lead' },
  { key: 'position', label: 'Position open', who: req => req.position_role_name ? 'Live' : 'Active' },
]

/**
 * Valid relay state values per step:
 *   'done'     – completed
 *   'current'  – active now
 *   'pending'  – not yet reached
 *   'rejected' – terminal failure (dept step only)
 *
 * Status → relay mapping:
 *   pending   → filed:done,  dept:current, hr:pending,  position:pending
 *   approved  → filed:done,  dept:done,    hr:current,  position:pending
 *   rejected  → filed:done,  dept:rejected, hr:pending, position:pending
 *   accepted  → filed:done,  dept:done,    hr:done,     position:current
 *   fulfilled → filed:done,  dept:done,    hr:done,     position:done
 *   cancelled → filed:done,  dept:pending, hr:pending,  position:pending
 */
export function computeRelayStates(req) {
  if (!req) return {}
  const s = req.status

  if (s === 'cancelled') {
    return { filed: 'done', dept: 'pending', hr: 'pending', jd_approval: 'pending', position: 'pending' }
  }

  if (s === 'draft') {
    return { filed: 'current', dept: 'pending', hr: 'pending', jd_approval: 'pending', position: 'pending' }
  }

  if (s === 'rejected') {
    return { filed: 'done', dept: 'rejected', hr: 'pending', jd_approval: 'pending', position: 'pending' }
  }

  if (s === 'pending') {
    return { filed: 'done', dept: 'current', hr: 'pending', jd_approval: 'pending', position: 'pending' }
  }

  if (s === 'approved') {
    return { filed: 'done', dept: 'done', hr: 'current', jd_approval: 'pending', position: 'pending' }
  }

  if (s === 'accepted') {
    return {
      filed: 'done', dept: 'done', hr: 'current', jd_approval: 'pending', position: 'pending'
    }
  }

  if (s === 'fulfilled') {
    // Fulfilled means JD generated. Now check position approval status
    const ap = req.position_approval_status
    if (ap === 'pending' || ap === 'changes_requested') {
      return { filed: 'done', dept: 'done', hr: 'done', jd_approval: 'current', position: 'pending' }
    }
    return { filed: 'done', dept: 'done', hr: 'done', jd_approval: 'done', position: 'done' }
  }

  // Unknown status — show everything pending
  return { filed: 'done', dept: 'pending', hr: 'pending', jd_approval: 'pending', position: 'pending' }
}

export function statusLabel(req) {
  if (!req) return ''
  switch (req.status) {
    case 'pending': return 'Awaiting dept approval'
    case 'approved': return 'Approved — awaiting HR pickup'
    case 'rejected': return 'Not approved'
    case 'accepted': return req.position_id ? 'JD in progress' : 'HR working on JD'
    case 'fulfilled': {
      const ap = req.position_approval_status
      if (ap === 'pending') return 'JD ready — awaiting your approval'
      if (ap === 'changes_requested') return 'JD changes requested'
      return 'Active position'
    }
    case 'cancelled': return 'Cancelled'
    default: return req.status
  }
}

export function statusTone(req) {
  if (!req) return 'neutral'
  if (req.status === 'cancelled') return 'neutral'
  if (req.status === 'rejected') return 'danger'
  if (req.status === 'pending') return 'warning'
  if (req.status === 'approved') return 'info'
  if (req.status === 'fulfilled' && req.position_approval_status === 'pending') return 'warning'
  if (req.status === 'fulfilled' && req.position_approval_status === 'changes_requested') return 'danger'
  if (req.status === 'fulfilled') return 'success'
  if (req.status === 'accepted') return 'info'
  return 'neutral'
}

export { timeAgo }

export function formatCompBand(req) {
  if (req.comp_min == null && req.comp_max == null) return null
  if (req.comp_min != null && req.comp_max != null) return `₹${req.comp_min}–${req.comp_max} LPA`
  if (req.comp_min != null) return `₹${req.comp_min}+ LPA`
  return `up to ₹${req.comp_max} LPA`
}

export function formatExperience(req) {
  if (req.experience_min == null && req.experience_max == null) return null
  if (req.experience_min != null && req.experience_max != null) return `${req.experience_min}–${req.experience_max} yrs`
  if (req.experience_min != null) return `${req.experience_min}+ yrs`
  return `up to ${req.experience_max} yrs`
}

export const WORK_TYPE_LABEL = {
  onsite: 'Onsite',
  remote: 'Remote',
  hybrid: 'Hybrid',
}
