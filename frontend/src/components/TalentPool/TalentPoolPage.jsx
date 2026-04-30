/**
 * TalentPoolPage.jsx – Org-wide talent pool with bulk upload and AI suggestions
 * Route: /talent-pool
 * Per docs/pages/08_talent_pool.md
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { positionsApi } from '../../utils/api'
import './TalentPoolPage.css'

const API = '/api/v1'

const REASON_COLORS = {
  rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Rejected' },
  position_closed: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Position Closed' },
  position_archived: { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', label: 'Archived' },
  manual: { color: '#6366f1', bg: 'rgba(99,102,241,0.1)', label: 'Manual' },
}

function authHeader() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function TalentPoolPage() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterReason, setFilterReason] = useState('')
  const searchTimeout = useRef(null)

  // Bulk upload
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileInputRef = useRef(null)

  // AI Suggest
  const [positions, setPositions] = useState([])
  const [selectedPosition, setSelectedPosition] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState(null)

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
  }, [])

  useEffect(() => {
    load()
    positionsApi.list({ status: 'open' }).then(data => {
      setPositions(Array.isArray(data) ? data : data.positions || [])
    }).catch(() => {})
  }, [])

  const handleSearch = (val) => {
    setSearch(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => load(1, val, filterLocation, filterReason), 400)
  }

  // ── Bulk Upload ─────────────────────────────────────────────────────────────

  const handleFiles = async (files) => {
    if (!files?.length) return
    setUploading(true)
    setUploadResult(null)
    const form = new FormData()
    Array.from(files).slice(0, 50).forEach(f => form.append('files', f))
    try {
      const res = await fetch(`${API}/talent-pool/bulk-upload`, {
        method: 'POST',
        headers: authHeader(),
        body: form,
      })
      const data = await res.json()
      setUploadResult(data)
      load(1)
    } catch (e) {
      setUploadResult({ error: e.message })
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  // ── AI Suggest ──────────────────────────────────────────────────────────────

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
    <div className="tp-page">
      {/* Header */}
      <div className="tp-header">
        <div>
          <h1 className="tp-title">🗃 Talent Pool</h1>
          <p className="tp-sub">{total > 0 ? `${total.toLocaleString()} candidates · Org-wide` : 'Your reusable candidate database'}</p>
        </div>
      </div>

      {/* ── Bulk Upload Zone ── */}
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
              <strong>Drop resumes here to add offline candidates</strong>
              <span>or</span>
              <button className="tp-upload-btn" type="button">+ Upload Resumes</button>
            </div>
            <div className="tp-upload-hint">PDF or DOCX · Up to 50 files · Max 5MB each</div>
          </>
        )}
      </div>

      {/* Upload Results */}
      {uploadResult && <UploadResults result={uploadResult} onDone={() => setUploadResult(null)} />}

      {/* ── AI Suggest Panel ── */}
      <div className="tp-suggest-panel">
        <div className="tp-suggest-header">
          <h3>🤖 AI Match Suggestions</h3>
          <p>Find pool candidates for a position before sourcing externally</p>
        </div>
        <div className="tp-suggest-controls">
          <select
            className="tp-suggest-select"
            value={selectedPosition}
            onChange={e => { setSelectedPosition(e.target.value); setSuggestions(null) }}
          >
            <option value="">Select open position…</option>
            {positions.map(p => (
              <option key={p.id} value={p.id}>{p.role_name}</option>
            ))}
          </select>
          <button
            className="tp-suggest-btn"
            onClick={handleSuggest}
            disabled={!selectedPosition || suggesting}
          >
            {suggesting ? '⏳ Finding…' : '🔍 Find Matches'}
          </button>
        </div>

        {suggestions !== null && (
          <div className="tp-suggest-results">
            {suggestions.length === 0 ? (
              <p className="tp-suggest-empty">No pool candidates above 55% match for this position.</p>
            ) : (
              <>
                <p className="tp-suggest-count">Found {suggestions.length} pool candidates above 55% match:</p>
                <div className="tp-suggest-cards">
                  {suggestions.map(s => (
                    <div key={s.candidate_id} className="tp-suggest-card">
                      <div className="tp-suggest-score">{s.match_score}%</div>
                      <div className="tp-suggest-name">{s.name}</div>
                      <div className="tp-suggest-title">{s.current_title}</div>
                      {s.talent_pool_reason && (
                        <span className="tp-suggest-reason"
                          style={{ color: REASON_COLORS[s.talent_pool_reason]?.color }}>
                          {REASON_COLORS[s.talent_pool_reason]?.label}
                        </span>
                      )}
                      <button
                        className="tp-suggest-add-btn"
                        onClick={() => addToPipeline(s.candidate_id)}
                      >
                        + Add to Pipeline
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Search + Filters ── */}
      <div className="tp-filters">
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
      </div>

      {/* ── Candidate Grid ── */}
      {loading ? (
        <PoolSkeleton />
      ) : candidates.length === 0 ? (
        <PoolEmpty hasFilters={!!(search || filterLocation || filterReason)} />
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
  )
}

function CandidateCard({ candidate: c, onNavigate }) {
  const reason = REASON_COLORS[c.talent_pool_reason] || REASON_COLORS.manual
  const initials = (c.name || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const skills = Array.isArray(c.skill_tags) ? c.skill_tags : []

  return (
    <div className="tp-card" onClick={() => onNavigate(`/candidates/${c.id}`, { state: { from: '/talent-pool', fromLabel: 'Talent Pool' } })}>
      <div className="tp-card-header">
        <div className="tp-card-avatar">{initials}</div>
        <div className="tp-card-info">
          <div className="tp-card-name">{c.name}</div>
          <div className="tp-card-title">{c.current_title || '—'} {c.current_company ? `@ ${c.current_company}` : ''}</div>
        </div>
        <span className="tp-card-reason" style={{ background: reason.bg, color: reason.color }}>
          {reason.label}
        </span>
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

function UploadResults({ result, onDone }) {
  if (result.error) return (
    <div className="tp-upload-result error">
      <span>⚠️</span> Upload failed: {result.error}
      <button onClick={onDone}>✕</button>
    </div>
  )
  return (
    <div className="tp-upload-result">
      <div className="tp-result-header">
        <h4>Upload Results — Processed {result.processed || 0} resumes</h4>
        <button className="tp-result-close" onClick={onDone}>✕ Done</button>
      </div>
      {result.added?.length > 0 && (
        <p className="tp-result-added">✅ {result.added.length} new candidates added to pool</p>
      )}
      {result.duplicates?.length > 0 && (
        <div className="tp-result-dups">
          <p>⚠️ {result.duplicates.length} duplicates detected:</p>
          {result.duplicates.map((d, i) => (
            <div key={i} className="tp-dup-row">
              <span>• {d.name} ({d.email})</span>
              <span className="tp-dup-age">last updated {d.days_since_update}d ago</span>
              {d.suggest_skip && <span className="tp-dup-skip">Auto-suggest: Skip — recent profile</span>}
            </div>
          ))}
        </div>
      )}
      {result.errors?.length > 0 && (
        <p className="tp-result-errors">❌ {result.errors.length} files could not be processed</p>
      )}
    </div>
  )
}

function PoolEmpty({ hasFilters }) {
  return (
    <div className="tp-empty">
      <span>🗃</span>
      <h3>{hasFilters ? 'No candidates match your filters' : 'Your talent pool is empty'}</h3>
      <p>{hasFilters ? 'Try a different search or filter.' : 'Upload resumes above to build your pool, or candidates are auto-added when rejected from positions.'}</p>
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
