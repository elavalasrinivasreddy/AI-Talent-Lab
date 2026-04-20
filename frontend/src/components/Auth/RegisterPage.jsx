import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../styles/auth.css'

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().slice(0, 50)
}

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    org_name: '',
    segment: '',
    size: 'startup',
    website: '',
    name: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const slug = useMemo(() => slugify(form.org_name), [form.org_name])

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await register(form)
      navigate('/chat', { replace: true })
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card" style={{ maxWidth: '520px' }}>
        <div className="auth-logo">
          <h1>AI <span>Talent</span> Lab</h1>
          <p>Create your workspace</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Organization */}
          <div className="form-group">
            <label htmlFor="reg-org">Organization Name</label>
            <input
              id="reg-org"
              type="text"
              placeholder="Acme Corp"
              value={form.org_name}
              onChange={update('org_name')}
              required
              autoFocus
            />
            {slug && <span className="slug-preview">yourcompany.aitalentlab.com/{slug}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reg-segment">Industry Segment</label>
              <input
                id="reg-segment"
                type="text"
                placeholder="e.g. SaaS, Fintech"
                value={form.segment}
                onChange={update('segment')}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-size">Company Size</label>
              <select
                id="reg-size"
                value={form.size}
                onChange={update('size')}
              >
                <option value="startup">Startup (1–50)</option>
                <option value="smb">SMB (51–500)</option>
                <option value="enterprise">Enterprise (500+)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-website">Website (optional)</label>
            <input
              id="reg-website"
              type="url"
              placeholder="https://yourcompany.com"
              value={form.website}
              onChange={update('website')}
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: 'var(--space-2) 0' }} />

          {/* User */}
          <div className="form-group">
            <label htmlFor="reg-name">Your Name</label>
            <input
              id="reg-name"
              type="text"
              placeholder="Jane Doe"
              value={form.name}
              onChange={update('name')}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Work Email</label>
            <input
              id="reg-email"
              type="email"
              placeholder="jane@acme.com"
              value={form.email}
              onChange={update('email')}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              placeholder="Create a strong password"
              value={form.password}
              onChange={update('password')}
              required
              autoComplete="new-password"
            />
            <span className="password-hint">
              Min 8 chars, 1 uppercase, 1 number, 1 special character
            </span>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !form.org_name || !form.name || !form.email || !form.password || !form.segment}
          >
            {loading ? 'Creating workspace...' : 'Create Workspace'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
