/**
 * Settings/SettingsLivePreview.jsx — v3 right-rail live preview pane
 * Per docs/design/pages/07_settings.md §5.
 * Shows contextual preview cards that change based on the active section.
 */
import React from 'react'
import Icon from '../common/Icon'
import Chip from '../common/Chip'

const PREVIEW_CARDS = {
  'ats-rules': [
    { title: 'Under current settings', icon: 'bar-chart', body: 'ATS threshold and weights define how AI scores each candidate. Adjust the threshold to control how many candidates advance past screening.' },
    { title: 'Why the equation matters', icon: 'cpu', body: 'emb × 0.40 + skills × 0.40 + exp × 0.20 × 100 = final score. Higher threshold = fewer but higher-quality candidates advance.' },
  ],
  'sourcing': [
    { title: 'Sourcing schedule', icon: 'search', body: 'Controls how frequently the AI searches for new candidates and how many are sourced per run.' },
    { title: 'Next scheduled run', icon: 'clock', body: 'Sourcing runs are managed by Celery workers. Configure the interval and daily caps here.' },
  ],
  'screening': [
    { title: 'Apply chat preview', icon: 'message-circle', body: 'These questions are asked during the candidate magic link application. Candidates see them in the order configured.' },
  ],
  'scorecards': [
    { title: 'Scorecard rubric', icon: 'layers', body: 'Defines the dimensions panel members use to evaluate candidates. AI auto-generates position-specific scorecards from the JD — these are fallback defaults.' },
  ],
  'organization': [
    { title: 'Impact on JD generation', icon: 'file-text', body: 'About Us, Culture Keywords, and Benefits Template are inserted into every AI-generated JD. Keep them updated before creating new positions.' },
  ],
  'team': [
    { title: 'Team directory', icon: 'users', body: 'Invite team members, assign roles, and manage department access. Deactivated users retain data integrity.' },
  ],
  'templates': [
    { title: 'Available variables', icon: 'code', body: '{{candidate_name}}, {{role_name}}, {{org_name}}, {{magic_link}}, {{interview_date}}, {{interview_time}}, {{round_name}}' },
  ],
  'competitors': [
    { title: 'Market research', icon: 'trending-up', body: 'Competitor companies are used in JD generation — the AI analyzes their offerings for market positioning. Top 3 are selected per search.' },
  ],
  'privacy': [
    { title: 'GDPR compliance', icon: 'shield', body: 'Data retention policies control how long candidate data is stored. Auto-cleanup tasks purge expired records.' },
  ],
}

export default function SettingsLivePreview({ activeSection, previewData }) {
  if (activeSection === 'career-brand' && previewData) {
    const { career_primary_color, career_banner_url, career_tagline, name } = previewData
    const brandColor = career_primary_color || 'var(--color-primary)'
    
    return (
      <div className="st-preview" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="st-preview-header" style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
          <Icon name="eye" size={14} />
          <span>Live Career Page Preview</span>
        </div>
        
        {/* Mini Career Page View */}
        <div style={{ background: 'var(--color-bg-base)', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Hero */}
          <div 
            style={{ 
              height: 140,
              padding: 16,
              background: career_banner_url 
                ? `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.8)), url(${career_banner_url})` 
                : `linear-gradient(135deg, ${brandColor}dd, ${brandColor})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              color: 'white'
            }}
          >
            <h3 style={{ margin: 0, fontSize: 20, color: 'white', fontWeight: 700 }}>{name || 'Company Name'}</h3>
            {career_tagline && <p style={{ margin: '4px 0 0 0', fontSize: 13, opacity: 0.9, lineHeight: 1.3 }}>{career_tagline}</p>}
          </div>
          
          <div style={{ padding: 16, flex: 1 }}>
            {/* Fake text block */}
            <div style={{ width: '30%', height: 14, background: 'var(--color-bg-elevated)', borderRadius: 4, marginBottom: 12 }} />
            <div style={{ width: '100%', height: 8, background: 'var(--color-border)', borderRadius: 4, marginBottom: 6 }} />
            <div style={{ width: '90%', height: 8, background: 'var(--color-border)', borderRadius: 4, marginBottom: 6 }} />
            <div style={{ width: '60%', height: 8, background: 'var(--color-border)', borderRadius: 4, marginBottom: 20 }} />
            
            <div style={{ width: '40%', height: 14, background: 'var(--color-bg-elevated)', borderRadius: 4, marginBottom: 12 }} />
            
            {/* Fake Job Card 1 */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, marginBottom: 12, background: 'var(--color-bg-surface)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Senior Engineer</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Engineering · Remote</div>
              <div style={{ 
                background: brandColor, 
                color: 'white', 
                fontSize: 10, 
                fontWeight: 500,
                padding: '4px 10px', 
                borderRadius: 4,
                display: 'inline-block' 
              }}>
                Apply via chat →
              </div>
            </div>
            
            {/* Fake Job Card 2 */}
             <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, background: 'var(--color-bg-surface)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Product Designer</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Design · Hybrid</div>
              <div style={{ 
                background: brandColor, 
                color: 'white', 
                fontSize: 10,
                fontWeight: 500, 
                padding: '4px 10px', 
                borderRadius: 4,
                display: 'inline-block' 
              }}>
                Apply via chat →
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const cards = PREVIEW_CARDS[activeSection] || []

  return (
    <div className="st-preview">
      <div className="st-preview-header">
        <Icon name="eye" size={14} />
        <span>Live Preview</span>
      </div>

      {cards.length === 0 ? (
        <div className="st-preview-empty">
          <Icon name="layers" size={24} style={{ opacity: 0.2 }} />
          <span>Select a section to see contextual preview</span>
        </div>
      ) : (
        <div className="st-preview-cards">
          {cards.map((card, i) => (
            <div key={i} className="st-preview-card">
              <div className="st-preview-card-title">
                <Icon name={card.icon} size={13} />
                <span>{card.title}</span>
              </div>
              <p className="st-preview-card-body">{card.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="st-preview-tip">
        <Chip variant="primary" size="xs">
          <Icon name="cpu" size={10} /> AI Behavior Console
        </Chip>
        <span className="st-preview-tip-text">
          Changes here control how AI agents act on your behalf.
        </span>
      </div>
    </div>
  )
}
