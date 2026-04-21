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
import '../../styles/settings.css'

const TABS = [
  { group: 'GENERAL', items: [
    { key: 'profile', icon: '👤', label: 'My Profile' },
    { key: 'organization', icon: '🏢', label: 'Organization' },
    { key: 'team', icon: '👥', label: 'Team Members', adminOnly: true },
    { key: 'departments', icon: '🏗', label: 'Departments', adminOnly: true },
  ]},
  { group: 'HIRING & ATS', items: [
    { key: 'competitors', icon: '🏷', label: 'Competitor Intel' },
    { key: 'screening', icon: '❓', label: 'Screening Qs', adminOnly: true },
    { key: 'templates', icon: '📧', label: 'Msg Templates', adminOnly: true },
    { key: 'scorecards', icon: '🎯', label: 'Interview Tmpls', adminOnly: true },
  ]},
  { group: 'WORKSPACE', items: [
    { key: 'integrations', icon: '🔗', label: 'Integrations', adminOnly: true },
    { key: 'appearance', icon: '🎨', label: 'Appearance' },
    { key: 'security', icon: '🔐', label: 'Security', adminOnly: true },
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
}

export default function SettingsPage() {
  const { tab } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const activeTab = tab || 'profile'
  const isAdmin = user?.role === 'admin'

  const ActiveComponent = TAB_COMPONENTS[activeTab] || ProfileTab

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>⚙️ Settings</h1>
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
