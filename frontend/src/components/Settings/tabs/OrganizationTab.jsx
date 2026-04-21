import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../utils/api'

export default function OrganizationTab() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [org, setOrg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [tagInput, setTagInput] = useState('')

  const fetchOrg = useCallback(async () => {
    try {
      const res = await api.get('/settings/org')
      setOrg(res.data.org)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { fetchOrg() }, [fetchOrg])

  const handleSave = async () => {
    setSaving(true); setMsg('')
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
      setMsg('Organization updated!')
    } catch (e) {
      setMsg(e.message || 'Failed to save')
    }
    setSaving(false)
  }

  const set = (field, val) => setOrg(prev => ({...prev, [field]: val}))

  const keywords = (org?.culture_keywords || '').split(',').map(k => k.trim()).filter(Boolean)

  const addTag = () => {
    const val = tagInput.trim()
    if (!val) return
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
        <h3>🏢 Organization</h3>

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
            <div className="tag-input-container">
              {keywords.map((tag, i) => (
                <span key={i} className="tag">
                  {tag}
                  {isAdmin && <button onClick={() => removeTag(i)}>×</button>}
                </span>
              ))}
              {isAdmin && (
                <input className="tag-input-field" value={tagInput}
                       onChange={e => setTagInput(e.target.value)}
                       onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                       placeholder="Type keyword + Enter" />
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

        {msg && <p className={`form-msg ${msg.includes('updated') ? 'success' : 'error'}`}>{msg}</p>}

        {isAdmin && (
          <div className="btn-row">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Organization'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
