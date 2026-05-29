/**
 * useDashboardData(role, period)
 * Owns all fetching for the v3 Dashboard.
 * Returns { lanes: { now, next, pulse }, suggestions, positions, health, loading, error, refetch }
 *
 * Per-lane loading/error — one failing call does NOT kill the whole page.
 *
 * Lane mapping (from architectural decision — client-side from existing endpoints):
 *   NOW  ← copilot suggestions: overdue_feedback | stale_position | uncontacted_high_score | pending_rejection
 *   NEXT ← copilot suggestions: interview_today  (+ any deadline-style types)
 *   PULSE← /dashboard/activity  (pipeline_events — AI/overnight actions)
 *
 * Admin health strip ← /dashboard/stats (admin roles only)
 * Position pulse     ← /dashboard/positions
 * Copilot bar pills  ← all suggestions (separate from lane rows — CopilotBar shows them as pills)
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { dashboardApi, copilotApi } from '../../utils/api'

// Types that belong in each lane — pure mapping, no backend change
const NOW_TYPES  = new Set(['overdue_feedback', 'stale_position', 'uncontacted_high_score', 'pending_rejection'])
const NEXT_TYPES = new Set(['interview_today', 'pool_match'])

// AI/overnight pipeline event types for the PULSE lane
const PULSE_TYPES = new Set([
  'candidate_sourced',
  'jd_generation_paused',
  'outreach_email_sent',
  'ats_score_updated',
  'rejection_email_drafted',
  'pool_match_found',
])

// Admin roles — matches backend/models/auth.py
const ADMIN_ROLES = new Set(['org_head', 'dept_admin', 'platform_admin'])

// Map suggestion type → icon name (Icon.jsx PATHS keys) + kind (bad|warn|ok)
export const SUGGESTION_META = {
  overdue_feedback:       { icon: 'clock',          kind: 'bad',  color: 'var(--color-danger, #EF4444)' },
  stale_position:         { icon: 'alert-triangle',  kind: 'bad',  color: 'var(--color-danger, #EF4444)' },
  uncontacted_high_score: { icon: 'zap',             kind: 'warn', color: 'var(--color-warning, #D97706)' },
  pending_rejection:      { icon: 'mail',            kind: 'warn', color: 'var(--color-warning, #D97706)' },
  interview_today:        { icon: 'calendar',        kind: 'ok',   color: 'var(--color-info, #3B82F6)' },
  pool_match:             { icon: 'users',           kind: 'ok',   color: 'var(--color-success, #10B981)' },
  default:                { icon: 'cpu',             kind: 'ok',   color: 'var(--color-primary, #0D9488)' },
}

// Map activity event_type → PULSE lane display
export const PULSE_EVENT_META = {
  candidate_sourced:       { icon: 'users',          kind: 'ok',  color: 'var(--color-success, #10B981)' },
  jd_generation_paused:    { icon: 'alert-triangle', kind: 'warn',color: 'var(--color-warning, #D97706)' },
  outreach_email_sent:     { icon: 'mail',           kind: 'ok',  color: 'var(--color-info, #3B82F6)' },
  ats_score_updated:       { icon: 'bar-chart',      kind: 'ok',  color: 'var(--color-primary, #0D9488)' },
  rejection_email_drafted: { icon: 'file-text',      kind: 'warn',color: 'var(--color-warning, #D97706)' },
  pool_match_found:        { icon: 'zap',            kind: 'ok',  color: 'var(--color-success, #10B981)' },
  // Fallback for other event types shown in PULSE
  candidate_sourced_ai:    { icon: 'cpu',            kind: 'ok',  color: 'var(--color-primary, #0D9488)' },
  default:                 { icon: 'cpu',            kind: 'ok',  color: 'var(--color-primary, #0D9488)' },
}

function normalizeSuggestions(raw) {
  const arr = Array.isArray(raw) ? raw : (raw?.suggestions || [])
  return arr.map(s => ({
    id: s.id,
    type: s.type,
    title: s.title,
    action_url: s.action_url || null,
    action_label: s.action_label || 'View →',
    entity_id: s.entity_id || null,
    entity_type: s.entity_type || null,
    created_at: s.created_at || null,
    meta: SUGGESTION_META[s.type] || SUGGESTION_META.default,
  }))
}

function normalizeActivity(raw) {
  const arr = Array.isArray(raw) ? raw : (raw?.events || [])
  return arr.map(e => {
    const meta = PULSE_EVENT_META[e.event_type] || PULSE_EVENT_META.default
    // Build a human-readable title from event fields
    const title = buildActivityTitle(e)
    return {
      id: e.id,
      type: e.event_type,
      title,
      meta_text: e.candidate_name ? `for ${e.position_title || 'position'}` : (e.position_title || ''),
      created_at: e.created_at || null,
      action_url: e.position_id ? `/positions/${e.position_id}` : null,
      action_label: 'View',
      meta,
    }
  })
}

function buildActivityTitle(evt) {
  const t = evt.event_type
  const c = evt.candidate_name || 'Candidate'
  const p = evt.position_title || 'position'
  if (t === 'candidate_sourced')       return `AI sourced ${c} for ${p}`
  if (t === 'candidate_sourced_ai')    return `AI sourced ${c} for ${p}`
  if (t === 'jd_generation_paused')    return `JD generation paused for ${p}`
  if (t === 'outreach_email_sent')     return `Outreach email sent to ${c}`
  if (t === 'ats_score_updated')       return `ATS score updated for ${c}`
  if (t === 'rejection_email_drafted') return `Rejection email drafted for ${c}`
  if (t === 'pool_match_found')        return `Pool match found for ${p}`
  // For other events fall through to generic
  return t.replace(/_/g, ' ')
}

// Derive per-lane rows from suggestions
function splitSuggestionsToLanes(suggestions) {
  const now  = suggestions.filter(s => NOW_TYPES.has(s.type))
  const next = suggestions.filter(s => NEXT_TYPES.has(s.type))
  return { now, next }
}

// Derive PULSE rows from activity — prefer AI event types, fall back to all
function buildPulseLane(activity) {
  const ai = activity.filter(e => PULSE_TYPES.has(e.type))
  // If no AI events, show last 12 events anyway so the lane isn't empty on day 1
  return ai.length > 0 ? ai.slice(0, 12) : activity.slice(0, 12)
}

export default function useDashboardData(role, period) {
  const [suggestions, setSuggestions] = useState([])
  const [activity, setActivity]       = useState([])
  const [positions, setPositions]     = useState([])
  const [health, setHealth]           = useState(null)

  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const [loadingActivity, setLoadingActivity]       = useState(true)
  const [loadingPositions, setLoadingPositions]     = useState(true)
  const [loadingHealth, setLoadingHealth]           = useState(true)

  const [errorSuggestions, setErrorSuggestions] = useState(null)
  const [errorActivity, setErrorActivity]       = useState(null)
  const [errorPositions, setErrorPositions]     = useState(null)
  const [errorHealth, setErrorHealth]           = useState(null)

  const intervalRefs = useRef({})

  const fetchSuggestions = useCallback(async () => {
    setErrorSuggestions(null)
    try {
      const raw = await copilotApi.getSuggestions()
      setSuggestions(normalizeSuggestions(raw))
    } catch (e) {
      setErrorSuggestions(e.message || 'Failed to load suggestions')
    } finally {
      setLoadingSuggestions(false)
    }
  }, [])

  const fetchActivity = useCallback(async () => {
    setErrorActivity(null)
    try {
      const raw = await dashboardApi.getActivity(null, 15)
      setActivity(normalizeActivity(raw))
    } catch (e) {
      setErrorActivity(e.message || 'Failed to load activity')
    } finally {
      setLoadingActivity(false)
    }
  }, [])

  const fetchPositions = useCallback(async () => {
    setErrorPositions(null)
    try {
      const raw = await dashboardApi.getPositions()
      setPositions(Array.isArray(raw) ? raw : (raw?.positions || []))
    } catch (e) {
      setErrorPositions(e.message || 'Failed to load positions')
    } finally {
      setLoadingPositions(false)
    }
  }, [])

  const fetchHealth = useCallback(async () => {
    if (!ADMIN_ROLES.has(role)) {
      setLoadingHealth(false)
      return
    }
    setErrorHealth(null)
    try {
      const raw = await dashboardApi.getStats(period || 'week')
      setHealth(raw)
    } catch (e) {
      setErrorHealth(e.message || 'Failed to load health stats')
    } finally {
      setLoadingHealth(false)
    }
  }, [role, period])

  // Initial fetches
  useEffect(() => { fetchSuggestions() }, [fetchSuggestions])
  useEffect(() => { fetchActivity()    }, [fetchActivity])
  useEffect(() => { fetchPositions()   }, [fetchPositions])
  useEffect(() => { fetchHealth()      }, [fetchHealth])

  // Polling: suggestions every 60s, activity/lanes every 30s
  useEffect(() => {
    intervalRefs.current.suggestions = setInterval(fetchSuggestions, 60_000)
    intervalRefs.current.activity    = setInterval(fetchActivity,    30_000)
    intervalRefs.current.positions   = setInterval(fetchPositions,   30_000)
    return () => {
      clearInterval(intervalRefs.current.suggestions)
      clearInterval(intervalRefs.current.activity)
      clearInterval(intervalRefs.current.positions)
    }
  }, [fetchSuggestions, fetchActivity, fetchPositions])

  // Derived lane data
  const { now, next } = splitSuggestionsToLanes(suggestions)
  const pulse          = buildPulseLane(activity)

  const isAdmin = ADMIN_ROLES.has(role)

  return {
    lanes: {
      now:   { rows: now,   loading: loadingSuggestions, error: errorSuggestions,  retry: fetchSuggestions },
      next:  { rows: next,  loading: loadingSuggestions, error: errorSuggestions,  retry: fetchSuggestions },
      pulse: { rows: pulse, loading: loadingActivity,    error: errorActivity,     retry: fetchActivity    },
    },
    suggestions,
    positions,
    health: isAdmin ? health : null,
    loading: {
      suggestions: loadingSuggestions,
      activity:    loadingActivity,
      positions:   loadingPositions,
      health:      isAdmin ? loadingHealth : false,
    },
    error: {
      suggestions: errorSuggestions,
      activity:    errorActivity,
      positions:   errorPositions,
      health:      isAdmin ? errorHealth : null,
    },
    // Dismiss helpers (keep suggestions in sync)
    dismiss: async (id) => {
      setSuggestions(prev => prev.filter(s => s.id !== id))
      try { await copilotApi.dismiss(id) } catch { /* non-critical */ }
    },
    dismissAll: async () => {
      setSuggestions([])
      try { await copilotApi.dismissAll() } catch { /* non-critical */ }
    },
    refetch: {
      suggestions: fetchSuggestions,
      activity:    fetchActivity,
      positions:   fetchPositions,
      health:      fetchHealth,
    },
  }
}
