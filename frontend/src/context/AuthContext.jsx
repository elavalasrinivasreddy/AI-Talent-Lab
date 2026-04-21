import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api, { setTokenGetter } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [org, setOrg] = useState(null)
  const [token, setToken] = useState(null) // In memory only — never localStorage
  const [loading, setLoading] = useState(true)

  // Wire up the axios interceptor with the current token
  useEffect(() => {
    setTokenGetter(() => token)
  }, [token])

  // On mount, try to restore session (token in memory → lost on refresh)
  useEffect(() => {
    setLoading(false) // No persistence — fresh session on refresh
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    setToken(data.token)
    setUser(data.user)
    // Fetch org info
    try {
      setTokenGetter(() => data.token)
      const meRes = await api.get('/auth/me')
      setOrg(meRes.data.org)
    } catch (e) {
      // Non-critical — user can still use the app
    }
    return data
  }, [])

  const register = useCallback(async (formData) => {
    const { data } = await api.post('/auth/register', formData)
    setToken(data.token)
    setUser(data.user)
    // Fetch org info
    try {
      setTokenGetter(() => data.token)
      const meRes = await api.get('/auth/me')
      setOrg(meRes.data.org)
    } catch (e) {
      // Non-critical
    }
    return data
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setOrg(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.user)
      setOrg(data.org)
    } catch (e) {
      console.error('Failed to refresh user', e)
    }
  }, [])

  const value = {
    user,
    org,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    refreshUser,
    setUser,
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
