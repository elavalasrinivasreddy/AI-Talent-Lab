import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Button, Input } from '../../components/shared/ui'
import { candidatePortalApi } from '../../utils/api'

export default function SetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!token) {
      setError('Invalid or missing token.')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    
    try {
      setLoading(true)
      await candidatePortalApi.post('/set-password', { token, password })
      navigate('/candidate/login?setup=success')
    } catch (err) {
      setError(err.response?.data?.detail?.message || 'Failed to set password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-lg">
          <h1 className="text-2xl font-bold text-slate-900">AI Talent Lab</h1>
          <p className="text-muted mt-sm">Candidate Portal Setup</p>
        </div>
        
        <Card>
          <form onSubmit={handleSubmit} className="p-md flex flex-col gap-md">
            <h2 className="text-lg font-semibold mb-sm">Set your password</h2>
            <p className="text-sm text-muted mb-md">
              Create a password to track your applications and complete assessments.
            </p>
            
            {error && (
              <div className="bg-red-50 text-red-600 p-sm rounded text-sm border border-red-100">
                {error}
              </div>
            )}
            
            <Input
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            <Input
              type="password"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            
            <Button type="submit" variant="primary" className="w-full mt-sm" disabled={loading}>
              {loading ? 'Saving...' : 'Set Password'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
