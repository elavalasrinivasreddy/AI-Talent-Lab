/**
 * utils/constants.js – Shared constants for pipeline stages, status colors, etc.
 * PIPELINE_STAGES is the single source of truth for stage colors per spec.
 *
 * Colors use CSS custom property tokens with hex fallbacks so the component
 * degrades gracefully if the design-system tokens aren't loaded.
 */

export const PIPELINE_STAGES = {
  sourced:   { label: 'Sourced',    color: 'var(--color-info, #3B82F6)',    bg: 'rgba(59,130,246,0.12)' },
  emailed:   { label: 'Emailed',    color: 'var(--color-purple, #8B5CF6)',  bg: 'rgba(139,92,246,0.12)' },
  applied:   { label: 'Applied',    color: 'var(--color-info, #3B82F6)',    bg: 'rgba(59,130,246,0.12)' },
  screening: { label: 'Screening',  color: 'var(--color-teal, #0D9488)',    bg: 'rgba(13,148,136,0.12)' },
  interview: { label: 'Interview',  color: 'var(--color-purple, #6366F1)',  bg: 'rgba(99,102,241,0.12)' },
  selected:  { label: 'Selected',   color: 'var(--color-success, #10B981)', bg: 'rgba(16,185,129,0.12)' },
  rejected:  { label: 'Rejected',   color: 'var(--color-text-muted, #64748B)', bg: 'rgba(100,116,139,0.12)' },
  on_hold:   { label: 'On Hold',    color: 'var(--color-warning, #F59E0B)', bg: 'rgba(245,158,11,0.12)' },
}

export const POSITION_STATUSES = {
  draft:    { label: 'Draft',    color: 'var(--color-text-muted, #64748B)' },
  open:     { label: 'Open',     color: 'var(--color-success, #10B981)' },
  on_hold:  { label: 'On Hold',  color: 'var(--color-warning, #F59E0B)' },
  closed:   { label: 'Closed',   color: 'var(--color-danger, #EF4444)' },
  archived: { label: 'Archived', color: 'var(--color-text-muted, #64748B)' },
}

export const PRIORITY_LABELS = {
  urgent: { label: 'Urgent', color: 'var(--color-danger, #EF4444)' },
  high:   { label: 'High',   color: 'var(--color-warning, #F59E0B)' },
  normal: { label: 'Normal', color: 'var(--color-warning, #F59E0B)' },
  low:    { label: 'Low',    color: 'var(--color-success, #10B981)' },
}

/** ATS score → label + color */
export function getScoreStyle(score) {
  if (score >= 80) return { label: 'Strong Match',  color: 'var(--color-success, #10B981)' }
  if (score >= 60) return { label: 'Good Match',    color: 'var(--color-warning, #F59E0B)' }
  if (score >= 40) return { label: 'Partial Match', color: 'var(--color-warning, #F59E0B)' }
  return             { label: 'Weak Match',    color: 'var(--color-danger, #EF4444)' }
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
