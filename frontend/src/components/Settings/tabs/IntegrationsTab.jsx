export default function IntegrationsTab() {
  const sections = [
    {
      title: 'Job Portals',
      items: [
        { name: 'LinkedIn', phase: 'P3' },
        { name: 'Naukri', phase: 'P3' },
        { name: 'Indeed', phase: 'P3' },
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
        { name: 'WhatsApp Business API', phase: 'P2' },
      ],
    },
    {
      title: 'Calendar (Phase 2)',
      items: [
        { name: 'Google Calendar', phase: 'P2' },
        { name: 'Outlook', phase: 'P2' },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { name: 'Slack', phase: 'P3' },
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
                        <span style={{
                          background: item.phase === 'P2' ? 'var(--color-primary-bg)' : 'var(--color-bg-elevated)',
                          color: item.phase === 'P2' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                          fontSize: '10px',
                          fontWeight: '800',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          minWidth: '24px',
                          minHeight: '24px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          letterSpacing: '0.05em',
                          padding: 0,
                          lineHeight: 1
                        }}>
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
