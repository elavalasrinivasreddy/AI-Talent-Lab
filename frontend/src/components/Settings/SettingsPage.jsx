/**
 * Settings/SettingsPage.jsx — v3 AI Behavior Console
 * Per docs/design/pages/07_settings.md
 * Redesigned 2026-05-29.
 *
 * 3-column: purpose-grouped left rail → middle form → right live preview
 */
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../common/Icon'
import Chip from '../common/Chip'
import SettingsLivePreview from './SettingsLivePreview'
import { settingsApi } from '../../utils/api'

import ProfileTab from './tabs/ProfileTab'
import OrganizationTab from './tabs/OrganizationTab'
import TeamTab from './tabs/TeamTab'
import DepartmentsTab from './tabs/DepartmentsTab'
import CompetitorsTab from './tabs/CompetitorsTab'
import ScreeningQuestionsTab from './tabs/ScreeningQuestionsTab'
import AtsRulesTab from './tabs/AtsRulesTab'
import MessageTemplatesTab from './tabs/MessageTemplatesTab'
import ApprovalRulesTab from './tabs/ApprovalRulesTab'
import NotificationsTab from './tabs/NotificationsTab'
import InterviewTemplatesTab from './tabs/InterviewTemplatesTab'
import ProvidersTab from './tabs/ProvidersTab'
import AppearanceTab from './tabs/AppearanceTab'
import SecurityTab from './tabs/SecurityTab'
import PrivacyTab from './tabs/PrivacyTab'
import CareerBrandTab from './tabs/CareerBrandTab'
import AuditTab from './tabs/AuditTab'
import DataExportTab from './tabs/DataExportTab'
import SourcingTab from './tabs/SourcingTab'
import '../../styles/settings.css'

const RAIL_GROUPS = [
  {
    key: 'ai',
    label: 'How the AI thinks',
    icon: 'cpu',
    color: 'var(--color-primary)',
    items: [
      { key: 'ats-rules', icon: 'bar-chart', label: 'ATS scoring rules', adminOnly: true },
      { key: 'sourcing', icon: 'search', label: 'Sourcing schedule', adminOnly: true },
      { key: 'screening', icon: 'help-circle', label: 'Screening questions', adminOnly: true },
      { key: 'scorecards', icon: 'target', label: 'Scorecard rubric', adminOnly: true },
      { key: 'bias', icon: 'shield', label: 'JD bias detection', adminOnly: true, phase: 2 },
      { key: 'providers', icon: 'settings', label: 'Providers & API keys', platformAdminOnly: true },
    ],
  },
  {
    key: 'team',
    label: 'How your team works',
    icon: 'users',
    color: '#8B5CF6',
    items: [
      { key: 'departments', icon: 'home', label: 'Departments', orgHeadOnly: true },
      { key: 'team', icon: 'users', label: 'Team members', adminOnly: true },
      { key: 'approval', icon: 'check', label: 'Approval rules' }, // accessible to HM and Admins
      { key: 'notifications', icon: 'bell', label: 'Notifications' },
    ],
  },
  {
    key: 'candidates',
    label: 'How candidates see you',
    icon: 'user',
    color: '#06B6D4',
    items: [
      { key: 'organization', icon: 'briefcase', label: 'Organization profile', orgHeadOnly: true },
      { key: 'competitors', icon: 'trending-up', label: 'Competitor intel', adminOnly: true },
      { key: 'templates', icon: 'mail', label: 'Email templates' },
      { key: 'appearance', icon: 'palette', label: 'Appearance' },
      { key: 'career-brand', icon: 'home', label: 'Career page brand', adminOnly: true },
    ],
  },
  {
    key: 'compliance',
    label: 'Compliance & data',
    icon: 'lock',
    color: 'var(--color-text-muted)',
    items: [
      { key: 'privacy', icon: 'shield', label: 'GDPR / DPDP', adminOnly: true },
      { key: 'security', icon: 'lock', label: 'Security', adminOnly: true },
      
      { key: 'audit', icon: 'clock', label: 'Audit log', orgHeadOnly: true },
      { key: 'export', icon: 'download', label: 'Data export', adminOnly: true },
    ],
  },
]

