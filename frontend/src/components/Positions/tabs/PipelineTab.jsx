/**
 * PipelineTab.jsx – Tab-based grid layout for candidate pipeline
 * Redesigned from horizontal Kanban to tabbed grid per user feedback.
 * Default: Sourced tab active. 4 columns desktop, 3 tablet, 2 small, 1 mobile.
 * Includes search, sort, pagination, quick actions, and toggle to Kanban view.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi, candidatesApi } from '../../../utils/api'
import { PIPELINE_STAGES, getScoreStyle } from '../../../utils/constants'
import './PipelineTab.css'

const VISIBLE_STAGES = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected', 'rejected']
const SORT_OPTIONS = [
  { value: 'score_desc', label: 'Score: High → Low' },
  { value: 'score_asc', label: 'Score: Low → High' },
  { value: 'name_asc', label: 'Name: A → Z' },
  { value: 'name_desc', label: 'Name: Z → A' },
  { value: 'date_desc', label: 'Newest First' },
  { value: 'date_asc', label: 'Oldest First' },
  { value: 'exp_desc', label: 'Experience: High → Low' },
]
const CARDS_PER_PAGE = 12

export default function PipelineTab({ positionId }) {
  const [kanban, setKanban] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeStage, setActiveStage] = useState('sourced')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('score_desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'kanban'
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const data = await dashboardApi.getPipeline(positionId)
      setKanban(data)
    } catch (e) {
      console.error('Pipeline load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [positionId])

  useEffect(() => { load() }, [load])

  // Reset page when switching stages or searching
  useEffect(() => { setCurrentPage(1) }, [activeStage, searchQuery, sortBy])

  // Filter and sort cards for active stage
  const filteredCards = useMemo(() => {
    if (!kanban) return []
    let cards = [...(kanban[activeStage] || [])]

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      cards = cards.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.current_company || '').toLowerCase().includes(q) ||
        (c.current_title || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      )
    }

    // Sort
    cards.sort((a, b) => {
      switch (sortBy) {
        case 'score_desc': return (b.skill_match_score ?? -1) - (a.skill_match_score ?? -1)
        case 'score_asc': return (a.skill_match_score ?? 999) - (b.skill_match_score ?? 999)
        case 'name_asc': return (a.name || '').localeCompare(b.name || '')
        case 'name_desc': return (b.name || '').localeCompare(a.name || '')
        case 'date_desc': return new Date(b.created_at || 0) - new Date(a.created_at || 0)
        case 'date_asc': return new Date(a.created_at || 0) - new Date(b.created_at || 0)
        case 'exp_desc': return (b.experience_years ?? 0) - (a.experience_years ?? 0)
        default: return 0
      }
    })

    return cards
  }, [kanban, activeStage, searchQuery, sortBy])

  // Pagination
  const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE)
  const paginatedCards = filteredCards.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE)

  const handleMoveCard = async (card, newStatus) => {
    try {
      await candidatesApi.updateStatus(card.id, {
        status: newStatus,
        application_id: card.application_id,
        position_id: positionId,
      })
      load()
    } catch (e) {
      alert(`Move failed: ${e.message}`)
    }
  }

  if (loading) return <PipelineSkeleton />

  if (!kanban || VISIBLE_STAGES.every(s => !kanban[s]?.length)) {
    return (
      <div className="pipeline-empty">
        <div className="pipeline-empty-icon">🔍</div>
        <h3>No candidates yet</h3>
        <p>Click "Run Search Now" to source candidates for this position.</p>
      </div>
    )
  }

  // Count candidates per stage for tab badges
  const stageCounts = {}
  VISIBLE_STAGES.forEach(s => { stageCounts[s] = (kanban[s] || []).length })

  return (
    <div className="pipeline-container">
      {/* View Mode Toggle */}
      <div className="pipeline-toolbar">
        <div className="pipeline-view-toggle">
          <button
            className={`pipeline-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor"/>
              <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor"/>
              <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor"/>
              <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor"/>
            </svg>
            Grid
          </button>
          <button
            className={`pipeline-view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
            onClick={() => setViewMode('kanban')}
            title="Kanban View"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="4" height="14" rx="1" fill="currentColor"/>
              <rect x="6" y="1" width="4" height="10" rx="1" fill="currentColor"/>
              <rect x="11" y="1" width="4" height="12" rx="1" fill="currentColor"/>
            </svg>
            Kanban
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <>
          {/* Stage Tabs */}
          <div className="pipeline-stage-tabs">
            {VISIBLE_STAGES.map(stage => {
              const cfg = PIPELINE_STAGES[stage]
              const count = stageCounts[stage]
              const isActive = activeStage === stage
              return (
                <button
                  key={stage}
                  className={`pipeline-stage-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveStage(stage)}
                  style={isActive ? {
                    '--tab-active-color': cfg.color,
                    '--tab-active-bg': cfg.bg,
                  } : {}}
                >
                  <span className="pipeline-tab-label">{cfg.label}</span>
                  <span
                    className="pipeline-tab-count"
                    style={isActive ? { background: cfg.color, color: '#fff' } : {}}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search + Sort Bar */}
          <div className="pipeline-controls">
            <div className="pipeline-search-wrap">
              <svg className="pipeline-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                className="pipeline-search-input"
                placeholder="Search by name, company, title, or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="pipeline-search-clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>

            <div className="pipeline-sort-wrap">
              <select
                className="pipeline-sort-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <span className="pipeline-result-count">
              {filteredCards.length} candidate{filteredCards.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Grid Cards */}
          {paginatedCards.length === 0 ? (
            <div className="pipeline-stage-empty">
              {searchQuery ? (
                <>
                  <span>🔍</span>
                  <p>No candidates match "{searchQuery}" in {PIPELINE_STAGES[activeStage].label}</p>
                  <button className="pipeline-clear-search" onClick={() => setSearchQuery('')}>Clear search</button>
                </>
              ) : (
                <>
                  <span>{PIPELINE_STAGES[activeStage].emoji || '📋'}</span>
                  <p>No candidates in {PIPELINE_STAGES[activeStage].label} stage</p>
                </>
              )}
            </div>
          ) : (
            <div className="pipeline-grid">
              {paginatedCards.map(card => (
                <PipelineCard
                  key={card.application_id || card.id}
                  card={card}
                  positionId={positionId}
                  activeStage={activeStage}
                  onMove={(newStatus) => handleMoveCard(card, newStatus)}
                  onClick={() => navigate(`/candidates/${card.id}`, {
                    state: { positionId, from: `/positions/${positionId}`, fromLabel: 'Back to Position', fromTab: 'pipeline' }
                  })}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pipeline-pagination">
              <button
                className="pipeline-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                ← Prev
              </button>
              <div className="pipeline-page-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`pipeline-page-num ${page === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                className="pipeline-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── Kanban View (toggle option) ── */
        <div className="kanban-board">
          {VISIBLE_STAGES.map(stage => {
            const cards = kanban[stage] || []
            const stageConfig = PIPELINE_STAGES[stage]
            return (
              <div key={stage} className="kanban-column">
                <div className="kanban-col-header" style={{ borderTopColor: stageConfig.color }}>
                  <span className="kanban-col-label" style={{ color: stageConfig.color }}>
                    {stageConfig.label}
                  </span>
                  <span className="kanban-col-count" style={{ background: stageConfig.bg, color: stageConfig.color }}>
                    {cards.length}
                  </span>
                </div>
                <div className="kanban-cards">
                  {cards.map(card => (
                    <KanbanCard
                      key={card.application_id || card.id}
                      card={card}
                      positionId={positionId}
                      onMove={(newStatus) => handleMoveCard(card, newStatus)}
                      onClick={() => navigate(`/candidates/${card.id}`, {
                        state: { positionId, from: `/positions/${positionId}`, fromLabel: 'Back to Position', fromTab: 'pipeline' }
                      })}
                    />
                  ))}
                  {cards.length === 0 && (
                    <div className="kanban-col-empty"><span>–</span></div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Pipeline Grid Card ── */
function PipelineCard({ card, positionId, activeStage, onMove, onClick }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const score = card.skill_match_score
  const scoreStyle = score != null ? getScoreStyle(score) : null

  const initials = (card.name || '??')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Top skills from the candidate (show max 3)
  const skills = card.key_skills ? card.key_skills.slice(0, 3) : []

  return (
    <div className="pipeline-card" onClick={onClick}>
      {/* Score Badge */}
      {score != null && (
        <div className="pipeline-card-score" style={{ '--score-color': scoreStyle.color }}>
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-border)" strokeWidth="3" />
            <circle
              cx="22" cy="22" r="18"
              fill="none"
              stroke={scoreStyle.color}
              strokeWidth="3"
              strokeDasharray={`${(score / 100) * 113.1} 113.1`}
              strokeLinecap="round"
              transform="rotate(-90 22 22)"
            />
          </svg>
          <span className="pipeline-score-text" style={{ color: scoreStyle.color }}>
            {Math.round(score)}%
          </span>
        </div>
      )}

      {/* Avatar + Name */}
      <div className="pipeline-card-identity">
        <div className="pipeline-card-avatar">{initials}</div>
        <div className="pipeline-card-name">{card.name || 'Unknown'}</div>
        {card.current_title && (
          <div className="pipeline-card-title">{card.current_title}</div>
        )}
      </div>

      {/* Meta Row */}
      <div className="pipeline-card-meta">
        {card.current_company && (
          <span className="pipeline-meta-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 7v14M9 7v14M15 7v14M21 7v14M1 7h22M5 3h14l2 4H3z"/></svg>
            {card.current_company}
          </span>
        )}
        {card.experience_years != null && (
          <span className="pipeline-meta-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            {card.experience_years} yrs
          </span>
        )}
        {card.location && (
          <span className="pipeline-meta-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {card.location}
          </span>
        )}
      </div>

      {/* Skill Tags */}
      {skills.length > 0 && (
        <div className="pipeline-card-skills">
          {skills.map((s, i) => (
            <span key={i} className="pipeline-skill-tag">{s}</span>
          ))}
          {(card.key_skills?.length || 0) > 3 && (
            <span className="pipeline-skill-more">+{card.key_skills.length - 3}</span>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="pipeline-card-actions" onClick={e => e.stopPropagation()}>
        <button className="pipeline-action-btn" title="Send Email" onClick={() => {}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </button>
        <button className="pipeline-action-btn" title="Schedule Interview" onClick={() => {}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </button>
        <button
          className="pipeline-action-btn pipeline-more-btn"
          onClick={() => setMenuOpen(p => !p)}
          title="More actions"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>

        {menuOpen && (
          <div className="pipeline-card-menu">
            {VISIBLE_STAGES.filter(s => s !== activeStage).map(s => (
              <button
                key={s}
                className="pipeline-menu-item"
                onClick={() => { onMove(s); setMenuOpen(false) }}
              >
                <span className="pipeline-menu-dot" style={{ background: PIPELINE_STAGES[s].color }} />
                Move to {PIPELINE_STAGES[s].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Kanban Card (compact, for kanban view) ── */
function KanbanCard({ card, positionId, onMove, onClick }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const score = card.skill_match_score
  const scoreStyle = score != null ? getScoreStyle(score) : null

  const initials = (card.name || '??')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="kanban-card" onClick={onClick}>
      <div className="kanban-card-top">
        <div className="kanban-avatar">{initials}</div>
        <div className="kanban-card-info">
          <div className="kanban-candidate-name">{card.name || 'Unknown'}</div>
          {card.current_title && (
            <div className="kanban-candidate-title">{card.current_title}</div>
          )}
        </div>
        {score != null && (
          <div className="kanban-score" style={{ color: scoreStyle.color }}>
            <div className="kanban-score-dot" style={{ background: scoreStyle.color }} />
            {Math.round(score)}%
          </div>
        )}
      </div>

      <div className="kanban-card-meta">
        {card.current_company && (
          <span className="kanban-meta-tag">{card.current_company}</span>
        )}
        {card.experience_years != null && (
          <span className="kanban-meta-tag">{card.experience_years} yrs</span>
        )}
      </div>

      <div className="kanban-card-actions" onClick={e => e.stopPropagation()}>
        <button
          className="kanban-menu-btn"
          onClick={() => setMenuOpen(p => !p)}
        >
          •••
        </button>
        {menuOpen && (
          <div className="kanban-menu">
            {VISIBLE_STAGES.filter(s => s !== card.status).map(s => (
              <button key={s} className="kanban-menu-item" onClick={() => { onMove(s); setMenuOpen(false) }}>
                Move to {PIPELINE_STAGES[s].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Skeleton Loading ── */
function PipelineSkeleton() {
  return (
    <div className="pipeline-container">
      <div className="pipeline-stage-tabs">
        {VISIBLE_STAGES.slice(0, 5).map(s => (
          <div key={s} className="skeleton-block" style={{ height: 40, width: 100, borderRadius: 8 }} />
        ))}
      </div>
      <div className="pipeline-controls">
        <div className="skeleton-block" style={{ height: 40, flex: 1, borderRadius: 8 }} />
        <div className="skeleton-block" style={{ height: 40, width: 160, borderRadius: 8 }} />
      </div>
      <div className="pipeline-grid">
        {[1,2,3,4,5,6,7,8].map(i => (
          <div key={i} className="skeleton-block" style={{ height: 220, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  )
}
