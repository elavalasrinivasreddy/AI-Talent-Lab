import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../../utils/api'
import { TERMS_URL, PRIVACY_URL } from '../../config/legal'
import Icon from '../common/Icon'
import Toast from '../common/Toast'
import './CareerPage.css'

export default function CareerPage() {
  const { orgSlug, positionId } = useParams()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [fitFilters, setFitFilters] = useState({ function: '', exp: '', values: [] })
  const [positions, setPositions] = useState([])
  // Stores the initial unfiltered list — used to derive departments and work style stat
  const [orgPositions, setOrgPositions] = useState([])
  const [loadingFit, setLoadingFit] = useState(false)

  const [activePosition, setActivePosition] = useState(null)
  const [loadingPosition, setLoadingPosition] = useState(false)
  const [applying, setApplying] = useState(false)

  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyForm, setApplyForm] = useState({ name: '', email: '' })
  const [toast, setToast] = useState(null)

  // Derive function filter chips from actual departments in this org
  const functionChips = useMemo(() => {
    const depts = [...new Set(orgPositions.map(p => p.department).filter(Boolean))]
    return depts.length > 0 ? [...depts, 'All'] : ['Engineering', 'Design', 'Product', 'Sales', 'All']
  }, [orgPositions])

  // Derive the most common work type across open roles (replaces hardcoded "Remote")
  const workType = useMemo(() => {
    const types = orgPositions.map(p => p.work_type).filter(Boolean)
    if (!types.length) return 'Flexible'
    const counts = types.reduce((acc, t) => ({ ...acc, [t]: (acc[t] || 0) + 1 }), {})
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  }, [orgPositions])

  // Exclude the currently viewed position from the "Other Open Roles" list
  const otherPositions = useMemo(
    () => positionId ? positions.filter(p => String(p.id) !== String(positionId)) : positions,
    [positions, positionId]
  )

  useEffect(() => {
    fetchOrgAndFit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug])

  useEffect(() => {
    if (positionId) {
      fetchPositionDetail()
    } else {
      setActivePosition(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionId])

  useEffect(() => {
    if (org) {
      fetchFitMatches()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitFilters])

  const fetchOrgAndFit = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/careers/${orgSlug}`)
      setOrg(res.data.org)
      await fetchFitMatches(res.data.org.slug || orgSlug, true)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error?.message || 'Failed to load career page')
    } finally {
      setLoading(false)
    }
  }

  const fetchFitMatches = async (slug = orgSlug, isInitial = false) => {
    try {
      setLoadingFit(true)
      const params = new URLSearchParams()
      if (fitFilters.function) params.append('function', fitFilters.function)
      if (fitFilters.exp) params.append('exp', fitFilters.exp)
      if (fitFilters.values.length > 0) params.append('values', fitFilters.values.join(','))

      const res = await api.get(`/careers/${slug}/fit?${params.toString()}`)
      setPositions(res.data.positions)
      // On initial load (no filters), capture full list for deriving filter options and stats
      if (isInitial) {
        setOrgPositions(res.data.positions)
      }
    } catch (err) {
      console.error('Fit fetch error:', err)
    } finally {
      setLoadingFit(false)
    }
  }

  const fetchPositionDetail = async () => {
    try {
      setLoadingPosition(true)
      const res = await api.get(`/careers/${orgSlug}/positions/${positionId}`)
      setActivePosition(res.data.position)
      if (!org) setOrg(res.data.org)
    } catch (err) {
      console.error('Position fetch error:', err)
    } finally {
      setLoadingPosition(false)
    }
  }

  const handleApplyClick = () => setShowApplyModal(true)

  const submitApplication = async (e) => {
    e.preventDefault()
    if (!applyForm.name || !applyForm.email) return
    try {
      setApplying(true)
      const res = await api.post(`/careers/${orgSlug}/positions/${positionId}/apply`, {
        name: applyForm.name,
        email: applyForm.email
      })
      if (res.data.apply_url) {
        window.location.href = res.data.apply_url
      }
    } catch (err) {
      console.error('Apply error:', err)
      setToast({
        message: err.response?.data?.error?.message || 'Failed to start application',
        type: 'error'
      })
      setApplying(false)
    }
  }

  const handleValueToggle = (val) => {
    setFitFilters(prev => {
      const isSelected = prev.values.includes(val)
      return isSelected
        ? { ...prev, values: prev.values.filter(v => v !== val) }
        : { ...prev, values: [...prev.values, val] }
    })
  }

  const formatExpRange = (min, max) => {
    if (min != null && max != null) return `${min}–${max} yrs exp`
    if (min != null) return `${min}+ yrs exp`
    if (max != null) return `Up to ${max} yrs`
    return null
  }

  const formatWorkType = (type) => {
    const map = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', on_site: 'On-site', in_office: 'In Office' }
    return map[type?.toLowerCase()] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : null)
  }

  const formatEmploymentType = (type) => {
    const map = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship', temporary: 'Temporary', freelance: 'Freelance' }
    return map[type?.toLowerCase()] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : null)
  }

  const formatRelativeDate = (dateStr) => {
    if (!dateStr) return null
    const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
    if (days === 0) return 'Posted today'
    if (days === 1) return 'Posted yesterday'
    if (days < 30) return `Posted ${days}d ago`
    if (days < 60) return 'Posted 1 month ago'
    return `Posted ${Math.floor(days / 30)} months ago`
  }

  if (loading) {
    return (
      <div className="cp-container" style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <div className="skeleton-line w-full h-64 mb-8"></div>
        <div className="cp-stats-strip" style={{ gap: '16px', padding: '0 24px' }}>
          <div className="skeleton-line w-full h-24"></div>
          <div className="skeleton-line w-full h-24"></div>
          <div className="skeleton-line w-full h-24"></div>
          <div className="skeleton-line w-full h-24"></div>
        </div>
        <div style={{ padding: '40px 24px' }}>
          <div className="skeleton-line w-48 h-8 mb-6"></div>
          <div className="skeleton-line w-full h-32 mb-4"></div>
          <div className="skeleton-line w-full h-32 mb-4"></div>
          <div className="skeleton-line w-full h-32"></div>
        </div>
      </div>
    )
  }

  if (error || !org) {
    return (
      <div className="cp-state-page">
        <Icon name="alert-circle" size={48} style={{ color: 'var(--color-error)' }} />
        <h2>Page not found</h2>
        <p>{error}</p>
      </div>
    )
  }

  const brandColor = org.career_primary_color || 'var(--color-primary)'
  const cultureKeywords = org.culture_keywords
    ? org.culture_keywords.split(',').map(k => k.trim()).filter(Boolean)
    : []
  const hasCultureSection = org.benefits_text || cultureKeywords.length > 0

  return (
    <div className="cp-container">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Top breadcrumb navigation */}
      <div className="cp-breadcrumb-bar">
        <Link to="/careers" className="cp-breadcrumb-btn">
          <Icon name="arrow-left" size={16} />
          Explore Companies
        </Link>
        {positionId && (
          <>
            <span className="cp-breadcrumb-sep">/</span>
            <Link to={`/careers/${orgSlug}`} className="cp-breadcrumb-btn">
              {org.name} Open Roles
            </Link>
          </>
        )}
      </div>

      {/* 1. HERO SECTION */}
      <div
        className="cp-hero"
        style={{
          background: org.career_banner_url
            ? `linear-gradient(to bottom, rgba(15,15,19,0.5), rgba(15,15,19,1)), url(${org.career_banner_url})`
            : `linear-gradient(135deg, ${brandColor}40, rgba(15,15,19,1))`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderColor: `${brandColor}40`
        }}
      >
        <div className="cp-hero-content">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="cp-hero-logo" />
          ) : (
            <div className="cp-hero-logo-placeholder">{org.name.charAt(0)}</div>
          )}
          <h1 className="cp-hero-title">{org.career_tagline || `Join ${org.name}`}</h1>
          {org.about_us && (
            <p className="cp-hero-desc">{org.about_us}</p>
          )}
        </div>
      </div>

      {/* 2. STATS STRIP — hidden on position detail view */}
      {!positionId && (
        <div className="cp-stats-strip">
          <div className="cp-stat-item">
            <div className="cp-stat-val">{org.size || 'Growing'}</div>
            <div className="cp-stat-label">Team Size</div>
          </div>
          <div className="cp-stat-item">
            <div className="cp-stat-val">{org.headquarters || 'Global'}</div>
            <div className="cp-stat-label">Headquarters</div>
          </div>
          <div className="cp-stat-item">
            <div className="cp-stat-val">{workType}</div>
            <div className="cp-stat-label">Work Style</div>
          </div>
          <div className="cp-stat-item">
            <div className="cp-stat-val" style={{ color: brandColor }}>{orgPositions.length}</div>
            <div className="cp-stat-label">Open Roles</div>
          </div>
        </div>
      )}

      {/* 3. POSITION DETAIL OR FIT FINDER */}
      {positionId ? (
        <div className="cp-position-detail">
          {loadingPosition ? (
            <div style={{ padding: '40px 0' }}>
              <div className="skeleton-line w-48 h-8 mb-6"></div>
              <div className="skeleton-line w-full h-32 mb-4"></div>
              <div className="skeleton-line w-full h-32 mb-4"></div>
              <div className="skeleton-line w-full h-32"></div>
            </div>
          ) : activePosition ? (
            <>
              <div className="cp-position-header">
                <h2>{activePosition.role_name}</h2>
                <div className="cp-job-meta">
                  <span>{activePosition.department || 'General'}</span>
                  <span>•</span>
                  <span>{activePosition.location}</span>
                  <span>•</span>
                  <span>{formatWorkType(activePosition.work_type)}</span>
                  {activePosition.employment_type && (
                    <>
                      <span>•</span>
                      <span>{formatEmploymentType(activePosition.employment_type)}</span>
                    </>
                  )}
                  {(activePosition.experience_min != null || activePosition.experience_max != null) && (
                    <>
                      <span>•</span>
                      <span>{formatExpRange(activePosition.experience_min, activePosition.experience_max)}</span>
                    </>
                  )}
                </div>
                <button
                  className="cp-apply-btn-main"
                  style={{ backgroundColor: brandColor }}
                  onClick={handleApplyClick}
                  disabled={applying}
                >
                  {applying ? 'Starting chat...' : 'Apply via chat'} <Icon name="arrow-right" size={16} />
                </button>
              </div>

              <div className="cp-position-content">
                <div className="cp-jd-markdown markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activePosition.jd_markdown}
                  </ReactMarkdown>
                </div>
              </div>
            </>
          ) : (
            <div className="cp-no-roles">
              <p>Position not found or no longer available.</p>
              <Link to={`/careers/${orgSlug}`}>View other open roles</Link>
            </div>
          )}
        </div>
      ) : (
        <div className="cp-fit-section">
          <div className="cp-fit-header">
            <h2>Find your fit</h2>
            <p>Tell us what you're looking for, and we'll match you with the right team.</p>
          </div>

          <div className="cp-fit-questions">
            {/* Q1: Function — free-text search so any role/industry can find their fit */}
            <div className="cp-fit-q">
              <label>What do you do?</label>
              <div className="cp-function-search">
                <input
                  type="text"
                  className="cp-function-input"
                  placeholder="e.g. Marketing, Civil Engineering, Data Entry, Finance…"
                  value={fitFilters.function}
                  onChange={e => setFitFilters(p => ({ ...p, function: e.target.value }))}
                />
                {/* Quick picks: show actual departments that exist in this org */}
                {functionChips.length > 1 && (
                  <div className="cp-chips" style={{ marginTop: 10 }}>
                    <span className="cp-chips-label">Quick pick:</span>
                    {functionChips.map(f => (
                      <button
                        key={f}
                        className={`cp-chip ${fitFilters.function === f ? 'active' : ''}`}
                        style={fitFilters.function === f ? { background: `${brandColor}30`, borderColor: brandColor, color: brandColor } : {}}
                        onClick={() => setFitFilters(p => ({ ...p, function: p.function === f || f === 'All' ? '' : f }))}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Q2: Experience */}
            <div className="cp-fit-q">
              <label>Experience level</label>
              <div className="cp-chips">
                {['0-3 yrs', '3-7 yrs', '7+ yrs'].map(e => (
                  <button
                    key={e}
                    className={`cp-chip ${fitFilters.exp === e ? 'active' : ''}`}
                    style={fitFilters.exp === e ? { background: `${brandColor}30`, borderColor: brandColor, color: brandColor } : {}}
                    onClick={() => setFitFilters(p => ({ ...p, exp: p.exp === e ? '' : e }))}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Q3: Values */}
            <div className="cp-fit-q">
              <label>What matters most?</label>
              <div className="cp-chips">
                {['Ownership', 'Stability', 'Mentorship', 'Impact', 'Fast Pace'].map(v => (
                  <button
                    key={v}
                    className={`cp-chip ${fitFilters.values.includes(v) ? 'active' : ''}`}
                    style={fitFilters.values.includes(v) ? { background: `${brandColor}30`, borderColor: brandColor, color: brandColor } : {}}
                    onClick={() => handleValueToggle(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. ROLES SECTION */}
      <div className="cp-roles-section">
        <h3 className="cp-roles-title">
          {positionId
            ? `Other Open Roles at ${org.name}`
            : (loadingFit ? 'Finding matches...' : `Open Roles (${positions.length})`)}
        </h3>

        {/* When on JD view and no other roles exist, show a focused empty state */}
        {positionId && otherPositions.length === 0 ? (
          <div className="cp-no-roles">
            <Icon name="briefcase" size={32} />
            <p>No other open roles at {org.name} right now.</p>
            <Link to="/careers" style={{ color: brandColor, fontWeight: 500 }}>
              Explore other companies
            </Link>
          </div>
        ) : (
          <div className="cp-roles-grid">
            {otherPositions.map(pos => {
              const expRange = formatExpRange(pos.experience_min, pos.experience_max)
              const empType = formatEmploymentType(pos.employment_type)
              const workTypeFmt = formatWorkType(pos.work_type)
              const postedDate = formatRelativeDate(pos.created_at)
              return (
                <Link
                  to={`/careers/${orgSlug}/positions/${pos.id}`}
                  key={pos.id}
                  className="cp-job-card"
                  style={{ '--hover-color': brandColor }}
                >
                  <div className="cp-job-header">
                    <div className="cp-job-main">
                      <h4>{pos.role_name}</h4>
                      <div className="cp-job-meta">
                        {pos.department && <span>{pos.department}</span>}
                        {pos.department && <span>•</span>}
                        <span>{pos.location}</span>
                        <span>•</span>
                        <span>{workTypeFmt}</span>
                      </div>
                    </div>

                    {pos.fit_score > 0 && (
                      <div className="cp-job-match" style={{ color: brandColor, backgroundColor: `${brandColor}20` }}>
                        {pos.fit_score}% Match
                      </div>
                    )}
                  </div>

                  <div className="cp-job-footer">
                    <div className="cp-job-badges">
                      {empType && <span className="cp-job-badge">{empType}</span>}
                      {expRange && <span className="cp-job-badge">{expRange}</span>}
                      {postedDate && <span className="cp-job-badge cp-job-badge--muted">{postedDate}</span>}
                    </div>
                    <div className="cp-job-cta" style={{ backgroundColor: brandColor, color: '#fff' }}>
                      View role <Icon name="arrow-right" size={14} />
                    </div>
                  </div>
                </Link>
              )
            })}

            {!loadingFit && !positionId && positions.length === 0 && (
              <div className="cp-no-roles">
                <Icon name="search" size={32} />
                <p>No open roles match these criteria right now.</p>
                <button onClick={() => setFitFilters({ function: '', exp: '', values: [] })}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. CULTURE SECTION — only shown when org has real data; never shows placeholder text */}
      {hasCultureSection && (
        <div className="cp-culture-section">
          <h3>Life at {org.name}</h3>
          {org.benefits_text && (
            <p className="cp-culture-text">{org.benefits_text}</p>
          )}
          {cultureKeywords.length > 0 && (
            <div className="cp-culture-chips">
              {cultureKeywords.map(kw => (
                <span
                  key={kw}
                  className="cp-culture-chip"
                  style={{ borderColor: `${brandColor}60`, color: brandColor, backgroundColor: `${brandColor}10` }}
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="cp-footer">
        <div>Powered by AI Talent Lab</div>
        <div>
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Terms</a>
          {' · '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Privacy</a>
          {' · '}
          <Link to="/">Platform</Link>
        </div>
      </footer>

      {showApplyModal && (
        <div className="modal show" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '100%', maxWidth: '400px' }} role="dialog" aria-modal="true" aria-labelledby="apply-modal-title">
            <div className="modal-header">
              <h3 className="modal-title" id="apply-modal-title">Apply for {activePosition?.role_name}</h3>
              <button onClick={() => setShowApplyModal(false)} aria-label="Close">
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={submitApplication}>
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="apply-name" style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Full Name</label>
                  <input
                    id="apply-name"
                    type="text"
                    required
                    value={applyForm.name}
                    onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                    placeholder="Jane Doe"
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="apply-email" style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Email Address</label>
                  <input
                    id="apply-email"
                    type="email"
                    required
                    value={applyForm.email}
                    onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                    placeholder="jane@example.com"
                  />
                </div>
                <div className="modal-footer" style={{ marginTop: '24px', borderTop: 'none', padding: 0 }}>
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(false)}
                    disabled={applying}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={applying}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: brandColor,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {applying ? 'Starting...' : 'Start Application'} <Icon name="arrow-right" size={16} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
