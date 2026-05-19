import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, defaultRouteForRole } from '../../context/AuthContext'
import AuthShell from './AuthShell'
import {
  EyeIcon, EyeOffIcon, AlertIcon, SpinnerIcon, ArrowRightIcon,
} from './authIcons'

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 50)
}

function PasswordInput({ id, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div className="password-field">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
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
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const slug = useMemo(() => slugify(form.org_name), [form.org_name])

  const update = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const data = await register(form)
      navigate(defaultRouteForRole(data?.user?.role), { replace: true })
    } catch (err) {
      setError(err?.message || 'Couldn\'t create your workspace. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const submitDisabled = (
    loading ||
    !form.org_name || !form.segment || !form.name ||
    !form.email || !form.password || !confirmPassword
  )

  return (
    <AuthShell mode="register">
      <nav className="auth-toggle" aria-label="Authentication mode">
        <Link to="/login">Sign in</Link>
        <Link to="/register" data-active="true">Create workspace</Link>
      </nav>

      <header className="auth-form-header">
        <h2>Create your workspace</h2>
        <p>14 days free · no credit card · invite teammates anytime.</p>
      </header>

      {error && (
        <div className="auth-error" role="alert">
          <AlertIcon /> <span>{error}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="reg-org">Organization name</label>
          <input
            id="reg-org"
            type="text"
            placeholder="Acme Corp"
            value={form.org_name}
            onChange={update('org_name')}
            required
            autoFocus
          />
          {slug && (
            <span className="slug-preview">aitalentlab.com/{slug}</span>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="reg-segment">Industry</label>
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
            <label htmlFor="reg-size">Company size</label>
            <select id="reg-size" value={form.size} onChange={update('size')}>
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

        <div className="auth-form-rule" />

        <div className="form-group">
          <label htmlFor="reg-name">Your name</label>
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
          <label htmlFor="reg-email">Work email</label>
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

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <PasswordInput
              id="reg-password"
              placeholder="Create a strong password"
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
            />
            <span className="password-hint">
              8+ chars · 1 uppercase · 1 number · 1 symbol
            </span>
          </div>
          <div className="form-group">
            <label htmlFor="reg-confirm">Confirm password</label>
            <PasswordInput
              id="reg-confirm"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={submitDisabled}>
          {loading ? (
            <><SpinnerIcon /> Creating workspace…</>
          ) : (
            <>Create workspace <ArrowRightIcon /></>
          )}
        </button>
      </form>

      <p className="auth-footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  )
}
