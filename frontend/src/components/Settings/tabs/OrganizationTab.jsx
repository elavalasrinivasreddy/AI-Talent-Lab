import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../utils/api'
import Toast from '../../common/Toast'
import Icon from '../../common/Icon'

export default function OrganizationTab() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'org_head'
  const [org, setOrg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [isDrafting, setIsDrafting] = useState(false)
  const [toast, setToast] = useState(null)
  const [tagInput, setTagInput] = useState('')
  const fileInputRef = useRef(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchOrg = useCallback(async () => {
    try {
      const res = await api.get('/settings/org')
      setOrg(res.data.org)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { fetchOrg() }, [fetchOrg])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/settings/org', {
        segment: org.segment,
        size: org.size,
        website: org.website,
        headquarters: org.headquarters,
        about_us: org.about_us,
        culture_keywords: org.culture_keywords,
        benefits_text: org.benefits_text,
        linkedin_url: org.linkedin_url,
        glassdoor_url: org.glassdoor_url,
      })
      showToast('Organization updated successfully')
    } catch (e) {
      showToast(e.message || 'Failed to save', 'error')
    }
    setSaving(false)
  }

  const handleAutoDraft = async () => {
    if (!org.website) {
      showToast('Please enter a website URL first.', 'error')
      return
    }
    setIsDrafting(true)
    try {
      const res = await api.post('/settings/org/auto-draft', { url: org.website })
      if (res.data) {
        setOrg(prev => ({
          ...prev,
          about_us: res.data.about_us || prev.about_us,
          culture_keywords: res.data.culture_keywords || prev.culture_keywords,
          benefits_text: res.data.benefits_text || prev.benefits_text,
        }))
        if (res.data.fallback_used) {
          showToast('⚠️ Direct scrape failed. Generated draft using public web data.', 'warning')
        } else {
          showToast('✨ Profile auto-drafted from website!')
        }
      }
    } catch (err) {
      console.error('Auto-draft failed:', err)
      showToast('Failed to auto-draft from website.', 'error')
    } finally {
      setIsDrafting(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsDrafting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/settings/org/upload-handbook', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (res.data && res.data.error) {
        showToast(res.data.error, 'error')
      } else if (res.data) {
        setOrg(prev => ({
          ...prev,
          about_us: res.data.about_us || prev.about_us,
          culture_keywords: res.data.culture_keywords || prev.culture_keywords,
          benefits_text: res.data.benefits_text || prev.benefits_text,
        }))
        showToast('✨ Profile drafted from Handbook PDF!')
      }
    } catch (err) {
      console.error('PDF extraction failed:', err)
      showToast('Failed to extract from PDF.', 'error')
    } finally {
      setIsDrafting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const set = (field, val) => setOrg(prev => ({...prev, [field]: val}))

  const keywords = (org?.culture_keywords || '').split(',').map(k => k.trim()).filter(Boolean)

  const addTag = () => {
    const val = tagInput.trim()
    if (!val || keywords.some(k => k.toLowerCase() === val.toLowerCase())) return
    const updated = [...keywords, val].join(', ')
    set('culture_keywords', updated)
    setTagInput('')
  }

  const removeTag = (idx) => {
    const updated = keywords.filter((_, i) => i !== idx).join(', ')
    set('culture_keywords', updated)
  }

  if (!org) return <div className="skeleton-card" style={{height: 300}} />

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <div className="section-header">
          <h3>🏢 Organization</h3>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="file" 
                accept="application/pdf" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload} 
              />
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isDrafting}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span className={isDrafting ? 'spin-anim' : ''}>📄</span>
                {isDrafting ? 'Extracting...' : 'Upload PDF'}
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={handleAutoDraft} 
                disabled={isDrafting}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span className={isDrafting ? 'spin-anim' : ''}>✨</span>
                {isDrafting ? 'Extracting from website...' : 'Auto-draft from Website'}
              </button>
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Organization Name</label>
            <input value={org.name || ''} disabled />
          </div>
          <div className="form-group">
            <label>Org Slug</label>
            <input value={org.slug || ''} disabled />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Industry / Segment</label>
            <input value={org.segment || ''} disabled={!isAdmin}
                   onChange={e => set('segment', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Company Size</label>
            <select value={org.size || ''} disabled={!isAdmin}
                    onChange={e => set('size', e.target.value)}>
              <option value="startup">Startup</option>
              <option value="smb">SMB</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Website</label>
            <input value={org.website || ''} disabled={!isAdmin}
                   onChange={e => set('website', e.target.value)} placeholder="https://" />
          </div>
          <div className="form-group">
            <label>Headquarters</label>
            <input value={org.headquarters || ''} disabled={!isAdmin}
                   onChange={e => set('headquarters', e.target.value)} placeholder="City, Country" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full-width">
            <label>About Us</label>
            <div className="form-hint">Feeds into JD generation</div>
            <textarea rows={4} value={org.about_us || ''} disabled={!isAdmin}
                      onChange={e => set('about_us', e.target.value)}
                      placeholder="Brief description of your company..." />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full-width">
            <label>Culture Keywords</label>
            <div className="form-hint">Feeds into JD generation — AI interview kit</div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '12px',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              minHeight: '48px',
              alignItems: 'center'
            }}>
              {keywords.map((tag, i) => (
                <span key={i} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: 'var(--color-primary-bg)',
                  color: 'var(--color-primary)',
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid var(--color-primary-light)'
                }}>
                  {tag}
                  {isAdmin && (
                    <button 
                      onClick={() => removeTag(i)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.7,
                        fontSize: '14px'
                      }}
                      onMouseOver={e => e.currentTarget.style.opacity = 1}
                      onMouseOut={e => e.currentTarget.style.opacity = 0.7}
                    >×</button>
                  )}
                </span>
              ))}
              {isAdmin && (
                <input 
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder={keywords.length === 0 ? "Type keyword + Enter" : "Add another..."}
                  style={{
                    flex: 1,
                    minWidth: '150px',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '14px',
                    color: 'var(--color-text-primary)'
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full-width">
            <label>Benefits Template</label>
            <div className="form-hint">Feeds into JD generation — appended to all JDs</div>
            <textarea rows={4} value={org.benefits_text || ''} disabled={!isAdmin}
                      onChange={e => set('benefits_text', e.target.value)}
                      placeholder="Health insurance, flexible hours, stock options..." />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>LinkedIn URL</label>
            <input value={org.linkedin_url || ''} disabled={!isAdmin}
                   onChange={e => set('linkedin_url', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Glassdoor URL</label>
            <input value={org.glassdoor_url || ''} disabled={!isAdmin}
                   onChange={e => set('glassdoor_url', e.target.value)} />
          </div>
        </div>

        {isAdmin && (
          <div className="btn-row" style={{ marginTop: '24px' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Organization'}
            </button>
          </div>
        )}
      </div>

      {isDrafting && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          borderRadius: 'var(--radius-lg)'
        }}>
          <div className="spin-anim" style={{ fontSize: '32px', marginBottom: '16px' }}>✨</div>
          <h3 style={{ color: 'white', margin: '0 0 8px' }}>AI is extracting profile data...</h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>This may take a few seconds.</p>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
