import React, { useState, useEffect } from 'react'
import { Card, Button, Badge } from '../../components/shared/ui'
import { candidatePortalApi } from '../../utils/api'
import { PIPELINE_STAGES } from '../../utils/constants'

export default function CandidateDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [optInLoading, setOptInLoading] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await candidatePortalApi.get('/timeline')
      setData(res.data)
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOptIn = async (optIn) => {
    try {
      setOptInLoading(true)
      await candidatePortalApi.post('/opt-in-talent-pool', { opt_in: optIn })
      alert(optIn ? 'Successfully opted in!' : 'Successfully opted out.')
    } catch (err) {
      console.error('Failed to update preferences:', err)
      alert('Failed to update preferences.')
    } finally {
      setOptInLoading(false)
    }
  }

  if (loading) {
    return <div className="p-lg max-w-container mx-auto">Loading your dashboard...</div>
  }

  const { applications, timeline, interviews } = data || { applications: [], timeline: [], interviews: [] }

  return (
    <div className="p-lg max-w-container mx-auto">
      <div className="flex justify-between items-center mb-lg">
        <h1>My Candidate Portal</h1>
        <Button onClick={() => {
          localStorage.removeItem('candidate_token')
          window.location.href = '/candidate/login'
        }} variant="secondary">Log Out</Button>
      </div>
      
      <div className="grid gap-lg">
        {/* Opt in Section */}
        <Card title="Global Talent Pool" className="bg-slate-50 border-blue-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-slate-700 mb-xs">
                Allow organizations on AI Talent Lab to contact you with relevant opportunities. 
                We will safely store your profile and match you to jobs.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleOptIn(true)} disabled={optInLoading} variant="primary">Opt In</Button>
              <Button onClick={() => handleOptIn(false)} disabled={optInLoading} variant="secondary">Opt Out</Button>
            </div>
          </div>
        </Card>

        {/* Applications */}
        <div className="grid gap-md">
          <h2 className="text-xl font-bold">My Applications</h2>
          {applications.length === 0 ? (
            <Card>
              <p className="text-muted">No applications found.</p>
            </Card>
          ) : (
            applications.map(app => (
              <Card key={app.id} className="mb-md">
                <div className="flex justify-between items-start mb-md">
                  <div>
                    <h3 className="font-bold text-lg">{app.role_name}</h3>
                    <p className="text-sm text-muted">{app.location}</p>
                  </div>
                  <Badge variant={app.status === 'rejected' ? 'danger' : 'success'}>
                    {PIPELINE_STAGES.find(s => s.id === app.status)?.label || app.status}
                  </Badge>
                </div>
                
                {app.status === 'screening' && (
                  <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded">
                    <p className="text-sm text-orange-800 font-medium mb-2">Action Required: Pre-evaluation Test</p>
                    <p className="text-xs text-orange-700 mb-4">Please complete the written assessment for this role.</p>
                    <Button variant="primary" onClick={() => window.open(`/status/${app.id}`, '_blank')}>
                      Start Pre-evaluation
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Interviews */}
        {interviews.length > 0 && (
          <div className="grid gap-md">
            <h2 className="text-xl font-bold">Upcoming Interviews</h2>
            {interviews.map(i => (
              <Card key={i.id}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold">{i.round_name}</p>
                    <p className="text-sm text-muted">{new Date(i.scheduled_at).toLocaleString()}</p>
                  </div>
                  <Badge variant="warning">Scheduled</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
