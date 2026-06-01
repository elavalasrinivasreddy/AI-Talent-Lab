export default function SecurityTab() {
  return (
    <div className="settings-form">
      <div className="placeholder-section">
        <div className="placeholder-icon">🔐</div>
        <h3>Security Settings</h3>
        <p>Enhanced security features are coming soon.</p>
        <div style={{
          marginTop: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          textAlign: 'left',
          maxWidth: 400,
        }}>
          <div className="settings-card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
              <span style={{
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-secondary)',
                fontSize: '10px',
                fontWeight: '800',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '0.05em'
              }}>
                ...
              </span>
            </div>
            <h4>Password Policy</h4>
            <p>Configure minimum requirements</p>
          </div>
          <div className="settings-card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
              <span style={{
                background: 'var(--color-primary-bg)',
                color: 'var(--color-primary)',
                fontSize: '10px',
                fontWeight: '800',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '0.05em'
              }}>
                P2
              </span>
            </div>
            <h4>Two-Factor Auth (TOTP)</h4>
            <p>Add extra layer of protection</p>
          </div>
          <div className="settings-card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
              <span style={{
                background: 'var(--color-primary-bg)',
                color: 'var(--color-primary)',
                fontSize: '10px',
                fontWeight: '800',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '0.05em'
              }}>
                P2
              </span>
            </div>
            <h4>Session Management</h4>
            <p>View and revoke active sessions</p>
          </div>
          <div className="settings-card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
              <span style={{
                background: 'var(--color-primary-bg)',
                color: 'var(--color-primary)',
                fontSize: '10px',
                fontWeight: '800',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '0.05em'
              }}>
                P2
              </span>
            </div>
            <h4>Login History</h4>
            <p>Audit log of login activity</p>
          </div>
        </div>
      </div>
    </div>
  )
}
