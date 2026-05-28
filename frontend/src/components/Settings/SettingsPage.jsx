import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ProfileTab from './tabs/ProfileTab'
import OrganizationTab from './tabs/OrganizationTab'
import TeamTab from './tabs/TeamTab'
import DepartmentsTab from './tabs/DepartmentsTab'
import CompetitorsTab from './tabs/CompetitorsTab'
import ScreeningQuestionsTab from './tabs/ScreeningQuestionsTab'
import MessageTemplatesTab from './tabs/MessageTemplatesTab'
import InterviewTemplatesTab from './tabs/InterviewTemplatesTab'
import IntegrationsTab from './tabs/IntegrationsTab'
import AppearanceTab from './tabs/AppearanceTab'
import SecurityTab from './tabs/SecurityTab'
import PrivacyTab from './tabs/PrivacyTab'
import '../../styles/settings.css'

// Inline Lucide-style SVG icons (no external deps)
const Svg = (paths) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
)
const SettingsIcons = {
  profile:      Svg(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  organization: Svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h6" /></>),
  team:         Svg(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  departments:  Svg(<><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21V12h6v9" /></>),
  competitors:  Svg(<><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></>),
  screening:    Svg(<><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
  templates:    Svg(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>),
  scorecards:   Svg(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>),
  integrations: Svg(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>),
  appearance:   Svg(<><circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" /><circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></>),
  security:     Svg(<><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  privacy:      Svg(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>),
  cog:          Svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
}

const TABS = [
  { group: 'GENERAL', items: [
    { key: 'profile',      icon: SettingsIcons.profile,      label: 'My Profile' },
    { key: 'organization', icon: SettingsIcons.organization, label: 'Organization' },
    { key: 'team',         icon: SettingsIcons.team,         label: 'Team Members', adminOnly: true },
    { key: 'departments',  icon: SettingsIcons.departments,  label: 'Departments',  adminOnly: true },
  ]},
  { group: 'HIRING & ATS', items: [
    { key: 'competitors', icon: SettingsIcons.competitors, label: 'Competitor Intel' },
    { key: 'screening',   icon: SettingsIcons.screening,   label: 'Screening Qs',    adminOnly: true },
    { key: 'templates',   icon: SettingsIcons.templates,   label: 'Msg Templates',   adminOnly: true },
    { key: 'scorecards',  icon: SettingsIcons.scorecards,  label: 'Interview Tmpls', adminOnly: true },
  ]},
  { group: 'WORKSPACE', items: [
    { key: 'integrations', icon: SettingsIcons.integrations, label: 'Integrations', adminOnly: true },
    { key: 'appearance',   icon: SettingsIcons.appearance,   label: 'Appearance' },
    { key: 'security',     icon: SettingsIcons.security,     label: 'Security',     adminOnly: true },
    { key: 'privacy',      icon: SettingsIcons.privacy,      label: 'Privacy & GDPR', adminOnly: true },
  ]},
]

const TAB_COMPONENTS = {
  profile: ProfileTab,
  organization: OrganizationTab,
  team: TeamTab,
  departments: DepartmentsTab,
  competitors: CompetitorsTab,
  screening: ScreeningQuestionsTab,
  templates: MessageTemplatesTab,
  scorecards: InterviewTemplatesTab,
  integrations: IntegrationsTab,
  appearance: AppearanceTab,
  security: SecurityTab,
  privacy: PrivacyTab,
}

export default function SettingsPage() {
  const { tab } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const activeTab = tab || 'profile'
  const isAdmin = user?.role === 'org_head' || user?.role === 'dept_admin'

  const ActiveComponent = TAB_COMPONENTS[activeTab] || ProfileTab

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1><span className="settings-header-icon">{SettingsIcons.cog}</span>Settings</h1>
        <p>Manage your account and organization</p>
      </div>

      <div className="settings-layout">
        <nav className="settings-tabs">
          {TABS.map(group => (
            <div key={group.group}>
              <div className="settings-tab-group-label">{group.group}</div>
              {group.items.map(item => {
                if (item.adminOnly && !isAdmin) return null
                return (
                  <button
                    key={item.key}
                    className={`settings-tab ${activeTab === item.key ? 'active' : ''}`}
                    onClick={() => navigate(`/settings/${item.key}`)}
                  >
                    <span className="settings-tab-icon">{item.icon}</span>
                    {item.label}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="settings-content">
          <ActiveComponent />
        </div>
      </div>
    </div>
  )
}
