/**
 * Shared logic for the hire-request UI: status badges, relay state computation,
 * and the small bits of formatting that appear in both list and detail views.
 */

// Stages of the relay visualization. Today the backend has only 3 active
// states (pending → accepted → fulfilled), so the dept-head / finance steps
// render as "(Phase 2)" placeholders. Keep this array in sync with the
// 5-step viz in docs/redesign/09_hire_request.md §4.
export const RELAY_STAGES = [
  { key: 'filed',     label: 'Filed',          who: req => req.requested_by_name || 'Requester' },
  { key: 'dept',      label: 'Dept review',    who: () => 'Phase 2', phase2: true },
  { key: 'finance',   label: 'Finance review', who: () => 'Phase 2', phase2: true },
  { key: 'recruiter', label: 'Recruiter',      who: req => req.accepted_by_name || 'Awaiting pickup' },
  { key: 'position',  label: 'Position open',  who: req => req.position_role_name ? 'Live' : 'After JD save' },
]

/**
 * Given a hire-request row, return {key: 'done' | 'current' | 'pending'} per stage.
 * Cancelled requests show every step as `pending` except the first.
 */
export function computeRelayStates(req) {
  if (!req) return {}
  const s = req.status

  if (s === 'cancelled') {
    return {
      filed: 'done', dept: 'pending', finance: 'pending',
      recruiter: 'pending', position: 'pending',
    }
  }
  const states = {
    filed: 'done',
    dept: 'done',      // skipped — Phase 2 placeholder
    finance: 'done',   // skipped — Phase 2 placeholder
    recruiter: 'pending',
    position: 'pending',
  }
  if (s === 'pending') {
    states.recruiter = 'current'
  } else if (s === 'accepted') {
    states.recruiter = 'done'
    states.position = req.position_id ? 'done' : 'current'
  } else if (s === 'fulfilled') {
    states.recruiter = 'done'
    states.position = 'done'
  }
  return states
}

export function statusLabel(req) {
  if (!req) return ''
  switch (req.status) {
    case 'pending':   return 'Awaiting recruiter pickup'
    case 'accepted':  return req.position_id ? 'JD in progress' : 'Recruiter working on JD'
    case 'fulfilled': {
      const ap = req.position_approval_status
      if (ap === 'pending')           return 'JD ready — awaiting your approval'
      if (ap === 'changes_requested') return 'JD changes requested'
      return 'Active position'
    }
    case 'cancelled': return 'Cancelled'
    default:          return req.status
  }
}

export function statusTone(req) {
  if (!req) return 'neutral'
  if (req.status === 'cancelled')                                    return 'neutral'
  if (req.status === 'pending')                                      return 'warning'
  if (req.status === 'fulfilled' && req.position_approval_status === 'pending') return 'warning'
  if (req.status === 'fulfilled' && req.position_approval_status === 'changes_requested') return 'danger'
  if (req.status === 'fulfilled')                                    return 'success'
  if (req.status === 'accepted')                                     return 'info'
  return 'neutral'
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

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
