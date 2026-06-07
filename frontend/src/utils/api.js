/**
 * utils/api.js – Centralised API client.
 * Backward-compatible: exports default `api` object (Axios-like, returns { data })
 * AND exports named typed wrappers (positionsApi, candidatesApi, etc.)
 */

const BASE = '/api/v1'

// Token getter — wired by AuthContext on mount so the API always has the latest token.
// Falls back to sessionStorage so pre-mount requests (before the effect fires) still
// include the Bearer token from an existing session.
let _tokenGetter = () => {
  try {
    const raw = sessionStorage.getItem('atl_session')
    return raw ? (JSON.parse(raw)?.token ?? null) : null
  } catch { return null }
}

export function setTokenGetter(getter) {
  _tokenGetter = getter
}

async function _fetch(method, path, body, signal) {
  const token = _tokenGetter()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })

  if (!res.ok) {
    let errData
    try { errData = await res.json() } catch { errData = null }
    const msg = errData?.error?.message || errData?.detail || `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.code = errData?.error?.code
    throw err
  }

  if (res.status === 204) return null
  return res.json()
}

/**
 * Default export — backward-compatible with existing code.
 * Returns { data: <response> } to match Axios-style usage.
 */
const api = {
  get: async (path, signal) => {
    const data = await _fetch('GET', path, null, signal)
    return { data }
  },
  post: async (path, body, signal) => {
    const data = await _fetch('POST', path, body, signal)
    return { data }
  },
  patch: async (path, body, signal) => {
    const data = await _fetch('PATCH', path, body, signal)
    return { data }
  },
  put: async (path, body, signal) => {
    const data = await _fetch('PUT', path, body, signal)
    return { data }
  },
  delete: async (path, signal) => {
    const data = await _fetch('DELETE', path, null, signal)
    return { data }
  },
}

export default api

// ── Typed, unwrapped helpers for new components ─────────────────────────────
// These return the response directly (not wrapped in { data }).

const _get = (path, signal) => _fetch('GET', path, null, signal)
const _post = (path, body, signal) => _fetch('POST', path, body, signal)
const _patch = (path, body, signal) => _fetch('PATCH', path, body, signal)
const _delete = (path, signal) => _fetch('DELETE', path, null, signal)

// ── Positions ──────────────────────────────────────────────────────────────────

export const positionsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams()
    if (params.departmentId) q.set('department_id', params.departmentId)
    if (params.status) q.set('status', params.status)
    if (params.page) q.set('page', params.page)
    const qs = q.toString()
    return _get(`/positions/${qs ? `?${qs}` : ''}`)
  },
  get: (id) => _get(`/positions/${id}`),
  update: (id, data) => _patch(`/positions/${id}`, data),
  updateStatus: (id, status) => _patch(`/positions/${id}/status`, { status }),
  searchNow: (id) => _post(`/positions/${id}/search-now`),
  getInterviewKit: (id) => _get(`/positions/${id}/interview-kit`),
  generateInterviewKit: (id) => _post(`/positions/${id}/interview-kit/generate`),
  submitForApproval: (id) => _post(`/positions/${id}/submit-for-approval`),
  approvalDecision: (id, decision, notes = '') => _post(`/positions/${id}/approval-decision`, { decision, notes }),
  applicantsDaily: (id, days = 30) => _get(`/positions/${id}/applicants-daily?days=${days}`),
  stageCounts: (id) => _get(`/positions/${id}/stage-counts`),
  pipelineSummary: (id) => _get(`/positions/${id}/pipeline-summary`),
  pendingCount: () => _get('/positions/pending-count'),
}

// ── Candidates ────────────────────────────────────────────────────────────────

export const candidatesApi = {
  listForPosition: (positionId, params = {}) => {
    const q = new URLSearchParams()
    if (params.status) q.set('status', params.status)
    if (params.page) q.set('page', params.page)
    const qs = q.toString()
    return _get(`/candidates/position/${positionId}${qs ? `?${qs}` : ''}`)
  },
  get: (id, positionId) => {
    const qs = positionId ? `?position_id=${positionId}` : ''
    return _get(`/candidates/${id}${qs}`)
  },
  getTimeline: (id, positionId) => {
    const qs = positionId ? `?position_id=${positionId}` : ''
    return _get(`/candidates/${id}/timeline${qs}`)
  },
  updateStatus: (candidateId, data) => _patch(`/candidates/${candidateId}/status`, data),
  markSelected: (candidateId, data) => _post(`/candidates/${candidateId}/mark-selected`, data),
  getTags: (id) => _get(`/candidates/${id}/tags`),
  addTag: (id, tag) => _post(`/candidates/${id}/tags`, { tag }),
  removeTag: (id, tag) => _delete(`/candidates/${id}/tags/${tag}`),
  sendOutreach: (applicationIds) => _post('/candidates/send-outreach', { application_ids: applicationIds }),
  retryAts: (id, application_id, position_id) => _post(`/candidates/${id}/retry-ats`, { application_id, position_id }),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getBriefing: (period = 'week', deptId = null) => _get(`/dashboard/briefing?period=${period}${deptId && deptId !== 'all' ? `&dept_id=${deptId}` : ''}`),
  getStats: (period = 'week', deptId = null) => _get(`/dashboard/stats?period=${period}${deptId && deptId !== 'all' ? `&dept_id=${deptId}` : ''}`),
  getPositions: (deptId = null) => _get(`/dashboard/positions${deptId && deptId !== 'all' ? `?dept_id=${deptId}` : ''}`),
  getPipeline: (positionId) => _get(`/dashboard/pipeline/${positionId}`),
  getFunnel: () => _get('/dashboard/funnel'),
  getActivity: (positionId, limit = 30) => {
    const q = new URLSearchParams()
    if (positionId) q.set('position_id', positionId)
    q.set('limit', limit)
    return _get(`/dashboard/activity?${q}`)
  },
  getAnalytics: (period = 'month') => _get(`/dashboard/analytics?period=${period}`),
  getAgentRoi: (period = 'quarter') => _get(`/dashboard/agent-roi?period=${period}`),
  getRecruiterPerformance: (period = 'quarter') => _get(`/dashboard/recruiter-performance?period=${period}`),
  getBottlenecks: (period = 'quarter') => _get(`/dashboard/bottlenecks?period=${period}`),
  getCeleryStats: (period = 'quarter') => _get(`/dashboard/ops/celery?period=${period}`),
  getLLMStats: (period = 'quarter') => _get(`/dashboard/ops/llm?period=${period}`),
  getJDStats: (period = 'quarter') => _get(`/dashboard/ops/jd?period=${period}`),
}

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: () => _get('/notifications/'),
  markRead: (id) => _patch(`/notifications/${id}/read`),
  markAllRead: () => _patch('/notifications/read-all'),
}

// ── Interviews ────────────────────────────────────────────────────────────────

export const interviewsApi = {
  list: (params = {}) => _get(`/interviews/?${new URLSearchParams(params)}`),
  create: (data) => _post('/interviews/', data),
  listForCandidate: (candidateId) => _get(`/interviews/candidate/${candidateId}`),
  listForPosition: (positionId) => _get(`/interviews/position/${positionId}`),
  get: (id) => _get(`/interviews/${id}`),
  update: (id, data) => _patch(`/interviews/${id}`, data),
  sendInvites: (id) => _post(`/interviews/${id}/send-invites`),
  generateDebrief: (id) => _post(`/interviews/${id}/generate-debrief`),
  getCalendarAvailability: (data) => _post('/interviews/calendar/availability', data),
  scheduleWithCalendar: (data) => _post('/interviews/calendar/schedule', data),
}

// ── Talent Pool ───────────────────────────────────────────────────────────────

// ── AI Copilot ───────────────────────────────────────────────────────────────

export const copilotApi = {
  getSuggestions: () => _get('/copilot/suggestions'),
  dismiss: (id) => _patch(`/copilot/suggestions/${id}/dismiss`),
  dismissAll: () => _patch('/copilot/suggestions/dismiss-all'),
  executeAction: (id) => _post(`/copilot/suggestions/${id}/execute`),
}

// ── Talent Pool ───────────────────────────────────────────────────────────────

export const talentPoolApi = {
  list: (params = {}) => _get(`/talent-pool/?${new URLSearchParams(params)}`),
  suggest: (positionId) => _post(`/talent-pool/suggest/${positionId}`),
  addToPipeline: (candidateId, positionId) => _post(`/talent-pool/${candidateId}/add-to-position`, { position_id: positionId }),
  add: (candidateId) => _post(`/talent-pool/${candidateId}/add`),
  remove: (candidateId) => _delete(`/talent-pool/${candidateId}/remove`),
}

// ── Hiring Notes ─────────────────────────────────────────────────────────────

export const notesApi = {
  list: (candidateId) => _get(`/notes/candidate/${candidateId}`),
  create: (candidateId, data) => _post(`/notes/candidate/${candidateId}`, data),
  update: (noteId, content) => _patch(`/notes/${noteId}`, { content }),
  delete: (noteId) => _delete(`/notes/${noteId}`),
}

// ── Hire Requests ────────────────────────────────────────────────────────────

export const hireRequestsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams()
    if (params.scope) q.set('scope', params.scope)
    if (params.status) q.set('status', params.status)
    if (params.departmentId) q.set('department_id', params.departmentId)
    const qs = q.toString()
    return _get(`/hire-requests/${qs ? `?${qs}` : ''}`)
  },
  get: (id) => _get(`/hire-requests/${id}`),
  create: (data) => _post('/hire-requests/', data),
  update: (id, data) => _patch(`/hire-requests/${id}`, data),
  approve: (id, note) => _post(`/hire-requests/${id}/approve`, note ? { note } : {}),
  reject: (id, reason) => _post(`/hire-requests/${id}/reject`, { reason }),
  accept: (id, chatSessionId) => _post(`/hire-requests/${id}/accept`, chatSessionId ? { chat_session_id: chatSessionId } : {}),
  cancel: (id) => _post(`/hire-requests/${id}/cancel`),
  pendingCount: () => _get('/hire-requests/pending-count'),
  linkSession: (id, sessionId) => _post(`/hire-requests/${id}/link-session`, { session_id: sessionId }),
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  forgotPassword: (email) => _post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => _post('/auth/reset-password', { token, new_password }),
}

// ── Settings — AI Behavior ────────────────────────────────────────────────────

export const settingsApi = {
  getAiBehavior: () => _get('/settings/ai-behavior'),
  updateAiBehavior: (settings) => _patch('/settings/ai-behavior', settings),
  getDepartments: () => _get('/settings/departments'),
}

// ── GDPR / Privacy ────────────────────────────────────────────────────────────

export const gdprApi = {
  getDeletionRequests: () => _get('/gdpr/deletion-requests'),
  processDeletion: (id) => _post(`/gdpr/process-deletion/${id}`),
  exportCandidateData: (candidateId) => _get(`/gdpr/export/${candidateId}`),
  getConsentRecords: (candidateId) => _get(`/gdpr/consent/${candidateId}`),
  recordConsent: (data) => _post('/gdpr/consent', data),
}