const SECTION_COMPONENTS = {
  'profile': ProfileTab,
  'ats-rules': AtsRulesTab,
  'sourcing': SourcingTab,
  'screening': ScreeningQuestionsTab,
  'scorecards': InterviewTemplatesTab,
  'bias': () => <PlaceholderSection title="JD Bias Detection" desc="Configure bias sensitivity level and language model for JD analysis." icon="shield" phase={2} />,
  'providers': ProvidersTab,
  'departments': DepartmentsTab,
  'team': TeamTab,
  'approval': ApprovalRulesTab,
  'notifications': NotificationsTab,
  'organization': OrganizationTab,
  'competitors': CompetitorsTab,
  'templates': MessageTemplatesTab,
  'appearance': AppearanceTab,
  'career-brand': CareerBrandTab,
  'privacy': PrivacyTab,
  'security': SecurityTab,
  
  'audit': AuditTab,
  'export': DataExportTab,
}

export default function SettingsPage() {
  const { tab } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isPlatformAdmin = user?.role === 'platform_admin'
  const isAdmin = user?.role === 'org_head' || user?.role === 'dept_admin'

  // If a non-admin lands on an admin-only section via direct URL, fall back to profile.
  const allAdminKeys = RAIL_GROUPS.flatMap(g => g.items.filter(i => i.adminOnly).map(i => i.key))
  const allOrgHeadKeys = RAIL_GROUPS.flatMap(g => g.items.filter(i => i.orgHeadOnly).map(i => i.key))
  const allPlatformAdminKeys = RAIL_GROUPS.flatMap(g => g.items.filter(i => i.platformAdminOnly).map(i => i.key))

  let isAllowed = true;
  if (allPlatformAdminKeys.includes(tab) && !isPlatformAdmin) isAllowed = false;
  else if (allOrgHeadKeys.includes(tab) && user?.role !== 'org_head') isAllowed = false;
  else if (allAdminKeys.includes(tab) && !isAdmin) isAllowed = false;

  const resolvedTab = isAllowed ? (tab || 'profile') : 'profile'
  const [activeSection, setActiveSection] = useState(resolvedTab)

  // ── AI Behavior Settings persistence ──────────────────────────────────────
  const [aiSettings, setAiSettings] = useState({})
  const [aiSaveStatus, setAiSaveStatus] = useState(null) // null | 'saving' | 'saved' | 'error'
  const saveToastTimer = useRef(null)

  useEffect(() => {
    settingsApi.getAiBehavior()
      .then(res => setAiSettings(res.settings || {}))
      .catch(() => { /* silently ignore — settings not critical to page load */ })
  }, [])

  const handleSaveAiBehavior = async () => {
    setAiSaveStatus('saving')
    try {
      const res = await settingsApi.updateAiBehavior(aiSettings)
      setAiSettings(res.settings || {})
      setAiSaveStatus('saved')
      clearTimeout(saveToastTimer.current)
      saveToastTimer.current = setTimeout(() => setAiSaveStatus(null), 3000)
    } catch {
      setAiSaveStatus('error')
      clearTimeout(saveToastTimer.current)
      saveToastTimer.current = setTimeout(() => setAiSaveStatus(null), 4000)
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const switchSection = (key) => {
    setActiveSection(key)
    setPreviewData(null) // Reset preview data when switching tabs
    navigate(`/settings/${key}`, { replace: true })
  }

  const ActiveComponent = SECTION_COMPONENTS[activeSection] || ProfileTab
  const [previewData, setPreviewData] = useState(null)

  return (
    <div className="st-page">
      {/* 2-column or 3-column layout */}
      <div className={`st-layout ${!['ats-rules', 'sourcing', 'screening', 'scorecards', 'bias', 'career-brand'].includes(activeSection) ? 'no-right-rail' : ''}`}>
        {/* Left Rail */}
        <nav className="st-rail">
          {/* Profile shortcut */}
          <button
            className={`st-rail-item ${activeSection === 'profile' ? 'active' : ''}`}
            onClick={() => switchSection('profile')}
          >
            <Icon name="user" size={14} />
            <span>My Profile</span>
          </button>
          <div className="st-rail-divider" />

          {RAIL_GROUPS.map(group => (
            <div key={group.key} className="st-rail-group">
              <div className="st-rail-group-label" style={{ color: group.color }}>
                <Icon name={group.icon} size={13} />
                {group.label}
              </div>
              {group.items.map(item => {
                if (item.platformAdminOnly && !isPlatformAdmin) return null;

                const isOrgHeadLocked = item.orgHeadOnly && user?.role !== 'org_head';

                // Determine if read-only or fully locked
                // Per spec: ATS and Email templates are read-only for HR. Sourcing is editable for HR.
                let isFullyLocked = false;
                let isReadOnly = false;

                if (item.adminOnly && !isAdmin) {
                  if (user?.role === 'hr') {
                    if (['ats-rules', 'templates', 'sourcing'].includes(item.key)) {
                      isReadOnly = true; // HR can view but not edit
                    } else {
                      isFullyLocked = true; // Everything else admin-only is locked for HR
                    }
                  } else {
                    isFullyLocked = true; // For HM (team_lead), all admin-only is locked
                  }
                }

                if (item.key === 'approval' && user?.role === 'hr') {
                  isFullyLocked = true;
                }

                const isDisabled = isOrgHeadLocked || isFullyLocked;

                return (
                  <button
                    key={item.key}
                    className={`st-rail-item ${activeSection === item.key ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!isDisabled) switchSection(item.key);
                    }}
                    style={activeSection === item.key && !isDisabled ? { '--rail-accent': group.color } : {}}
                    disabled={isDisabled}
                  >
                    <Icon name={item.icon} size={13} />
                    <span>{item.label}</span>
                    {item.phase && (
                      <span style={{ 
                        marginLeft: 'auto',
                        color: 'var(--color-primary)', 
                        fontSize: '11px', 
                        fontWeight: 'bold'
                      }}>
                        P{item.phase}
                      </span>
                    )}
                    {isDisabled && <span className="st-rail-lock"><Icon name="lock" size={10} /></span>}
                    {isReadOnly && !isDisabled && <span className="st-rail-readonly" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>(Read-only)</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Middle Form */}
        <div className="st-form-area">
          {(() => {
            // Re-evaluate readonly status for the active component to pass it down
            let activeItemReadOnly = false;
            const activeItem = RAIL_GROUPS.flatMap(g => g.items).find(i => i.key === activeSection);
            if (activeItem && activeItem.adminOnly && !isAdmin && user?.role === 'hr') {
              if (['ats-rules', 'templates', 'sourcing'].includes(activeItem.key)) {
                activeItemReadOnly = true;
              }
            }
            return <ActiveComponent isReadOnly={activeItemReadOnly} onPreviewUpdate={setPreviewData} />
          })()}
        </div>

        {/* Right Preview - Conditionally rendered */}
        {['ats-rules', 'sourcing', 'screening', 'scorecards', 'bias', 'career-brand'].includes(activeSection) && (
          <SettingsLivePreview activeSection={activeSection} previewData={previewData} />
        )}
      </div>
    </div>
  )
}

function PlaceholderSection({ title, desc, icon, phase }) {
  return (
    <div className="placeholder-section">
      <Icon name={icon} size={40} style={{ opacity: 0.2 }} />
      <h3>{title}</h3>
      <p>{desc}</p>
      {phase && <Chip variant="warning" size="sm">Phase {phase} — Coming Soon</Chip>}
    </div>
  )
}
