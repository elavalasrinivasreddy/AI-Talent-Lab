/**
 * Candidates/TagsRow.jsx — v3 tags chip row with inline add
 * Per docs/design/pages/04_candidate_detail.md §3.
 * Uses existing candidate_tags API (candidatesApi.addTag / removeTag).
 */
import React, { useState } from 'react'
import Chip from '../common/Chip'
import Icon from '../common/Icon'
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

  const handleAddTag = async () => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || tags.includes(tag)) { setTagInput(''); setAdding(false); return }
    try {
      await candidatesApi.addTag(candidateId, tag)
      onTagsChange([...tags, tag])
      setTagInput('')
      setAdding(false)
    } catch (e) {
      alert(`Failed to add tag: ${e.message}`)
    }
  }

  const handleRemoveTag = async (tag) => {
    try {
      await candidatesApi.removeTag(candidateId, tag)
      onTagsChange(tags.filter(t => t !== tag))
    } catch (e) {
      alert(`Failed to remove tag: ${e.message}`)
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
        <select
          className="cd-tags-status-select"
          value={pipelineStatus || 'sourced'}
          onChange={e => onStatusChange(e.target.value)}
          disabled={movingStatus}
        >
          {Object.entries(PIPELINE_STAGES).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
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
    </div>
  )
}
