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
          <div className="settings-card">
            <h4>Password Policy</h4>
            <p>Configure minimum requirements</p>
            <span className="int-badge phase2">Coming Soon</span>
          </div>
          <div className="settings-card">
            <h4>Two-Factor Auth (TOTP)</h4>
            <p>Add extra layer of protection</p>
            <span className="int-badge phase2">Phase 2</span>
          </div>
          <div className="settings-card">
            <h4>Session Management</h4>
            <p>View and revoke active sessions</p>
            <span className="int-badge phase2">Phase 2</span>
          </div>
          <div className="settings-card">
            <h4>Login History</h4>
            <p>Audit log of login activity</p>
            <span className="int-badge phase2">Phase 2</span>
          </div>
        </div>
      </div>
    </div>
  )
}
