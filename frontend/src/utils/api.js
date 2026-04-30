/**
 * utils/api.js – Centralised API client.
 * Backward-compatible: exports default `api` object (Axios-like, returns { data })
 * AND exports named typed wrappers (positionsApi, candidatesApi, etc.)
 */

const BASE = '/api/v1'

// Token getter — set by AuthContext so the API always has the latest token
let _tokenGetter = () => localStorage.getItem('token')

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
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: (period = 'week') => _get(`/dashboard/stats?period=${period}`),
  getPositions: () => _get('/dashboard/positions'),
  getPipeline: (positionId) => _get(`/dashboard/pipeline/${positionId}`),
  getFunnel: () => _get('/dashboard/funnel'),
  getActivity: (positionId, limit = 30) => {
    const q = new URLSearchParams()
    if (positionId) q.set('position_id', positionId)
    q.set('limit', limit)
    return _get(`/dashboard/activity?${q}`)
  },
}

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: () => _get('/notifications/'),
  markRead: (id) => _patch(`/notifications/${id}/read`),
  markAllRead: () => _patch('/notifications/read-all'),
}
