/**
 * JDTab.jsx – View + edit the final Job Description. Download as PDF/MD.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { positionsApi } from '../../../utils/api'
import { useAuth } from '../../../context/AuthContext'
import './JDTab.css'

export default function JDTab({ position, onUpdate }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(position?.jd_markdown || '')
  const editRef = React.useRef(null)
  const [saving, setSaving] = useState(false)
  const [processingDecision, setProcessingDecision] = useState(false)
  
  const turndownService = React.useMemo(() => new TurndownService({ headingStyle: 'atx' }), [])

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

  const isApproved = position?.status === 'open' || position?.approval_status === 'approved'
  const isPendingApproval = position?.status === 'pending_approval' || position?.approval_status === 'pending'
  const isDraftOrRejected = position?.status === 'draft' || position?.approval_status === 'rejected'

  // Team Leads can only edit during pending_approval. Once approved, locked.
  const canTeamLeadEdit = isPendingApproval && (user?.role === 'team_lead' || user?.role === 'org_head')
  
  // HR cannot use normal Edit if there's a session. They use Resume Chat.
  const canHrEdit = isDraftOrRejected && user?.role === 'hr' && !position?.session_id
  
  const canEdit = canTeamLeadEdit || canHrEdit
  
  const canResumeChat = isDraftOrRejected && user?.role === 'hr' && !!position?.session_id
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
            <>
              {canEdit && <button className="jd-btn primary" onClick={() => setEditing(true)}>✏️ Edit</button>}
              {canResumeChat && (
                <button
                  className="jd-btn primary"
                  onClick={() => navigate(`/chat/${position.session_id}`, {
                    state: {
                      hireRequest: {
                        role_name: position.role_name,
                        department_name: position.department_name,
                        headcount: position.headcount,
                        work_type: position.work_type,
                        location: position.location,
                        experience_min: position.experience_min,
                        experience_max: position.experience_max,
                      },
                    },
                  })}
                >
                  💬 Resume AI Chat
                </button>
              )}
            </>
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
        <div 
          ref={editRef}
          className="jd-wysiwyg" 
          contentEditable={true}
          dangerouslySetInnerHTML={{ __html: marked(content) }}
          onBlur={(e) => setContent(turndownService.turndown(e.target.innerHTML))}
          style={{ border: '1px solid var(--border-200)', borderRadius: '8px', padding: '24px', outline: 'none', minHeight: '400px' }}
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
