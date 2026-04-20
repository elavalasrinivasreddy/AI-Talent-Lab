import axios from 'axios'
import { API_BASE } from './constants'

/**
 * Pre-configured axios instance.
 * Token is attached via interceptor from AuthContext.
 */
const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — attach JWT from memory
let _getToken = () => null

export function setTokenGetter(fn) {
  _getToken = fn
}

api.interceptors.request.use((config) => {
  const token = _getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — handle standard error format
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data
    if (data?.error) {
      const apiError = new Error(data.error.message || 'An error occurred')
      apiError.code = data.error.code
      apiError.status = err.response.status
      apiError.details = data.error.details
      return Promise.reject(apiError)
    }
    return Promise.reject(err)
  }
)

export default api
