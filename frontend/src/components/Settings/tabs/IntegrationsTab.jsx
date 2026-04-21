export default function IntegrationsTab() {
  const sections = [
    {
      title: 'Job Portals',
      items: [
        { name: 'LinkedIn', phase: 'Phase 3' },
        { name: 'Naukri', phase: 'Phase 3' },
        { name: 'Indeed', phase: 'Phase 3' },
      ],
    },
    {
      title: 'Email',
      items: [
        { name: 'Resend', status: 'Not configured', configurable: true },
        { name: 'SMTP', status: 'Not configured', configurable: true },
      ],
    },
    {
      title: 'Communication (Phase 2)',
      items: [
        { name: 'WhatsApp Business API', phase: 'Phase 2' },
      ],
    },
    {
      title: 'Calendar (Phase 2)',
      items: [
        { name: 'Google Calendar', phase: 'Phase 2' },
        { name: 'Outlook', phase: 'Phase 2' },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { name: 'Slack', phase: 'Phase 3' },
      ],
    },
  ]

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <h3>🔗 Integrations</h3>
        {sections.map(section => (
          <div key={section.title} className="integration-section">
            <h3>{section.title}</h3>
            <div className="card-grid">
              {section.items.map(item => (
                <div key={item.name} className="integration-card">
                  <div style={{flex: 1}}>
                    <div className="int-name">{item.name}</div>
                    <div className="int-status">
                      {item.phase ? (
                        <span className={`int-badge ${item.phase === 'Phase 2' ? 'phase2' : 'phase3'}`}>
                          {item.phase}
                        </span>
                      ) : (
                        <span>🔴 {item.status}</span>
                      )}
                    </div>
                  </div>
                  {item.configurable && (
                    <button className="btn btn-sm btn-secondary" disabled>Configure</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
