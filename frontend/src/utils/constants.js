/**
 * utils/constants.js – Shared constants for pipeline stages, status colors, etc.
 * PIPELINE_STAGES is the single source of truth for stage colors per spec.
 */

export const PIPELINE_STAGES = {
  sourced:   { label: 'Sourced',    color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  emailed:   { label: 'Emailed',    color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  applied:   { label: 'Applied',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  screening: { label: 'Screening',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  interview: { label: 'Interview',  color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  selected:  { label: 'Selected',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  rejected:  { label: 'Rejected',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  on_hold:   { label: 'On Hold',    color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
}

export const POSITION_STATUSES = {
  draft:    { label: 'Draft',    color: '#9ca3af' },
  open:     { label: 'Open',    color: '#22c55e' },
  on_hold:  { label: 'On Hold', color: '#f59e0b' },
  closed:   { label: 'Closed',  color: '#ef4444' },
  archived: { label: 'Archived', color: '#6b7280' },
}

export const PRIORITY_LABELS = {
  urgent: { label: '🔴 Urgent',  color: '#ef4444' },
  high:   { label: '🟠 High',    color: '#f97316' },
  normal: { label: '🟡 Normal',  color: '#f59e0b' },
  low:    { label: '🟢 Low',     color: '#22c55e' },
}

/** ATS score → label + color */
export function getScoreStyle(score) {
  if (score >= 80) return { label: 'Strong Match',   color: '#22c55e' }
  if (score >= 60) return { label: 'Good Match',     color: '#f59e0b' }
  if (score >= 40) return { label: 'Partial Match',  color: '#fb923c' }
  return            { label: 'Weak Match',   color: '#ef4444' }
}

export const KANBAN_STAGE_ORDER = [
  'sourced', 'emailed', 'applied', 'screening', 'interview', 'selected', 'rejected', 'on_hold'
]

export const PIPELINE_EVENT_ICONS = {
  sourced:               '🔍',
  ats_scored:            '📊',
  emailed:               '📧',
  followup_sent:         '📧',
  link_clicked:          '👁',
  applied:               '📝',
  status_changed:        '🔄',
  interview_scheduled:   '📅',
  interview_completed:   '📅',
  feedback_submitted:    '📋',
  rejection_drafted:     '📤',
  rejection_sent:        '📤',
  selected:              '⭐',
  added_to_pool:         '🏊',
  comment_added:         '💬',
  jd_generated:          '📄',
  search_completed:      '🤖',
  interview_kit_generated: '🎯',
}
