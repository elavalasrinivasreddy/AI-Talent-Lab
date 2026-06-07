import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import api, { setTokenGetter } from '../utils/api'

const AuthContext = createContext(null)

// Session storage survives a page refresh but clears when the tab closes —
// a reasonable middle ground between "secure in-memory" and "always logged in".
const STORAGE_KEY = 'atl_session'

function loadSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.token === 'string' && parsed.user) return parsed
  } catch {
    // corrupted blob — ignore and start fresh
  }
  return null
}

function saveSession(token, user, org) {
  try {
    if (token && user) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user, org }))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // sessionStorage can be blocked in private modes — fail silently
  }
}

/**
 * Default landing route per role.
 * platform_admin lives outside the org sidebar; everyone else hits the
 * universal dashboard. Per docs/design/pages/14_auth.md.
 */
export function defaultRouteForRole(role) {
  if (role === 'platform_admin') return '/platform'
  return '/dashboard'
}

export function AuthProvider({ children }) {
  const initial = loadSession()
  const [user, setUser] = useState(initial?.user || null)
  const [org, setOrg] = useState(initial?.org || null)
  const [token, setToken] = useState(initial?.token || null)
  const [loading, setLoading] = useState(true)

  // Keep the latest token reachable from the api.js interceptor without
  // having to re-wire it on every state change.
  const tokenRef = useRef(token)
  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    setTokenGetter(() => tokenRef.current)
  }, [])

  // On boot, if we restored a token, validate it via /me before trusting it.
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      if (!initial?.token) {
        setLoading(false)
        return
      }
      try {
        const { data } = await api.get('/auth/me')
        if (cancelled) return
        setUser(data.user)
        setOrg(data.org)
        saveSession(initial.token, data.user, data.org)
      } catch (e) {
        if (cancelled) return
        // Only clear session on definitive auth rejection (401/403).
        // Transient errors (5xx, network) leave state intact so a brief
        // backend hiccup doesn't log the user out.
        const status = e?.status ?? e?.response?.status
        if (status === 401 || status === 403) {
          setUser(null)
          setOrg(null)
          setToken(null)
          saveSession(null, null, null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const _applySession = useCallback((data) => {
    setToken(data.token)
    setUser(data.user)
    setOrg(data.org || null)
    saveSession(data.token, data.user, data.org || null)
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    _applySession(data)
    return data
  }, [_applySession])

  const register = useCallback(async (formData) => {
    const { data } = await api.post('/auth/register', formData)
    _applySession(data)
    return data
  }, [_applySession])

  const requestMagicLink = useCallback(async (email) => {
    const { data } = await api.post('/auth/magic-link', { email })
    return data
  }, [])

  const verifyMagicLink = useCallback(async (magicToken) => {
    const { data } = await api.post('/auth/magic-link/verify', { token: magicToken })
    _applySession(data)
    return data
  }, [_applySession])

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {
      // Ignore network errors on logout, we still want to clear local state
    })
    setToken(null)
    setUser(null)
    setOrg(null)
    saveSession(null, null, null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.user)
      setOrg(data.org)
      // keep the persisted blob in sync with the latest org/user
      saveSession(tokenRef.current, data.user, data.org)
    } catch (e) {
      // If /me fails with 401 the access token is dead — bounce to login.
      if (e?.status === 401) logout()
    }
  }, [logout])

  const value = {
    user,
    org,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    requestMagicLink,
    verifyMagicLink,
    logout,
    refreshUser,
    setUser,
    defaultRoute: defaultRouteForRole(user?.role),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export default AuthContext
