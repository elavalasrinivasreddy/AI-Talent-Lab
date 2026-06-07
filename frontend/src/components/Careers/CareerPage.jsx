import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../../utils/api'
import Icon from '../common/Icon'
import Toast from '../common/Toast'
import './CareerPage.css'

export default function CareerPage() {
  const { orgSlug, positionId } = useParams()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fit Finder state
  const [fitFilters, setFitFilters] = useState({
    function: '',
    exp: '',
    values: []
  })
  const [positions, setPositions] = useState([])
  const [loadingFit, setLoadingFit] = useState(false)

  // Single position state
  const [activePosition, setActivePosition] = useState(null)
  const [loadingPosition, setLoadingPosition] = useState(false)
  const [applying, setApplying] = useState(false)
  
  // Apply Modal state
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyForm, setApplyForm] = useState({ name: '', email: '' })
  
  // Toast state
  const [toast, setToast] = useState(null)

  // Testimonials mock data
  const testimonials = [
    {
      quote: "The ownership I have here is unmatched. If you see a problem, you have the agency to solve it.",
      author: "Sarah Chen",
      role: "Lead Engineer",
      avatar: "SC"
    },
    {
      quote: "We don't just talk about work-life balance, we enforce it. It's refreshing.",
      author: "Marcus Webb",
      role: "Product Designer",
      avatar: "MW"
    }
  ]

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

  // Refetch when filters change
  useEffect(() => {
    if (org) {
      fetchFitMatches()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitFilters])

  const fetchOrgAndFit = async () => {
    try {
      setLoading(true)
      // We can use the regular endpoint just to get org data
      const res = await api.get(`/careers/${orgSlug}`)
      setOrg(res.data.org)
      
      // Then fetch the fit matches
      await fetchFitMatches(res.data.org.slug || orgSlug)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error?.message || 'Failed to load career page')
    } finally {
      setLoading(false)
    }
  }

  const fetchFitMatches = async (slug = orgSlug) => {
    try {
      setLoadingFit(true)
      const params = new URLSearchParams()
      if (fitFilters.function) params.append('function', fitFilters.function)
      if (fitFilters.exp) params.append('exp', fitFilters.exp)
      if (fitFilters.values.length > 0) params.append('values', fitFilters.values.join(','))
      
      const res = await api.get(`/careers/${slug}/fit?${params.toString()}`)
      setPositions(res.data.positions)
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

  const handleApplyClick = () => {
    setShowApplyModal(true)
  }

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
      if (isSelected) {
        return { ...prev, values: prev.values.filter(v => v !== val) }
      } else {
        return { ...prev, values: [...prev.values, val] }
      }
    })
  }

  if (loading) {
    return (
      <div className="cp-state-page">
        <div className="cp-spinner" />
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
  
  return (
    <div className="cp-container">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      
      <div style={{ position: 'absolute', top: 24, left: 24, zIndex: 10 }}>
        <Link 
          to="/careers" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            color: 'rgba(255,255,255,0.8)', 
            textDecoration: 'none', 
            fontSize: 14,
            background: 'rgba(0,0,0,0.3)',
            padding: '8px 12px',
            borderRadius: 8,
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Icon name="arrow-left" size={16} />
          Explore Companies
        </Link>
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

      {/* 2. STATS STRIP */}
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
            <div className="cp-stat-val">Remote</div>
            <div className="cp-stat-label">Work Style</div>
          </div>
          <div className="cp-stat-item">
            <div className="cp-stat-val" style={{ color: brandColor }}>{positions.length}</div>
            <div className="cp-stat-label">Open Roles</div>
          </div>
        </div>
      )}

      {/* 3. POSITION DETAIL OR FIT FINDER SECTION */}
      {positionId ? (
        <div className="cp-position-detail">
          {loadingPosition ? (
            <div className="cp-spinner" style={{ margin: '40px auto' }} />
          ) : activePosition ? (
            <>
              <div className="cp-position-header">
                <h2>{activePosition.role_name}</h2>
                <div className="cp-job-meta">
                  <span>{activePosition.department || 'General'}</span>
                  <span>•</span>
                  <span>{activePosition.location}</span>
                  <span>•</span>
                  <span>{activePosition.work_type}</span>
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
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                  >
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
            {/* Q1: Function */}
            <div className="cp-fit-q">
              <label>What do you do?</label>
              <div className="cp-chips">
                {['Engineering', 'Design', 'Product', 'Sales', 'All'].map(f => (
                  <button 
                    key={f}
                    className={`cp-chip ${fitFilters.function === f ? 'active' : ''}`}
                    style={fitFilters.function === f ? { background: `${brandColor}30`, borderColor: brandColor, color: brandColor } : {}}
                    onClick={() => setFitFilters(p => ({ ...p, function: f === 'All' ? '' : f }))}
                  >
                    {f}
                  </button>
                ))}
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

      {/* 4. MATCHING ROLES */}
      <div className="cp-roles-section">
        <h3 className="cp-roles-title">
          {positionId ? 'Other Open Roles' : (loadingFit ? 'Finding matches...' : `Open Roles (${positions.length})`)}
        </h3>
        
        <div className="cp-roles-grid">
          {positions.map(pos => (
            <Link to={`/careers/${orgSlug}/positions/${pos.id}`} key={pos.id} className="cp-job-card" style={{ '--hover-color': brandColor }}>
              <div className="cp-job-header">
                <div className="cp-job-main">
                  <h4>{pos.role_name}</h4>
                  <div className="cp-job-meta">
                    <span>{pos.department || 'General'}</span>
                    <span>•</span>
                    <span>{pos.location}</span>
                    <span>•</span>
                    <span>{pos.work_type}</span>
                  </div>
                </div>
                
                {pos.fit_score > 0 && (
                  <div className="cp-job-match" style={{ color: brandColor, backgroundColor: `${brandColor}20` }}>
                    {pos.fit_score}% Match
                  </div>
                )}
              </div>
              
              <div className="cp-job-pitch">
                <p>"{pos.jd_pitch || 'Join our team and help us build the future of our industry. We are looking for passionate individuals.'}"</p>
              </div>
              
              <div className="cp-job-footer">
                <div className="cp-job-why">
                  <strong>Why this team:</strong> {pos.team_pitch || 'Fast moving, high impact.'}
                </div>
                <div className="cp-job-cta" style={{ backgroundColor: brandColor, color: '#fff' }}>
                  Apply via chat <Icon name="arrow-right" size={14} />
                </div>
              </div>
            </Link>
          ))}
          
          {!loadingFit && positions.length === 0 && (
            <div className="cp-no-roles">
              <Icon name="search" size={32} />
              <p>No open roles match these criteria right now.</p>
              <button onClick={() => setFitFilters({ function: '', exp: '', values: [] })}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. TESTIMONIALS */}
      <div className="cp-testimonials-section">
        <h3>Life at {org.name}</h3>
        <div className="cp-testimonials-grid">
          {testimonials.map((t, idx) => (
            <div key={idx} className="cp-testimonial-card">
              <p className="cp-testimonial-quote">"{t.quote}"</p>
              <div className="cp-testimonial-author">
                <div className="cp-testimonial-avatar">{t.avatar}</div>
                <div>
                  <div className="cp-testimonial-name">{t.author}</div>
                  <div className="cp-testimonial-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="cp-footer">
        <div>Powered by AI Talent Lab</div>
        <Link to="/">Platform</Link>
      </footer>

      {showApplyModal && (
        <div className="modal show" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ width: '100%', maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Apply for {activePosition?.role_name}</h3>
              <button onClick={() => setShowApplyModal(false)}>
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={submitApplication}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={applyForm.name}
                    onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                    placeholder="Jane Doe"
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Email Address</label>
                  <input
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
