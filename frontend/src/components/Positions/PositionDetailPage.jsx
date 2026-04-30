/**
 * components/Positions/PositionDetailPage.jsx
 * Full position detail with 6 tabs: Pipeline, Candidates, JD, Interview Kit, Activity, Settings
 * Per docs/pages/04_position_detail.md
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { positionsApi, dashboardApi } from '../../utils/api'
import { POSITION_STATUSES, PRIORITY_LABELS } from '../../utils/constants'
import StatusBadge from '../common/StatusBadge'
import PipelineTab from './tabs/PipelineTab'
import CandidatesTab from './tabs/CandidatesTab'
import JDTab from './tabs/JDTab'
import InterviewKitTab from './tabs/InterviewKitTab'
import ActivityTab from './tabs/ActivityTab'
import PositionSettingsTab from './tabs/PositionSettingsTab'
import './PositionDetailPage.css'

const TABS = [
  { id: 'pipeline', label: '📊 Pipeline' },
  { id: 'candidates', label: '👥 Candidates' },
  { id: 'jd', label: '📄 JD' },
  { id: 'interview-kit', label: '🎯 Interview Kit' },
  { id: 'activity', label: '📜 Activity' },
  { id: 'settings', label: '⚙️ Settings' },
]

export default function PositionDetailPage() {
  const { id, tab: tabParam } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(tabParam || 'pipeline')
  const [position, setPosition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchMsg, setSearchMsg] = useState('')

  const loadPosition = useCallback(async () => {
    try {
      const data = await positionsApi.get(id)
      setPosition(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadPosition() }, [loadPosition])

  const switchTab = (tabId) => {
    setActiveTab(tabId)
    navigate(`/positions/${id}/${tabId}`, { replace: true })
  }

  const handleSearchNow = async () => {
    setSearching(true)
    setSearchMsg('')
    try {
      const res = await positionsApi.searchNow(id)
      setSearchMsg(res.queued ? '✅ Search queued! Candidates will appear shortly.' : '⚠️ Could not queue search.')
    } catch (e) {
      setSearchMsg(`❌ ${e.message}`)
    } finally {
      setSearching(false)
      setTimeout(() => setSearchMsg(''), 5000)
    }
  }

  const handleStatusChange = async (newStatus) => {
    try {
      const updated = await positionsApi.updateStatus(id, newStatus)
      setPosition(prev => ({ ...prev, ...updated }))
    } catch (e) {
      alert(`Failed to update status: ${e.message}`)
    }
  }

  if (loading) return <PositionSkeleton />
  if (error) return (
    <div className="pos-error">
      <span>⚠️</span>
      <p>{error}</p>
      <Link to="/positions">← Back to Positions</Link>
    </div>
  )

  const priority = PRIORITY_LABELS[position.priority] || PRIORITY_LABELS.normal
  const counts = position.pipeline_counts || {}
  const totalCandidates = position.total_candidates || 0

  return (
    <div className="pos-detail">
      {/* ── Header ── */}
      <div className="pos-header">
        <Link to="/positions" className="pos-back-link">← Back to Positions</Link>

        <div className="pos-header-main">
          <div className="pos-header-left">
            <h1 className="pos-title">{position.role_name}</h1>
            <div className="pos-meta">
              <span className="pos-meta-item">{position.department_name || 'Engineering'}</span>
              <span className="pos-meta-sep">·</span>
              <span className="pos-meta-item">
                Created {new Date(position.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {position.deadline && (
                <>
                  <span className="pos-meta-sep">·</span>
                  <span className="pos-meta-item">Deadline: {position.deadline}</span>
                </>
              )}
            </div>
            <div className="pos-badges">
              <StatusBadge status={position.status} type="position" size="md" />
              <span className="pos-priority-badge" style={{ color: priority.color }}>
                {priority.label}
              </span>
              <span className="pos-headcount-badge">
                👥 Headcount: {position.headcount}
              </span>
            </div>
          </div>

          <div className="pos-header-actions">
            <button
              className="btn-outline"
              onClick={handleSearchNow}
              disabled={searching}
            >
              {searching ? '⏳ Searching...' : '🔍 Run Search Now'}
            </button>

            <select
              className="pos-status-select"
              value={position.status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="open">Open</option>
              <option value="on_hold">On Hold</option>
              <option value="closed">Close Position</option>
              <option value="archived">Archive</option>
            </select>
          </div>
        </div>

        {searchMsg && <div className="pos-search-msg">{searchMsg}</div>}

        {/* ── Stats Row ── */}
        <div className="pos-stats-row">
          {[
            { label: 'Sourced', count: counts.sourced || 0, icon: '🔍' },
            { label: 'Emailed', count: counts.emailed || 0, icon: '📧' },
            { label: 'Applied', count: counts.applied || 0, icon: '📝' },
            { label: 'Screening', count: counts.screening || 0, icon: '🔎' },
            { label: 'Interview', count: counts.interview || 0, icon: '🎙️' },
            { label: 'Selected', count: counts.selected || 0, icon: '✅' },
          ].map(({ label, count, icon }) => (
            <div key={label} className="pos-stat-item">
              <span className="pos-stat-icon">{icon}</span>
              <span className="pos-stat-count">{count}</span>
              <span className="pos-stat-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="pos-tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`pos-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="pos-tab-content">
        {activeTab === 'pipeline' && (
          <PipelineTab positionId={id} orgId={position.org_id} />
        )}
        {activeTab === 'candidates' && (
          <CandidatesTab positionId={id} />
        )}
        {activeTab === 'jd' && (
          <JDTab position={position} onUpdate={setPosition} />
        )}
        {activeTab === 'interview-kit' && (
          <InterviewKitTab positionId={id} />
        )}
        {activeTab === 'activity' && (
          <ActivityTab positionId={id} />
        )}
        {activeTab === 'settings' && (
          <PositionSettingsTab position={position} onUpdate={setPosition} />
        )}
      </div>
    </div>
  )
}

function PositionSkeleton() {
  return (
    <div className="pos-detail">
      <div className="pos-header skeleton-block" style={{ height: 180 }} />
      <div className="pos-tab-bar skeleton-block" style={{ height: 44, marginTop: 16 }} />
      <div className="skeleton-block" style={{ height: 400, marginTop: 16, borderRadius: 12 }} />
    </div>
  )
}
