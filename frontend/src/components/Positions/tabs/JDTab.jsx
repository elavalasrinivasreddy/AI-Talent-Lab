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
  const [decisionError, setDecisionError] = useState(null)

  // Request-changes modal
  const [showChangesModal, setShowChangesModal] = useState(false)
  const [changesNotes, setChangesNotes] = useState('')
  const [changesError, setChangesError] = useState(null)

  const turndownService = React.useMemo(() => new TurndownService({ headingStyle: 'atx' }), [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await positionsApi.update(position.id, { jd_markdown: content })
      onUpdate(prev => ({ ...prev, jd_markdown: content, ...updated }))
      setEditing(false)
    } catch (e) {
      setDecisionError(`Save failed: ${e.message}`)
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

  const handleApprove = async () => {
    setProcessingDecision(true)
    setDecisionError(null)
    try {
      const updated = await positionsApi.approvalDecision(position.id, 'approved', '')
      onUpdate(prev => ({ ...prev, ...updated }))
    } catch (e) {
      setDecisionError(e.message || 'Approval failed. Please try again.')
    } finally {
      setProcessingDecision(false)
    }
  }

  const handleOpenChangesModal = () => {
    setChangesNotes('')
    setChangesError(null)
    setShowChangesModal(true)
  }

  const handleSubmitChanges = async () => {
    if (!changesNotes.trim()) {
      setChangesError('Please describe what needs to be changed.')
      return
    }
    setProcessingDecision(true)
    setChangesError(null)
    try {
      const updated = await positionsApi.approvalDecision(position.id, 'changes_requested', changesNotes.trim())
      onUpdate(prev => ({ ...prev, ...updated }))
      setShowChangesModal(false)
      setChangesNotes('')
    } catch (e) {
      setChangesError(e.message || 'Failed to submit feedback. Please try again.')
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
      {position?.approval_status === 'changes_requested' && position?.review_notes && (
        <div style={{
          display: 'flex', gap: '12px', alignItems: 'flex-start',
          padding: '14px 16px', marginBottom: '16px',
          borderRadius: '8px',
          border: '1px solid rgba(245,158,11,0.3)',
          background: 'rgba(245,158,11,0.06)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#D97706', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Team Lead Feedback
            </div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', userSelect: 'text' }}>
              {position.review_notes}
            </div>
          </div>
        </div>
      )}

      {canApprove && (
        <div className="jd-approval-banner">
          <div className="jd-approval-text">
            <strong>JD Ready for Review</strong>
            <p>Please review the generated Job Description below. You can edit it directly or request changes.</p>
          </div>
          <div className="jd-approval-actions">
            <button
              className="pd-btn pd-btn-outline"
              onClick={handleOpenChangesModal}
              disabled={processingDecision}
            >
              Request Changes
            </button>
            <button
              className="pd-btn pd-btn-primary"
              onClick={handleApprove}
              disabled={processingDecision}
            >
              {processingDecision ? 'Processing…' : 'Approve JD'}
            </button>
          </div>
        </div>
      )}

      {decisionError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 16px', marginBottom: '12px',
          borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
          background: 'rgba(239,68,68,0.06)', fontSize: '13px', color: '#EF4444',
        }}>
          <span style={{ flex: 1 }}>{decisionError}</span>
          <button
            onClick={() => setDecisionError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '0 4px', fontSize: '16px', lineHeight: 1 }}
            aria-label="Dismiss error"
          >×</button>
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

      {/* Request Changes modal */}
      {showChangesModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowChangesModal(false) }}
        >
          <div style={{
            background: 'var(--color-bg-primary, #0F172A)',
            border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
            borderRadius: '12px', padding: '28px 28px 24px',
            width: '480px', maxWidth: '90vw',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Request Changes
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Describe what needs to be updated. The HR team will be notified with your feedback.
            </p>

            <textarea
              autoFocus
              value={changesNotes}
              onChange={(e) => { setChangesNotes(e.target.value); setChangesError(null) }}
              placeholder="e.g. The experience requirements are too broad. Please tighten them to 3–5 years in fintech specifically."
              rows={5}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: '8px',
                border: changesError ? '1px solid #EF4444' : '1px solid var(--color-border, rgba(255,255,255,0.12))',
                background: 'var(--color-bg-secondary, rgba(255,255,255,0.04))',
                color: 'var(--color-text-primary)', fontSize: '13px',
                resize: 'vertical', outline: 'none', fontFamily: 'inherit',
              }}
            />

            {changesError && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#EF4444' }}>{changesError}</p>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                className="pd-btn pd-btn-outline"
                onClick={() => setShowChangesModal(false)}
                disabled={processingDecision}
              >
                Cancel
              </button>
              <button
                className="pd-btn pd-btn-primary"
                onClick={handleSubmitChanges}
                disabled={processingDecision || !changesNotes.trim()}
              >
                {processingDecision ? 'Sending…' : 'Send Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
