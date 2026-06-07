/**
 * components/Positions/PositionDetailPage.jsx
 * v3 redesign — Stack-ranked pipeline view with stage health.
 * Per docs/design/pages/03_position_detail.md
 * Redesigned 2026-05-29.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { positionsApi, dashboardApi } from '../../utils/api'
import PositionHero from './PositionHero'
import StageStatStrip from './StageStatStrip'
import PipelineStackView from './PipelineStackView'
import CandidatesTab from './tabs/CandidatesTab'
import JDTab from './tabs/JDTab'
import InterviewKitTab from './tabs/InterviewKitTab'
import ActivityTab from './tabs/ActivityTab'
import PositionSettingsTab from './tabs/PositionSettingsTab'
import Icon from '../common/Icon'
import Toast from '../common/Toast'
import './PositionDetailPage.css'

const TABS = [
  { id: 'pipeline',       label: 'Pipeline',      icon: 'layers' },
  { id: 'candidates',     label: 'Candidates',    icon: 'users' },
  { id: 'jd',             label: 'JD',            icon: 'file-text' },
  { id: 'interview-kit',  label: 'Interview Kit', icon: 'briefcase' },
  { id: 'activity',       label: 'Activity',      icon: 'clock' },
  { id: 'settings',       label: 'Settings',      icon: 'settings' },
]

export default function PositionDetailPage() {
  const { id, tab: tabParam } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canEditSettings = user?.role === 'hr' || user?.role === 'org_head'
  const visibleTabs = TABS.filter(t => t.id !== 'settings' || canEditSettings)
  const [activeTab, setActiveTab] = useState(tabParam || 'pipeline')
  const [position, setPosition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchMsg, setSearchMsg] = useState('')

  // Pipeline summary for v3 stage health
  const [summary, setSummary] = useState(null)
  const [summaryUnavailable, setSummaryUnavailable] = useState(false)
  const [activeStage, setActiveStage] = useState('sourced')
  const [toast, setToast] = useState(null)

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

  const loadSummary = useCallback(async () => {
    try {
      const data = await positionsApi.pipelineSummary(id)
      setSummary(data)
      setSummaryUnavailable(false)

      // Auto-select first stage with candidates
      if (data?.stages) {
        const stagesWithCandidates = Object.entries(data.stages)
          .filter(([, v]) => v.count > 0)
          .sort((a, b) => {
            const order = ['screening', 'interview', 'applied', 'sourced', 'emailed', 'selected', 'rejected']
            return order.indexOf(a[0]) - order.indexOf(b[0])
          })
        if (stagesWithCandidates.length > 0) {
          setActiveStage(stagesWithCandidates[0][0])
        }
      }
    } catch {
      setSummaryUnavailable(true)
    }
  }, [id])

  useEffect(() => { loadPosition() }, [loadPosition])
  useEffect(() => { loadSummary() }, [loadSummary])

  const switchTab = (tabId) => {
    setActiveTab(tabId)
    navigate(`/positions/${id}/${tabId}`, { replace: true })
  }

  const handleSearchNow = async () => {
    setSearching(true)
    setSearchMsg('')
    try {
      const res = await positionsApi.searchNow(id)
      setSearchMsg(res.queued ? 'Search queued! Candidates will appear shortly.' : 'Could not queue search.')
    } catch (e) {
      setSearchMsg(`Error: ${e.message}`)
    } finally {
      setSearching(false)
      setTimeout(() => setSearchMsg(''), 5000)
    }
  }

  const handleStatusChange = async (newStatus) => {
    try {
      const updated = await positionsApi.updateStatus(id, newStatus)
      setPosition(prev => ({ ...prev, ...updated }))
      setToast({ message: 'Position status updated', type: 'success' })
    } catch (e) {
      setToast({ message: `Failed to update status: ${e.message}`, type: 'error' })
    }
  }

  if (loading) return <PositionSkeleton />
  if (error) return (
    <div className="pd-error">
      <Icon name="alert-triangle" size={40} style={{ opacity: 0.3 }} />
      <p>{error}</p>
      <Link to="/positions" className="pd-btn pd-btn-outline">
        <Icon name="chevron-right" size={14} style={{ transform: 'rotate(180deg)' }} />
        Back to Positions
      </Link>
    </div>
  )

  // JD version label for tab
  const jdVersion = position.jd_version ? `v${position.jd_version}` : null

  return (
    <div className="pd-page">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Hero */}
      <PositionHero
        position={position}
        searching={searching}
        searchMsg={searchMsg}
        onSearchNow={handleSearchNow}
        onStatusChange={handleStatusChange}
      />

      {/* 7-stage stat strip */}
      <StageStatStrip
        summary={summary}
        activeStage={activeStage}
        onStageClick={setActiveStage}
      />

      {/* Tab Bar */}
      <div className="pd-tab-bar">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            className={`pd-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => switchTab(t.id)}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
            {t.id === 'jd' && jdVersion && (
              <span className="pd-tab-version">{jdVersion}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="pd-tab-content">
        {activeTab === 'pipeline' && (
          <PipelineStackView
            positionId={id}
            activeStage={activeStage}
            summary={summary}
            summaryUnavailable={summaryUnavailable}
          />
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
          <div className="pd-tab-panel active">
            <ActivityTab position={position} />
          </div>
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
    <div className="pd-page">
      <div className="skeleton-block" style={{ height: 160, borderRadius: 14 }} />
      <div className="skeleton-block" style={{ height: 64, marginTop: 12, borderRadius: 10 }} />
      <div className="skeleton-block" style={{ height: 44, marginTop: 12, borderRadius: 10 }} />
      <div className="skeleton-block" style={{ height: 400, marginTop: 12, borderRadius: 14 }} />
    </div>
  )
}
