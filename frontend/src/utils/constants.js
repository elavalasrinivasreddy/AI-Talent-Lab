/**
 * utils/constants.js – Shared constants for pipeline stages, status colors, etc.
 * PIPELINE_STAGES is the single source of truth for stage colors per spec.
 */

export const PIPELINE_STAGES = {
  sourced:   { label: 'Sourced',    color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
  emailed:   { label: 'Emailed',    color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  applied:   { label: 'Applied',    color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  screening: { label: 'Screening',  color: '#0D9488', bg: 'rgba(13,148,136,0.12)' },
  interview: { label: 'Interview',  color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  selected:  { label: 'Selected',   color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  rejected:  { label: 'Rejected',   color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
  on_hold:   { label: 'On Hold',    color: '#D97706', bg: 'rgba(217,119,6,0.12)' },
}

export const POSITION_STATUSES = {
  draft:    { label: 'Draft',    color: '#64748B' },
  open:     { label: 'Open',    color: '#10B981' },
  on_hold:  { label: 'On Hold', color: '#D97706' },
  closed:   { label: 'Closed',  color: '#EF4444' },
  archived: { label: 'Archived', color: '#475569' },
}

export const PRIORITY_LABELS = {
  urgent: { label: 'Urgent',  color: '#EF4444' },
  high:   { label: 'High',    color: '#F97316' },
  normal: { label: 'Normal',  color: '#D97706' },
  low:    { label: 'Low',     color: '#10B981' },
}

/** ATS score → label + color */
export function getScoreStyle(score) {
  if (score >= 80) return { label: 'Strong Match',   color: '#10B981' }
  if (score >= 60) return { label: 'Good Match',     color: '#D97706' }
  if (score >= 40) return { label: 'Partial Match',  color: '#F97316' }
  return            { label: 'Weak Match',   color: '#EF4444' }
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
