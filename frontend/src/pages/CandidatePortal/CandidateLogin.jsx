import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { candidatePortalApi } from '../../utils/api'

export default function CandidateLogin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // org context arrives via ?org=<id> on the link emailed to the candidate.
  const orgFromQuery = searchParams.get('org')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgId, setOrgId] = useState(orgFromQuery || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    if (!orgId) {
      setError('Missing organization. Please use the link from your invitation email.')
      return
    }
    try {
      setLoading(true)
      const res = await candidatePortalApi.login({
        email,
        password,
        org_id: parseInt(orgId, 10),
      })
      if (res?.access_token) {
        localStorage.setItem('candidate_token', res.access_token)
        navigate('/candidate/dashboard')
      } else {
        setError('Login failed. Please try again.')
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-lg">
          <h1 className="text-2xl font-bold text-slate-900">AI Talent Lab</h1>
          <p className="text-muted mt-sm">Candidate Portal</p>
        </div>

        <div className="settings-card" style={{ padding: 24 }}>
          <form onSubmit={handleLogin} className="flex flex-col gap-md">
            <h2 className="text-lg font-semibold">Log in</h2>

            {error && (
              <div className="bg-red-50 text-red-600 p-sm rounded text-sm border border-red-100">
                {error}
              </div>
            )}

            {!orgFromQuery && (
              <label className="text-sm">
                Organization ID
                <input
                  className="form-input"
                  type="number"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  required
                />
              </label>
            )}

            <label className="text-sm">
              Email
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="text-sm">
              Password
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
