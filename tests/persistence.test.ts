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

  it('normalises partial review entries so they can never crash the app', () => {
    // a partial review (from an old/hand-edited backup) missing the array fields
    const m = migrate({ reviews: { 'no-entry': { id: 'no-entry', timesSeen: 3, ease: Number.NaN } } }, NOW)
    const r = m.reviews['no-entry']
    expect(Array.isArray(r.history)).toBe(true) // would be `undefined` → crash without sanitising
    expect(Array.isArray(r.confusionLog)).toBe(true)
    expect(r.timesSeen).toBe(3)
    expect(Number.isFinite(r.ease)).toBe(true) // NaN coerced to a finite default
  })

  it('drops non-object reviews and malformed session entries', () => {
    const m = migrate(
      {
        reviews: { bad: null, ok: { id: 'ok' } },
        sessions: [null, 'x', { reviewed: 2 }, { date: '2026-06-01', reviewed: 2, correct: 1, newSeen: 1 }],
      },
      NOW,
    )
    expect(m.reviews.bad).toBeUndefined()
    expect(m.reviews.ok).toBeTruthy()
    expect(m.sessions).toHaveLength(1) // only the well-formed, dated record survives
    expect(m.sessions[0].date).toBe('2026-06-01')
  })

  it('clamps an out-of-range imported newPerDay', () => {
    expect(migrate({ settings: { newPerDay: -5 } }, NOW).settings.newPerDay).toBeGreaterThanOrEqual(1)
    expect(migrate({ settings: { newPerDay: 9999 } }, NOW).settings.newPerDay).toBeLessThanOrEqual(100)
  })

  it('defaults deckScope to standard and ignores junk values', () => {
    expect(migrate({}, NOW).settings.deckScope).toBe('standard')
    expect(migrate({ settings: { deckScope: 'everything' } }, NOW).settings.deckScope).toBe('standard')
  })

  it('keeps a valid deckScope', () => {
    expect(migrate({ settings: { deckScope: 'comprehensive' } }, NOW).settings.deckScope).toBe('comprehensive')
    expect(migrate({ settings: { deckScope: 'essential' } }, NOW).settings.deckScope).toBe('essential')
  })

  it('migrates the legacy includeEdge boolean to a deckScope', () => {
    // pre-slider backups only had includeEdge: true ⇒ comprehensive, false ⇒ standard
    expect(migrate({ settings: { includeEdge: true } }, NOW).settings.deckScope).toBe('comprehensive')
    expect(migrate({ settings: { includeEdge: false } }, NOW).settings.deckScope).toBe('standard')
    // an explicit deckScope wins over the legacy field
    expect(
      migrate({ settings: { includeEdge: true, deckScope: 'essential' } }, NOW).settings.deckScope,
    ).toBe('essential')
  })

  it('does not persist the legacy includeEdge field forward', () => {
    const s = migrate({ settings: { includeEdge: true } }, NOW).settings as Record<string, unknown>
    expect('includeEdge' in s).toBe(false)
  })
})
