import React, { useState, useEffect } from 'react'
import { candidatePortalApi } from '../../utils/api'
import { PIPELINE_STAGES } from '../../utils/constants'

export default function CandidateDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [optInLoading, setOptInLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchData = async () => {
    // Auth guard: no token → straight to login.
    if (!localStorage.getItem('candidate_token')) {
      window.location.href = '/candidate/login'
      return
    }
    try {
      setLoading(true)
      const res = await candidatePortalApi.getTimeline()
      setData(res)
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem('candidate_token')
        window.location.href = '/candidate/login'
        return
      }
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
      await candidatePortalApi.optInTalentPool(optIn)
      showToast(optIn ? 'Successfully opted in!' : 'Successfully opted out.')
    } catch (err) {
      console.error('Failed to update preferences:', err)
      showToast('Failed to update preferences.', 'error')
    } finally {
      setOptInLoading(false)
    }
  }

  if (loading) {
    return <div className="p-lg max-w-container mx-auto">Loading your dashboard...</div>
  }

  const { applications, interviews } = data || { applications: [], interviews: [] }

  return (
    <div className="p-lg max-w-container mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded shadow-lg text-sm font-medium z-50 ${toast.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
          {toast.msg}
        </div>
      )}
      <div className="flex justify-between items-center mb-lg">
        <h1>My Candidate Portal</h1>
        <button
          className="btn btn-secondary"
          onClick={() => {
            localStorage.removeItem('candidate_token')
            window.location.href = '/candidate/login'
          }}
        >
          Log Out
        </button>
      </div>

      <div className="grid gap-lg">
        {/* Talent pool opt-in (candidate consent) */}
        <div className="settings-card bg-slate-50 border-blue-100" style={{ padding: 16 }}>
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-700 mb-xs">
              Allow organizations on AI Talent Lab to contact you with relevant opportunities.
              We will safely store your profile and match you to jobs.
            </p>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => handleOptIn(true)} disabled={optInLoading}>Opt In</button>
              <button className="btn btn-secondary" onClick={() => handleOptIn(false)} disabled={optInLoading}>Opt Out</button>
            </div>
          </div>
        </div>

        {/* Applications */}
        <div className="grid gap-md">
          <h2 className="text-xl font-bold">My Applications</h2>
          {applications.length === 0 ? (
            <div className="settings-card" style={{ padding: 16 }}>
              <p className="text-muted">No applications found.</p>
            </div>
          ) : (
            applications.map(app => (
              <div key={app.id} className="settings-card mb-md" style={{ padding: 16 }}>
                <div className="flex justify-between items-start mb-md">
                  <div>
                    <h3 className="font-bold text-lg">{app.role_name}</h3>
                    <p className="text-sm text-muted">{app.location}</p>
                  </div>
                  <span className={`status-badge ${app.status === 'rejected' ? 'status-danger' : 'status-success'}`}>
                    {PIPELINE_STAGES[app.status]?.label || app.status}
                  </span>
                </div>

                {app.status === 'screening' && (
                  <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded">
                    <p className="text-sm text-orange-800 font-medium mb-2">Action Required: Pre-evaluation Test</p>
                    <p className="text-xs text-orange-700 mb-4">Please complete the written assessment for this role.</p>
                    {app.pre_eval_token ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => window.open(`/pre-evaluations/${app.pre_eval_token}`, '_blank')}
                      >
                        Start Pre-evaluation
                      </button>
                    ) : (
                      // TODO(backend): include the pre_evaluations.token in the /candidate/timeline payload
                      // so this button can deep-link to the assessment. Until then, candidates use the link
                      // from their invitation email.
                      <p className="text-xs text-orange-700">Check your email for the assessment link.</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Interviews */}
        {interviews.length > 0 && (
          <div className="grid gap-md">
            <h2 className="text-xl font-bold">Upcoming Interviews</h2>
            {interviews.map((i, idx) => (
              <div key={idx} className="settings-card" style={{ padding: 16 }}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold">{i.round_name}</p>
                    <p className="text-sm text-muted">{new Date(i.scheduled_at).toLocaleString()}</p>
                  </div>
                  <span className="status-badge status-warning">Scheduled</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
