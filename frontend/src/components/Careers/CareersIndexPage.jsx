import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../utils/api'
import Icon from '../common/Icon'
import './CareersIndexPage.css'

export default function CareersIndexPage() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/careers/')
      .then(res => {
        setOrgs(res.data.organizations)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const filtered = orgs.filter(o => o.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="ci-page">
      {/* 1. Hero Section */}
      <section className="ci-hero">
        <div className="ci-hero-bg" />
        <div className="ci-hero-content">
          <div className="ci-hero-badge">
            <Icon name="sparkles" size={14} /> AI Talent Lab Platform
          </div>
          <h1 className="ci-hero-title">Discover the teams building the future</h1>
          <p className="ci-hero-desc">
            Find your next great opportunity with the world's most innovative organizations, powered by conversational AI hiring.
          </p>

          <div className="ci-search-container">
            <div className="ci-search-icon">
              <Icon name="search" size={20} />
            </div>
            <input
              type="text"
              placeholder="Search organizations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ci-search-input"
            />
          </div>
        </div>
      </section>

      {/* 2. Grid Section */}
      <section className="ci-content">
        <div className="ci-section-title">
          <span>Explore Organizations</span>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        {loading ? (
          <div className="ci-grid">
            <div className="skeleton-line h-48 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}></div>
            <div className="skeleton-line h-48 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}></div>
            <div className="skeleton-line h-48 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}></div>
            <div className="skeleton-line h-48 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}></div>
            <div className="skeleton-line h-48 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}></div>
            <div className="skeleton-line h-48 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}></div>
          </div>
        ) : (
          <div className="ci-grid">
            {filtered.map(org => {
              const brandColor = org.career_primary_color || '#38bdf8';
              
              return (
                <Link 
                  key={org.slug} 
                  to={`/careers/${org.slug}`}
                  className="ci-card"
                  style={{ 
                    '--card-color': brandColor,
                    '--card-color-glow': `${brandColor}40` // Adds 25% opacity to hex color for glow
                  }}
                >
                  <div className="ci-card-header">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name} className="ci-card-logo" />
                    ) : (
                      <div className="ci-card-logo" style={{ color: brandColor }}>
                        {org.name.charAt(0)}
                      </div>
                    )}
                    <div className="ci-card-title-group">
                      <h3 className="ci-card-title">{org.name}</h3>
                      <div className="ci-card-meta">
                        <Icon name="globe" size={12} />
                        View career page
                      </div>
                    </div>
                  </div>
                  
                  <p className="ci-card-desc">
                    {org.about_us 
                      ? (org.about_us.length > 120 ? org.about_us.substring(0, 120) + '...' : org.about_us)
                      : 'Join our team to help build the future of our industry.'}
                  </p>

                  <div className="ci-card-footer">
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                      Hiring now
                    </span>
                    <span className="ci-card-cta">
                      View roles <Icon name="arrow-right" size={14} />
                    </span>
                  </div>
                </Link>
              )
            })}
            
            {filtered.length === 0 && !loading && (
              <div className="ci-empty">
                <div className="ci-empty-icon">
                  <Icon name="search" size={40} />
                </div>
                <div className="ci-empty-text">No companies found matching "{search}".</div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Footer */}
      <footer className="ci-footer">
        <div className="ci-footer-logo">
          <Icon name="briefcase" size={16} />
          AI Talent Lab
        </div>
        <div>Reimagining the way teams hire.</div>
      </footer>
    </div>
  )
}
