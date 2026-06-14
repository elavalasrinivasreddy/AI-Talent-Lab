import { describe, it, expect } from 'vitest'
import { STEP_PROGRESS } from './ApplyPage.jsx'

/**
 * Regression guard for the apply-chat progress bar "reset to Step 1" bug.
 *
 * The backend (CandidateChatController + ApplyService.handle_resume_upload)
 * emits step strings that the frontend maps to a progress bucket. Previously the
 * map used `screening_q` / `confirmation` and was missing `compensation` and
 * `screening_questions`, so those steps fell through to bucket 0 — making the
 * progress bar snap back to "Step 1 of 6" at the CTC question and right after
 * resume upload. These tests fail if that contract drifts again.
 */

// The exact set of step strings the backend can emit. Keep in sync with
// backend/agents/candidate_chat.py and backend/services/apply_service.py.
const BACKEND_STEPS = [
  'greeting',
  'interest',
  'screening_questions',
  'resume_upload',
  'video_intro',
  'completion',
  'declined',
]

describe('apply progress mapping', () => {
  it('maps every backend step string to a defined bucket', () => {
    for (const step of BACKEND_STEPS) {
      expect(STEP_PROGRESS[step], `step "${step}" must be mapped`).toBeTypeOf('number')
    }
  })

  it('does not reset to Welcome at the screening step', () => {
    // Original bug: an unmapped step snapped the bar back to "Step 1 of 6".
    expect(STEP_PROGRESS.screening_questions).toBeGreaterThan(0)
  })

  it('advances through resume → video without regressing', () => {
    expect(STEP_PROGRESS.video_intro).toBeGreaterThanOrEqual(STEP_PROGRESS.resume_upload)
    expect(STEP_PROGRESS.completion).toBeGreaterThanOrEqual(STEP_PROGRESS.video_intro)
  })

  it('advances monotonically through the real flow order', () => {
    const ordered = [
      'greeting',
      'interest',
      'screening_questions',
      'resume_upload',
      'video_intro',
      'completion',
    ]
    for (let i = 1; i < ordered.length; i++) {
      expect(STEP_PROGRESS[ordered[i]]).toBeGreaterThanOrEqual(STEP_PROGRESS[ordered[i - 1]])
    }
  })
})
