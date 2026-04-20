/**
 * PIPELINE_STAGES — single source of truth for pipeline stages + colors.
 * StatusBadge is the ONLY component that uses these colors.
 * See docs/FRONTEND_PLAN.md §2.
 */
export const PIPELINE_STAGES = {
  sourced:     { label: 'Sourced',     color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' },
  outreached:  { label: 'Outreached',  color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' },
  applied:     { label: 'Applied',     color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)' },
  screening:   { label: 'Screening',   color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  interviewing:{ label: 'Interviewing', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' },
  offered:     { label: 'Offered',     color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)' },
  hired:       { label: 'Hired',       color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  rejected:    { label: 'Rejected',    color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
}

export const API_BASE = '/api/v1'

export const ROLES = {
  admin: 'Admin',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring Manager',
}

export const ORG_SIZES = {
  startup: 'Startup (1–50)',
  smb: 'SMB (51–500)',
  enterprise: 'Enterprise (500+)',
}
