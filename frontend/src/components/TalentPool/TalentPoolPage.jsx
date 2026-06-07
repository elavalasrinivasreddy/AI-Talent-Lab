import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { positionsApi } from '../../utils/api'
import { useAuth } from '../../context/AuthContext'
import './TalentPoolPage.css'

const API = import.meta.env.VITE_API_URL || '/api/v1'

const REASON_COLORS = {
  rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Rejected' },
  position_closed: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Position Closed' },
  position_archived: { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', label: 'Archived' },
  manual: { color: '#0D9488', bg: 'rgba(13,148,136,0.1)', label: 'Manual' },
}

const CONTACT_STATUS_CFG = {
  active: { label: 'Contactable', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  unsubscribed: { label: 'Unsubscribed', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  employed: { label: 'Employed', color: '#0D9488', bg: 'rgba(13,148,136,0.1)' },
}

function authHeader() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function TalentPoolPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [search, setSearch] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterReason, setFilterReason] = useState('')
  const searchTimeout = useRef(null)

  // Modals & Panels
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCopilotPanel, setShowCopilotPanel] = useState(false)

  // Positions (for AI suggest)
  const [positions, setPositions] = useState([])

  const load = useCallback(async (p = 1, s = search, loc = filterLocation, rsn = filterReason) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (s) qs.set('q', s)
      if (loc) qs.set('location', loc)
      if (rsn) qs.set('reason', rsn)
      qs.set('page', p)
      const res = await fetch(`${API}/talent-pool/?${qs}`, { headers: authHeader() })
      const data = await res.json()
      setCandidates(data.candidates || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
      setPage(p)
    } catch (e) {
      console.error('Pool load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [search, filterLocation, filterReason])

  useEffect(() => {
    load()
    positionsApi.list({ status: 'open' }).then(data => {
      setPositions(Array.isArray(data) ? data : data.positions || [])
    }).catch(() => { })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (val) => {
    setSearch(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => load(1, val, filterLocation, filterReason), 400)
  }

  // Filter positions based on user RBAC
  const availablePositions = positions.filter(p => {
    if (user?.role === 'org_head') return true
    if (user?.department_id) return p.department_id === user.department_id
    return true
  })

  const isPoolEmpty = !loading && total === 0 && !search && !filterLocation && !filterReason

  return (
    <div className="tp-page">
      {/* ── Header ── */}
      <div className="tp-header">
        <div>
          <h1 className="tp-title">🗃 Talent Pool</h1>
          <p className="tp-sub">{total > 0 ? `${total.toLocaleString()} candidates · Org-wide` : 'Your reusable candidate database'}</p>
        </div>
        <button className="tp-btn-primary" onClick={() => setShowUploadModal(true)}>
          + Upload Resumes
        </button>
      </div>

      {/* ── Main Content Area ── */}
      {!isPoolEmpty ? (
        <>
          {/* Toolbar */}
          <div className="tp-toolbar">
            <div className="tp-search-wrap">
              <span className="tp-search-icon">🔍</span>
              <input
                type="text"
                className="tp-search-input"
                placeholder="Search by name, title, skills…"
                value={search}
                onChange={e => handleSearch(e.target.value)}
              />
            </div>
            
            <select
              className="tp-filter-select"
              value={filterLocation}
              onChange={e => { setFilterLocation(e.target.value); load(1, search, e.target.value, filterReason) }}
            >
              <option value="">All Locations</option>
              <option value="Bangalore">Bangalore</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Delhi">Delhi</option>
              <option value="Remote">Remote</option>
            </select>
            
            <select
              className="tp-filter-select"
              value={filterReason}
              onChange={e => { setFilterReason(e.target.value); load(1, search, filterLocation, e.target.value) }}
            >
              <option value="">All Reasons</option>
              <option value="rejected">Rejected</option>
              <option value="position_closed">Position Closed</option>
              <option value="position_archived">Position Archived</option>
              <option value="manual">Manual</option>
            </select>

            <div style={{ flex: 1 }} />

            <button 
              className="tp-btn-copilot" 
              onClick={() => setShowCopilotPanel(true)}
            >
              ✨ AI Match to Position
            </button>
          </div>

          {/* Grid */}
          <div className="tp-grid-container">
            {loading ? (
              <PoolSkeleton />
            ) : candidates.length === 0 ? (
              <PoolEmpty hasFilters={true} onClear={() => {
                setSearch('')
                setFilterLocation('')
                setFilterReason('')
                load(1, '', '', '')
              }} />
            ) : (
              <>
                <div className="tp-grid">
                  {candidates.map(c => (
                    <CandidateCard key={c.id} candidate={c} onNavigate={navigate} />
                  ))}
                </div>
                {pages > 1 && (
                  <div className="tp-pagination">
                    {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        className={`tp-page-btn ${p === page ? 'active' : ''}`}
                        onClick={() => load(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <PoolEmpty 
          hasFilters={false} 
          onUploadClick={() => setShowUploadModal(true)} 
        />
      )}

      {/* ── Modals & Panels ── */}
      {showUploadModal && (
        <BulkUploadModal 
          onClose={() => setShowUploadModal(false)} 
          onSuccess={() => load(1)} 
        />
      )}

      {showCopilotPanel && (
        <CopilotMatchPanel 
          onClose={() => setShowCopilotPanel(false)}
          positions={availablePositions}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function CandidateCard({ candidate: c, onNavigate }) {
  const reason = REASON_COLORS[c.talent_pool_reason] || REASON_COLORS.manual
  const initials = (c.name || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const skills = Array.isArray(c.skill_tags) ? c.skill_tags : []
  const contactCfg = CONTACT_STATUS_CFG[c.contact_status] || CONTACT_STATUS_CFG.active

  return (
    <div className="tp-card" onClick={() => onNavigate(`/candidates/${c.id}`, { state: { from: '/talent-pool', fromLabel: 'Talent Pool' } })}>
      <div className="tp-card-header">
        <div className="tp-card-avatar">{initials}</div>
        <div className="tp-card-info">
          <div className="tp-card-name">{c.name}</div>
          <div className="tp-card-title">{c.current_title || '—'} {c.current_company ? `@ ${c.current_company}` : ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <span className="tp-card-reason" style={{ background: reason.bg, color: reason.color }}>
            {reason.label}
          </span>
          {c.contact_status && c.contact_status !== 'active' && (
            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: contactCfg.bg, color: contactCfg.color, fontWeight: 500 }}>
              {contactCfg.label}
            </span>
          )}
        </div>
      </div>

      <div className="tp-card-meta">
        {c.location && <span>📍 {c.location}</span>}
        {c.experience_years && <span>· {c.experience_years} yrs</span>}
        {c.source && <span>· {c.source}</span>}
      </div>

      {skills.length > 0 && (
        <div className="tp-card-skills">
          {skills.slice(0, 5).map(s => (
            <span key={s} className="tp-skill-tag">{s}</span>
          ))}
          {skills.length > 5 && <span className="tp-skill-more">+{skills.length - 5}</span>}
        </div>
      )}

      <div className="tp-card-footer">
        {c.talent_pool_added_at && (
          <span className="tp-card-date">
            Added {new Date(c.talent_pool_added_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
        <button className="tp-view-btn" onClick={e => { e.stopPropagation(); onNavigate(`/candidates/${c.id}`) }}>
          View Profile →
        </button>
      </div>
    </div>
  )
}

function PoolEmpty({ hasFilters, onClear, onUploadClick }) {
  return (
    <div className="tp-empty-wrapper">
      <div className="tp-empty">
        <div className="tp-empty-icon">🗃</div>
        <h3>{hasFilters ? 'No candidates match your filters' : 'Your talent pool is empty'}</h3>
        <p>{hasFilters 
          ? 'Try adjusting your search terms or filters.' 
          : 'Upload resumes to build your pool. Candidates are also auto-added when rejected from open positions.'}
        </p>
        {hasFilters ? (
          <button className="tp-btn-secondary" onClick={onClear} style={{ marginTop: 12 }}>
            Clear Filters
          </button>
        ) : (
          <button className="tp-btn-primary" onClick={onUploadClick} style={{ marginTop: 12 }}>
            + Upload Resumes
          </button>
        )}
      </div>
    </div>
  )
}

function PoolSkeleton() {
  return (
    <div className="tp-grid">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="skeleton-block" style={{ height: 200, borderRadius: 14 }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modals & Panels
// ─────────────────────────────────────────────────────────────────────────────

function BulkUploadModal({ onClose, onSuccess }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const fileInputRef = useRef(null)

  const handleFiles = async (files) => {
    if (!files?.length) return
    setUploading(true)
    setResult(null)
    const form = new FormData()
    Array.from(files).slice(0, 50).forEach(f => form.append('files', f))
    try {
      const res = await fetch(`${API}/talent-pool/bulk-upload`, {
        method: 'POST',
        headers: authHeader(),
        body: form,
      })
      const data = await res.json()
      setResult(data)
      if (!data.error) onSuccess()
    } catch (e) {
      setResult({ error: e.message })
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h3>Bulk Upload Resumes</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body" style={{ padding: '24px' }}>
          {!result ? (
            <div
              className={`tp-upload-zone ${dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt"
                style={{ display: 'none' }}
                onChange={e => handleFiles(e.target.files)}
              />
              {uploading ? (
                <div className="tp-upload-processing">
                  <div className="tp-spinner" />
                  <p>Processing resumes… AI is extracting and deduplicating</p>
                </div>
              ) : (
                <>
                  <div className="tp-upload-icon">📁</div>
                  <div className="tp-upload-text">
                    <strong>Drop resumes here</strong>
                    <span>or</span>
                    <button className="tp-btn-primary" type="button" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>Browse Files</button>
                  </div>
                  <div className="tp-upload-hint">PDF or DOCX · Up to 50 files · Max 5MB each</div>
                </>
              )}
            </div>
          ) : (
            <div className={`tp-upload-result ${result.error ? 'error' : ''}`}>
              {result.error ? (
                <><span>⚠️</span> Upload failed: {result.error}</>
              ) : (
                <>
                  <div className="tp-result-header">
                    <h4>Processed {result.processed || 0} resumes</h4>
                  </div>
                  {result.added?.length > 0 && (
                    <p className="tp-result-added">✅ {result.added.length} new candidates added to pool</p>
                  )}
                  {result.duplicates?.length > 0 && (
                    <div className="tp-result-dups">
                      <p>⚠️ {result.duplicates.length} duplicates detected (skipped):</p>
                      {result.duplicates.map((d, i) => (
                        <div key={i} className="tp-dup-row">
                          <span>• {d.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.errors?.length > 0 && (
                    <p className="tp-result-errors">❌ {result.errors.length} files failed</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        
        {result && (
          <div className="modal-footer">
            <button className="tp-btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

function CopilotMatchPanel({ onClose, positions }) {
  const [selectedPosition, setSelectedPosition] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  
  // Group positions by department
  const groupedPositions = positions.reduce((acc, p) => {
    const dept = p.department_name || 'Global'
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(p)
    return acc
  }, {})

  const handleSuggest = async () => {
    if (!selectedPosition) return
    setSuggesting(true)
    setSuggestions(null)
    try {
      const res = await fetch(`${API}/talent-pool/suggest/${selectedPosition}`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      setSuggestions(data.matches || [])
    } catch (e) {
      setSuggestions([])
    } finally {
      setSuggesting(false)
    }
  }

  const addToPipeline = async (candidateId) => {
    try {
      await fetch(`${API}/talent-pool/${candidateId}/add-to-position`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_id: parseInt(selectedPosition) }),
      })
      setSuggestions(prev => prev?.filter(s => s.candidate_id !== candidateId))
    } catch (e) {
      alert('Failed to add to pipeline')
    }
  }

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <div className="copilot-panel">
        <div className="copilot-panel-header">
          <div className="copilot-panel-title">
            <span>✨</span> AI Copilot Match
          </div>
          <button className="copilot-panel-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="copilot-panel-body">
          <p className="copilot-panel-desc">
            Select an open position to find the best candidates already in your talent pool.
          </p>
          
          <div className="copilot-panel-controls">
            <select
              className="copilot-select"
              value={selectedPosition}
              onChange={e => { setSelectedPosition(e.target.value); setSuggestions(null) }}
            >
              <option value="">Select open position…</option>
              {Object.entries(groupedPositions).map(([dept, posList]) => (
                <optgroup key={dept} label={dept}>
                  {posList.map(p => (
                    <option key={p.id} value={p.id}>{p.role_name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              className="tp-btn-copilot"
              onClick={handleSuggest}
              disabled={!selectedPosition || suggesting}
              style={{ width: '100%', marginTop: '12px' }}
            >
              {suggesting ? '⏳ Scoring Pool...' : 'Run AI Match'}
            </button>
          </div>

          <div className="copilot-panel-results">
            {suggesting && (
              <div className="copilot-loading">
                <div className="tp-spinner" />
                <p>Analyzing candidates...</p>
              </div>
            )}
            
            {suggestions !== null && !suggesting && (
              <>
                {suggestions.length === 0 ? (
                  <div className="copilot-empty">
                    <p>No pool candidates matched above 55% for this position.</p>
                  </div>
                ) : (
                  <div className="copilot-match-list">
                    <p className="copilot-match-count">Top matches from pool:</p>
                    {suggestions.map(s => (
                      <div key={s.candidate_id} className="copilot-match-card">
                        <div className="cmc-header">
                          <div className="cmc-score">{s.match_score}%</div>
                          <div className="cmc-info">
                            <div className="cmc-name">{s.name}</div>
                            <div className="cmc-title">{s.current_title}</div>
                          </div>
                        </div>
                        <button
                          className="tp-btn-secondary cmc-add-btn"
                          onClick={() => addToPipeline(s.candidate_id)}
                        >
                          + Add to Pipeline
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
