import { describe, expect, it } from 'vitest'
import { migrate } from '../src/lib/persistence'

const NOW = 1_700_000_000_000

describe('migrate', () => {
  it('keeps valid adaptive-pace baselines', () => {
    const m = migrate({ meta: { studyPaceMs: 1800, quizPaceMs: 4200 } }, NOW)
    expect(m.meta.studyPaceMs).toBe(1800)
    expect(m.meta.quizPaceMs).toBe(4200)
  })

  it('drops corrupt pace baselines (0 / NaN / negative) to undefined', () => {
    const m = migrate({ meta: { studyPaceMs: 0, quizPaceMs: Number.NaN } }, NOW)
    expect(m.meta.studyPaceMs).toBeUndefined()
    expect(m.meta.quizPaceMs).toBeUndefined()
    const n = migrate({ meta: { studyPaceMs: -5 } }, NOW)
    expect(n.meta.studyPaceMs).toBeUndefined()
  })

  it('always yields a clean shape, even from garbage', () => {
    const m = migrate('not an object', NOW)
    expect(m.reviews).toEqual({})
    expect(Array.isArray(m.sessions)).toBe(true)
    expect(m.schemaVersion).toBe(1)
  })

  it('keeps known reviews and defaults settings', () => {
    const m = migrate({ reviews: { 'no-entry': { id: 'no-entry' } } }, NOW)
    expect(m.reviews['no-entry']).toBeTruthy()
    expect(m.settings.newPerDay).toBeGreaterThan(0)
  })
})
