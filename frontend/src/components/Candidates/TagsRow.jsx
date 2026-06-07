/**
 * Candidates/TagsRow.jsx — v3 tags chip row with inline add
 * Per docs/design/pages/04_candidate_detail.md §3.
 * Uses existing candidate_tags API (candidatesApi.addTag / removeTag).
 */
import React, { useState } from 'react'
import Chip from '../common/Chip'
import Icon from '../common/Icon'
import Toast from '../common/Toast'
import StatusBadge from '../common/StatusBadge'
import { candidatesApi } from '../../utils/api'
import { PIPELINE_STAGES } from '../../utils/constants'

export default function TagsRow({
  candidateId,
  tags = [],
  pipelineStatus,
  stageEnteredAt,
  totalDays,
  onTagsChange,
  onStatusChange,
  movingStatus,
}) {
  const [adding, setAdding] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [toast, setToast] = useState(null)

  const handleAddTag = async () => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || tags.includes(tag)) { setTagInput(''); setAdding(false); return }
    try {
      await candidatesApi.addTag(candidateId, tag)
      onTagsChange([...tags, tag])
      setTagInput('')
      setAdding(false)
    } catch (e) {
      setToast({ message: `Failed to add tag: ${e.message}`, type: 'error' })
    }
  }

  const handleRemoveTag = async (tag) => {
    try {
      await candidatesApi.removeTag(candidateId, tag)
      onTagsChange(tags.filter(t => t !== tag))
    } catch (e) {
      setToast({ message: `Failed to remove tag: ${e.message}`, type: 'error' })
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddTag()
    if (e.key === 'Escape') { setAdding(false); setTagInput('') }
  }

  const stageLabel = PIPELINE_STAGES[pipelineStatus]?.label || pipelineStatus

  return (
    <div className="cd-tags-row">
      <div className="cd-tags-left">
        <span className="cd-tags-status-label">Status:</span>
        <div style={{ position: 'relative' }}>
          <div
            className="cd-status-dropdown-trigger"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 6px 2px 2px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-input)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <StatusBadge status={pipelineStatus || 'sourced'} />
            <Icon name="chevron-down" size={12} style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <select
            className="cd-tags-status-select-overlay"
            value={pipelineStatus || 'sourced'}
            onChange={e => onStatusChange(e.target.value)}
            disabled={movingStatus}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer'
            }}
          >
            {Object.entries(PIPELINE_STAGES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        {stageEnteredAt && (
          <span className="cd-tags-timing">
            <Icon name="clock" size={11} />
            Entered {new Date(stageEnteredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {totalDays != null && ` · ${totalDays}d total`}
          </span>
        )}
      </div>

      <div className="cd-tags-right">
        <span className="cd-tags-label">Tags:</span>
        {tags.map(tag => (
          <Chip
            key={tag}
            variant="primary"
            size="xs"
            onClick={() => handleRemoveTag(tag)}
            style={{ cursor: 'pointer' }}
          >
            {tag}
            <Icon name="x" size={9} style={{ marginLeft: 2, opacity: 0.6 }} />
          </Chip>
        ))}
        {adding ? (
          <input
            className="cd-tags-input"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (!tagInput.trim()) setAdding(false) }}
            placeholder="tag name"
            autoFocus
          />
        ) : (
          <button className="cd-tags-add-btn" onClick={() => setAdding(true)}>
            + Add tag
          </button>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
