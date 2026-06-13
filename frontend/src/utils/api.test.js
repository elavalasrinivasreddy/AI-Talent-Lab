import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api, { setTokenGetter } from './api'

// Mirror the module's base-URL resolution so URL assertions hold regardless of
// whether VITE_API_URL is set in the test environment.
const BASE = import.meta.env.VITE_API_URL || '/api/v1'

function mockResponse({ ok = true, status = 200, json } = {}) {
  return { ok, status, json: json ?? (async () => ({})) }
}

describe('utils/api — request client', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setTokenGetter(() => null) // default: unauthenticated
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // ── Auth header injection ──────────────────────────────────────────────────
  it('attaches a Bearer token + JSON content-type when a token is present', async () => {
    setTokenGetter(() => 'tok-123')
    fetchMock.mockResolvedValue(mockResponse({ json: async () => ({ ok: 1 }) }))

    await api.get('/positions')

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/positions`)
    expect(opts.headers.Authorization).toBe('Bearer tok-123')
    expect(opts.headers['Content-Type']).toBe('application/json')
  })

  it('omits the Authorization header when there is no token', async () => {
    setTokenGetter(() => null)
    fetchMock.mockResolvedValue(mockResponse({ json: async () => ({}) }))

    await api.get('/positions')

    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers.Authorization).toBeUndefined()
  })

  // ── Request shaping ────────────────────────────────────────────────────────
  it('serializes the body and sets the method for POST', async () => {
    fetchMock.mockResolvedValue(mockResponse({ json: async () => ({ id: 1 }) }))

    await api.post('/x', { a: 1, b: 'two' })

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/x`)
    expect(opts.method).toBe('POST')
    expect(opts.body).toBe(JSON.stringify({ a: 1, b: 'two' }))
  })

  it('sends no body for GET requests', async () => {
    fetchMock.mockResolvedValue(mockResponse({ json: async () => ({}) }))

    await api.get('/x')

    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.body).toBeUndefined()
  })

  // ── Success unwrapping ─────────────────────────────────────────────────────
  it('wraps a successful JSON response in { data }', async () => {
    fetchMock.mockResolvedValue(mockResponse({ json: async () => ({ hello: 'world' }) }))

    const res = await api.get('/x')

    expect(res).toEqual({ data: { hello: 'world' } })
  })

  it('returns { data: null } for a 204 No Content response', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 204 }))

    const res = await api.delete('/x/1')

    expect(res).toEqual({ data: null })
  })

  // ── Error normalization ────────────────────────────────────────────────────
  it('normalizes error.message and attaches status + code', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Bad input', code: 'VALIDATION_ERROR' } }),
    }))

    await expect(api.post('/x', {})).rejects.toMatchObject({
      message: 'Bad input',
      status: 400,
      code: 'VALIDATION_ERROR',
    })
  })

  it('falls back to `detail` when error.message is absent', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Unprocessable' }),
    }))

    await expect(api.get('/x')).rejects.toMatchObject({ message: 'Unprocessable', status: 422 })
  })

  it('falls back to "HTTP <status>" when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json') },
    }))

    await expect(api.get('/x')).rejects.toMatchObject({ message: 'HTTP 500', status: 500 })
  })

  // ── 401 handling ───────────────────────────────────────────────────────────
  it('surfaces a 401 as an error with status 401 for the auth layer to act on', async () => {
    fetchMock.mockResolvedValue(mockResponse({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Token expired', code: 'UNAUTHORIZED' } }),
    }))

    await expect(api.get('/dashboard/stats')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Token expired',
    })
  })
})
