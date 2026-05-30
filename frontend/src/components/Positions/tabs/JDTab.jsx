/**
 * JDTab.jsx – View + edit the final Job Description. Download as PDF/MD.
 */
import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { positionsApi } from '../../../utils/api'
import { useAuth } from '../../../context/AuthContext'
import './JDTab.css'

export default function JDTab({ position, onUpdate }) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(position?.jd_markdown || '')
  const [saving, setSaving] = useState(false)
  const [processingDecision, setProcessingDecision] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await positionsApi.update(position.id, { jd_markdown: content })
      onUpdate(prev => ({ ...prev, jd_markdown: content, ...updated }))
      setEditing(false)
    } catch (e) {
      alert(`Save failed: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadMd = () => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${position.role_name?.replace(/\s+/g, '_') || 'JD'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPdf = () => {
    const printWin = window.open('', '_blank')
    printWin.document.write(`<html><head><title>${position.role_name}</title>
      <style>body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; line-height: 1.6; }
      h1,h2,h3 { color: #1a1a1a; } </style></head><body>
      <pre style="white-space:pre-wrap">${content}</pre></body></html>`)
    printWin.document.close()
    printWin.print()
  }

  const handleDecision = async (decision) => {
    setProcessingDecision(true)
    try {
      const updated = await positionsApi.approvalDecision(position.id, decision, decision === 'rejected' ? 'Changes requested' : '')
      onUpdate(prev => ({ ...prev, ...updated }))
    } catch (e) {
      alert(`Approval decision failed: ${e.message}`)
    } finally {
      setProcessingDecision(false)
    }
  }

  const canEdit = user?.role === 'team_lead' || user?.role === 'org_head' || (user?.role === 'hr' && position.approval_status !== 'pending')
  const isPendingApproval = position.approval_status === 'pending'
  const canApprove = isPendingApproval && (user?.role === 'team_lead' || user?.role === 'org_head')

  return (
    <div className="jd-tab">
      {canApprove && (
        <div className="jd-approval-banner">
          <div className="jd-approval-text">
            <strong>JD Ready for Review</strong>
            <p>Please review the generated Job Description below. You can edit it directly or request changes.</p>
          </div>
          <div className="jd-approval-actions">
            <button 
              className="pd-btn pd-btn-outline" 
              onClick={() => handleDecision('rejected')} 
              disabled={processingDecision}
            >
              Request Changes
            </button>
            <button 
              className="pd-btn pd-btn-primary" 
              onClick={() => handleDecision('approved')} 
              disabled={processingDecision}
            >
              Approve JD
            </button>
          </div>
        </div>
      )}

      <div className="jd-header">
        <h3 className="jd-title">Job Description</h3>
        <div className="jd-actions">
          <button className="jd-btn" onClick={handleDownloadMd}>⬇ Markdown</button>
          <button className="jd-btn" onClick={handleDownloadPdf}>🖨 PDF</button>
          {!editing ? (
            canEdit && <button className="jd-btn primary" onClick={() => setEditing(true)}>✏️ Edit</button>
          ) : (
            <>
              <button className="jd-btn" onClick={() => setEditing(false)}>Cancel</button>
              <button className="jd-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          className="jd-editor"
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={30}
        />
      ) : (
        <div className="jd-content">
          {content ? (
            <div className="jd-markdown-render">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="jd-empty">No JD content yet.</div>
          )}
        </div>
      )}
    </div>
  )
}
