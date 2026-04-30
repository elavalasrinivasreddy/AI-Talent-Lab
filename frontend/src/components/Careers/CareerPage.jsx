/**
 * CareerPage.jsx – Public org career page and job board
 * Routes: /careers/:orgSlug, /careers/:orgSlug/:positionId
 * No auth — fully public, mobile-first, SEO-optimized
 * Per docs/pages/09_career_page.md
 */
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import './CareerPage.css'

const API = '/api/v1/careers'

export default function CareerPage() {
  const { orgSlug, positionId } = useParams()

  if (positionId) {
    return <PositionDetailView orgSlug={orgSlug} positionId={positionId} />
  }
  return <CareerPageView orgSlug={orgSlug} />
}

// ── Career Page (job list) ────────────────────────────────────────────────────

function CareerPageView({ orgSlug }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterWorkType, setFilterWorkType] = useState('')

  const load = async (s = '', dept = '', wt = '') => {
    try {
      const qs = new URLSearchParams()
      if (s) qs.set('q', s)
      if (dept) qs.set('department', dept)
      if (wt) qs.set('work_type', wt)
      const res = await fetch(`${API}/${orgSlug}?${qs}`)
      if (!res.ok) throw new Error('Not found')
      const d = await res.json()
      setData(d)
      // SEO
      document.title = `Careers at ${d.org?.name || orgSlug}`
    } catch (e) {
      setError('Organization not found.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [orgSlug])

  if (loading) return <CareerLoading />
  if (error) return <CareerNotFound slug={orgSlug} />

  const { org, positions = [] } = data

  // Group by department
  const byDept = {}
  for (const p of positions) {
    const dept = p.department || 'General'
    if (!byDept[dept]) byDept[dept] = []
    byDept[dept].push(p)
  }

  const departments = [...new Set(positions.map(p => p.department).filter(Boolean))]

  const handleSearch = (val) => {
    setSearch(val)
    load(val, filterDept, filterWorkType)
  }

  return (
    <div className="cp-page">
      <SetMeta
        title={`Careers at ${org.name}`}
        description={org.about_us?.slice(0, 160) || `Open positions at ${org.name}`}
      />

      {/* Org Header */}
      <header className="cp-org-header">
        <div className="cp-org-logo-wrap">
          {org.logo_url
            ? <img src={org.logo_url} alt={org.name} className="cp-org-logo" />
            : <div className="cp-org-logo-placeholder">{org.name?.[0]?.toUpperCase()}</div>
          }
        </div>
        <div className="cp-org-info">
          <h1 className="cp-org-name">{org.name}</h1>
          <div className="cp-org-meta">
            {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer">🌐 {org.website.replace(/^https?:\/\//, '')}</a>}
            {org.headquarters && <span>📍 {org.headquarters}</span>}
            {org.size && <span>👥 {org.size}</span>}
          </div>
        </div>
      </header>

      {/* About */}
      {org.about_us && (
        <section className="cp-about">
          <h2>About {org.name}</h2>
          <p>{org.about_us}</p>
          {org.culture_keywords && (
            <div className="cp-culture-tags">
              <span>🎯 Culture:</span>
              {org.culture_keywords.split(',').map(k => (
                <span key={k} className="cp-culture-tag">{k.trim()}</span>
              ))}
            </div>
          )}
          {org.benefits_text && (
            <div className="cp-benefits">
              <span>🎁 Benefits:</span>
              <span>{org.benefits_text}</span>
            </div>
          )}
        </section>
      )}

      {/* Open Positions */}
      <section className="cp-positions-section">
        <h2 className="cp-positions-title">
          Open Positions {positions.length > 0 && <span className="cp-count-badge">{positions.length}</span>}
        </h2>

        {/* Filters */}
        <div className="cp-filters">
          <div className="cp-search-wrap">
            <span>🔍</span>
            <input
              type="search"
              className="cp-search-input"
              placeholder="Search roles…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          <select className="cp-filter-select" value={filterDept} onChange={e => { setFilterDept(e.target.value); load(search, e.target.value, filterWorkType) }}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="cp-filter-select" value={filterWorkType} onChange={e => { setFilterWorkType(e.target.value); load(search, filterDept, e.target.value) }}>
            <option value="">All Types</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>

        {positions.length === 0 ? (
          <div className="cp-no-positions">
            <span>📋</span>
            <p>No open positions at this time. Check back soon!</p>
          </div>
        ) : (
          Object.entries(byDept).map(([dept, deptPositions]) => (
            <div key={dept} className="cp-dept-group">
              <h3 className="cp-dept-name">── {dept} ({deptPositions.length}) ──</h3>
              {deptPositions.map(pos => (
                <PositionCard
                  key={pos.id}
                  position={pos}
                  onClick={() => navigate(`/careers/${orgSlug}/${pos.id}`)}
                />
              ))}
            </div>
          ))
        )}
      </section>

      <footer className="cp-footer">
        <span>Powered by AI Talent Lab</span>
        <span>·</span>
        <a href="/privacy">Privacy Policy</a>
      </footer>
    </div>
  )
}

function PositionCard({ position: p, onClick }) {
  const skills = Array.isArray(p.key_skills) ? p.key_skills : []
  const daysAgo = Math.floor((Date.now() - new Date(p.created_at)) / (1000 * 60 * 60 * 24))

  return (
    <div className="cp-position-card" onClick={onClick}>
      <div className="cp-pos-info">
        <div className="cp-pos-role">{p.role_name}</div>
        <div className="cp-pos-meta">
          {p.location && <span>📍 {p.location}/{p.work_type || 'Onsite'}</span>}
          {p.experience_min && <span>· {p.experience_min}–{p.experience_max || '∞'} years</span>}
          {p.employment_type && <span>· {p.employment_type.replace('_', '-')}</span>}
        </div>
        {skills.length > 0 && (
          <div className="cp-pos-skills">
            {skills.slice(0, 5).map(s => <span key={s} className="cp-skill-tag">{s}</span>)}
          </div>
        )}
      </div>
      <div className="cp-pos-right">
        <span className="cp-pos-age">Posted {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}</span>
        <button className="cp-apply-chip">View & Apply →</button>
      </div>
    </div>
  )
}

// ── Position Detail View ───────────────────────────────────────────────────────

function PositionDetailView({ orgSlug, positionId }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/${orgSlug}/positions/${positionId}`)
        if (!res.ok) throw new Error('Not found')
        const d = await res.json()
        setData(d)
        document.title = `${d.position?.role_name} at ${d.org?.name} — Apply Now`
      } catch (e) {
        setError('Position not found or no longer available.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [orgSlug, positionId])

  const handleApply = async () => {
    setApplying(true)
    try {
      const res = await fetch(`${API}/${orgSlug}/positions/${positionId}/apply`, { method: 'POST' })
      const d = await res.json()
      navigate(`/apply/${d.apply_token}`)
    } catch (e) {
      alert('Failed to start application. Please try again.')
      setApplying(false)
    }
  }

  if (loading) return <CareerLoading />
  if (error) return <CareerNotFound slug={orgSlug} msg={error} />

  const { org, position: pos } = data
  const daysAgo = Math.floor((Date.now() - new Date(pos.created_at)) / (1000 * 60 * 60 * 24))
  const skills = Array.isArray(pos.key_skills) ? pos.key_skills : []

  return (
    <div className="cp-page">
      <SetMeta
        title={`${pos.role_name} at ${org.name} — Apply Now`}
        description={(pos.jd_markdown || '').replace(/[#*`]/g, '').slice(0, 160)}
        ogTitle={`${pos.role_name} at ${org.name}`}
        ogDescription={`${pos.experience_min}–${pos.experience_max || '∞'} years · ${pos.location} · ${pos.work_type}`}
      />

      <Link to={`/careers/${orgSlug}`} className="cp-back-link">
        ← Back to all positions at {org.name}
      </Link>

      {/* Position Header */}
      <div className="cp-pos-detail-header">
        <div>
          <h1 className="cp-pos-detail-title">{pos.role_name}</h1>
          <div className="cp-pos-detail-meta">
            <span>{org.name}</span>
            {pos.location && <span>· 📍 {pos.location}</span>}
            {pos.work_type && <span>· {pos.work_type}</span>}
            {pos.employment_type && <span>· {pos.employment_type.replace('_', '-')}</span>}
            <span>· {pos.experience_min}–{pos.experience_max || '∞'} years</span>
            <span>· Posted {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}</span>
          </div>
          {skills.length > 0 && (
            <div className="cp-pos-skills" style={{ marginTop: 12 }}>
              {skills.map(s => <span key={s} className="cp-skill-tag">{s}</span>)}
            </div>
          )}
        </div>
        <button className="cp-apply-btn-hero" onClick={handleApply} disabled={applying}>
          {applying ? 'Starting…' : 'Apply Now ▶'}
        </button>
      </div>

      {/* JD */}
      {pos.jd_markdown ? (
        <div className="cp-jd-section">
          <div className="cp-jd-content">
            <pre className="cp-jd-text">{pos.jd_markdown}</pre>
          </div>
          {org.about_us && (
            <div className="cp-about-company">
              <h3>About {org.name}</h3>
              <p>{org.about_us}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="cp-no-jd">Job description not available.</div>
      )}

      {/* Apply Section */}
      <div className="cp-apply-section">
        <h3>Interested in this role?</h3>
        <p>Clicking will start a short chat to collect your basic details (3–4 minutes).</p>
        <button className="cp-apply-btn" onClick={handleApply} disabled={applying}>
          {applying ? '⏳ Starting application…' : `Apply for ${pos.role_name} →`}
        </button>
      </div>

      <footer className="cp-footer">
        <span>Powered by AI Talent Lab</span>
      </footer>
    </div>
  )
}

function SetMeta({ title, description }) {
  useEffect(() => {
    document.title = title
    let desc = document.querySelector('meta[name="description"]')
    if (!desc) {
      desc = document.createElement('meta')
      desc.name = 'description'
      document.head.appendChild(desc)
    }
    desc.content = description || ''
    return () => { document.title = 'AI Talent Lab' }
  }, [title, description])
  return null
}

function CareerLoading() {
  return (
    <div className="cp-state-page">
      <div className="cp-spinner" />
    </div>
  )
}

function CareerNotFound({ slug, msg }) {
  return (
    <div className="cp-state-page">
      <div style={{ fontSize: '3rem' }}>🏢</div>
      <h2>{msg || `No organization found for "${slug}"`}</h2>
      <p>The career page you're looking for doesn't exist or the position is no longer available.</p>
    </div>
  )
}
