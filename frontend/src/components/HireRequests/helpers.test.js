import { describe, it, expect } from 'vitest'
import {
  computeRelayStates,
  statusLabel,
  statusTone,
  formatCompBand,
  formatExperience,
  RELAY_STAGES,
} from './helpers'

describe('HireRequests/helpers — computeRelayStates', () => {
  it('returns {} for a null request', () => {
    expect(computeRelayStates(null)).toEqual({})
  })

  it('maps each status to the right relay step states', () => {
    expect(computeRelayStates({ status: 'draft' })).toMatchObject({ filed: 'current', dept: 'pending' })
    expect(computeRelayStates({ status: 'pending' })).toMatchObject({ filed: 'done', dept: 'current', hr: 'pending' })
    expect(computeRelayStates({ status: 'approved' })).toMatchObject({ filed: 'done', dept: 'done', hr: 'current' })
    expect(computeRelayStates({ status: 'rejected' })).toMatchObject({ dept: 'rejected', position: 'pending' })
    expect(computeRelayStates({ status: 'cancelled' })).toMatchObject({ filed: 'done', dept: 'pending' })
  })

  it('routes fulfilled requests by position_approval_status', () => {
    expect(computeRelayStates({ status: 'fulfilled', position_approval_status: 'pending' }))
      .toMatchObject({ jd_approval: 'current', position: 'pending' })
    expect(computeRelayStates({ status: 'fulfilled', position_approval_status: 'changes_requested' }))
      .toMatchObject({ jd_approval: 'current', position: 'pending' })
    expect(computeRelayStates({ status: 'fulfilled', position_approval_status: 'approved' }))
      .toMatchObject({ jd_approval: 'done', position: 'done' })
  })

  it('always returns a state for every defined relay stage', () => {
    const states = computeRelayStates({ status: 'pending' })
    for (const stage of RELAY_STAGES) {
      expect(states[stage.key]).toBeDefined()
    }
  })

  it('falls back to all-pending for an unknown status', () => {
    expect(computeRelayStates({ status: 'nonsense' })).toMatchObject({ filed: 'done', dept: 'pending', position: 'pending' })
  })
})

describe('HireRequests/helpers — statusLabel & statusTone', () => {
  it('labels known statuses', () => {
    expect(statusLabel({ status: 'pending' })).toBe('Awaiting dept approval')
    expect(statusLabel({ status: 'approved' })).toContain('awaiting HR pickup')
    expect(statusLabel({ status: 'rejected' })).toBe('Not approved')
    expect(statusLabel({ status: 'cancelled' })).toBe('Cancelled')
  })

  it('labels accepted by whether a position exists yet', () => {
    expect(statusLabel({ status: 'accepted', position_id: 7 })).toBe('JD in progress')
    expect(statusLabel({ status: 'accepted', position_id: null })).toBe('HR working on JD')
  })

  it('labels fulfilled by position approval state', () => {
    expect(statusLabel({ status: 'fulfilled', position_approval_status: 'pending' })).toContain('awaiting your approval')
    expect(statusLabel({ status: 'fulfilled', position_approval_status: 'changes_requested' })).toBe('JD changes requested')
    expect(statusLabel({ status: 'fulfilled', position_approval_status: 'approved' })).toBe('Active position')
  })

  it('returns the raw status for unknown values and "" for null', () => {
    expect(statusLabel({ status: 'weird' })).toBe('weird')
    expect(statusLabel(null)).toBe('')
  })

  it('maps statuses to the right tone', () => {
    expect(statusTone(null)).toBe('neutral')
    expect(statusTone({ status: 'rejected' })).toBe('danger')
    expect(statusTone({ status: 'pending' })).toBe('warning')
    expect(statusTone({ status: 'approved' })).toBe('info')
    expect(statusTone({ status: 'accepted' })).toBe('info')
    expect(statusTone({ status: 'fulfilled', position_approval_status: 'pending' })).toBe('warning')
    expect(statusTone({ status: 'fulfilled', position_approval_status: 'changes_requested' })).toBe('danger')
    expect(statusTone({ status: 'fulfilled', position_approval_status: 'approved' })).toBe('success')
    expect(statusTone({ status: 'cancelled' })).toBe('neutral')
  })
})

describe('HireRequests/helpers — formatters', () => {
  it('formats comp bands across min/max combinations', () => {
    expect(formatCompBand({ comp_min: null, comp_max: null })).toBeNull()
    expect(formatCompBand({ comp_min: 30, comp_max: 50 })).toMatch(/^₹30.50 LPA$/)
    expect(formatCompBand({ comp_min: 30, comp_max: null })).toBe('₹30+ LPA')
    expect(formatCompBand({ comp_min: null, comp_max: 50 })).toBe('up to ₹50 LPA')
  })

  it('formats experience ranges across min/max combinations', () => {
    expect(formatExperience({ experience_min: null, experience_max: null })).toBeNull()
    expect(formatExperience({ experience_min: 2, experience_max: 5 })).toMatch(/^2.5 yrs$/)
    expect(formatExperience({ experience_min: 2, experience_max: null })).toBe('2+ yrs')
    expect(formatExperience({ experience_min: null, experience_max: 5 })).toBe('up to 5 yrs')
  })
})
