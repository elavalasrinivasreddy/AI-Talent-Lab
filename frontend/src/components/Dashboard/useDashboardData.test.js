import { describe, it, expect } from 'vitest'
import { SUGGESTION_META, PULSE_EVENT_META } from './useDashboardData'

// These metadata maps drive lane icons/colors across the v3 dashboard. The hook
// itself is async/effect-heavy (covered by E2E); here we lock down the pure
// metadata contracts so a malformed entry can't ship a broken card silently.

const VALID_KINDS = new Set(['bad', 'warn', 'ok'])

describe('useDashboardData — SUGGESTION_META', () => {
  it('every entry has icon, kind and color', () => {
    for (const [type, meta] of Object.entries(SUGGESTION_META)) {
      expect(meta.icon, `${type}.icon`).toBeTruthy()
      expect(meta.color, `${type}.color`).toBeTruthy()
      expect(VALID_KINDS.has(meta.kind), `${type}.kind=${meta.kind}`).toBe(true)
    }
  })

  it('exposes a default fallback entry', () => {
    expect(SUGGESTION_META.default).toBeDefined()
    expect(SUGGESTION_META.default.icon).toBeTruthy()
  })
})

describe('useDashboardData — PULSE_EVENT_META', () => {
  it('every entry has icon, kind and color', () => {
    for (const [type, meta] of Object.entries(PULSE_EVENT_META)) {
      expect(meta.icon, `${type}.icon`).toBeTruthy()
      expect(meta.color, `${type}.color`).toBeTruthy()
      expect(VALID_KINDS.has(meta.kind), `${type}.kind=${meta.kind}`).toBe(true)
    }
  })

  it('exposes a default fallback entry', () => {
    expect(PULSE_EVENT_META.default).toBeDefined()
    expect(PULSE_EVENT_META.default.icon).toBeTruthy()
  })
})
