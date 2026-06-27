import { describe, expect, it } from 'vitest'
import {
  applyMigrations,
  exportJSON,
  FutureSchemaError,
  importJSON,
  migrate,
} from '../src/lib/persistence'

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

  it('coerces missing or non-numeric session counts to 0', () => {
    const m = migrate(
      {
        sessions: [
          { date: '2026-06-01' }, // counts absent entirely
          { date: '2026-06-02', reviewed: 'x', correct: null, newSeen: Number.NaN },
          { date: '2026-06-03', reviewed: 5, correct: 4, newSeen: 3 },
        ],
      },
      NOW,
    )
    // a NaN newSeen here previously flowed into the Report's new-card budget math
    expect(m.sessions).toHaveLength(3)
    expect(m.sessions[0]).toEqual({ date: '2026-06-01', reviewed: 0, correct: 0, newSeen: 0 })
    expect(m.sessions[1].newSeen).toBe(0)
    expect(Number.isFinite(m.sessions[1].reviewed)).toBe(true)
    expect(m.sessions[2]).toEqual({ date: '2026-06-03', reviewed: 5, correct: 4, newSeen: 3 })
  })

  it('clamps an out-of-range imported newPerDay', () => {
    expect(migrate({ settings: { newPerDay: -5 } }, NOW).settings.newPerDay).toBeGreaterThanOrEqual(1)
    expect(migrate({ settings: { newPerDay: 9999 } }, NOW).settings.newPerDay).toBeLessThanOrEqual(100)
  })

  it('clamps an out-of-range imported reviewCap and defaults a missing one', () => {
    expect(migrate({ settings: { reviewCap: 0 } }, NOW).settings.reviewCap).toBeGreaterThanOrEqual(5)
    expect(migrate({ settings: { reviewCap: 9999 } }, NOW).settings.reviewCap).toBeLessThanOrEqual(500)
    expect(migrate({ settings: {} }, NOW).settings.reviewCap).toBe(50)
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

  it('defaults shuffleCategories off and coerces it to a boolean', () => {
    expect(migrate({}, NOW).settings.shuffleCategories).toBe(false)
    expect(migrate({ settings: { shuffleCategories: true } }, NOW).settings.shuffleCategories).toBe(true)
    expect(migrate({ settings: { shuffleCategories: 'yes' } }, NOW).settings.shuffleCategories).toBe(false)
  })

  it('defaults bookmarks to an empty array when absent', () => {
    expect(migrate({}, NOW).bookmarks).toEqual([])
    expect(migrate({ bookmarks: 'not-an-array' }, NOW).bookmarks).toEqual([])
  })

  it('keeps string bookmark ids, dropping non-strings, blanks and duplicates', () => {
    const m = migrate({ bookmarks: ['give-way', 'stop', 'give-way', '', 7, null, true] }, NOW)
    expect(m.bookmarks).toEqual(['give-way', 'stop'])
  })

  it('caps a runaway bookmarks array', () => {
    const huge = Array.from({ length: 450 }, (_, i) => `sign-${i}`)
    expect(migrate({ bookmarks: huge }, NOW).bookmarks).toHaveLength(400)
  })

  it('round-trips bookmarks through export/import', () => {
    const shape = migrate({ bookmarks: ['a', 'b'] }, NOW)
    const restored = importJSON(exportJSON(shape), NOW)
    expect(restored.bookmarks).toEqual(['a', 'b'])
  })
})

describe('schema migration ladder', () => {
  it('runs an example v1 -> v2 transform before the coercion pass', () => {
    // a hypothetical v2 that renamed `newPerDay` -> would be reshaped here
    const ladder = {
      1: (d: Record<string, unknown>) => ({
        ...d,
        schemaVersion: 2,
        settings: { ...(d.settings as object), newPerDay: 7 },
      }),
    }
    const out = applyMigrations({ schemaVersion: 1, settings: { newPerDay: 3 } }, 1, 2, ladder)
    expect(out.schemaVersion).toBe(2)
    expect((out.settings as { newPerDay: number }).newPerDay).toBe(7)
  })

  it('chains steps in version order v1 -> v2 -> v3', () => {
    const trail: number[] = []
    const ladder = {
      1: (d: Record<string, unknown>) => {
        trail.push(1)
        return { ...d, a: 1 }
      },
      2: (d: Record<string, unknown>) => {
        trail.push(2)
        return { ...d, b: 2 }
      },
    }
    const out = applyMigrations({}, 1, 3, ladder)
    expect(trail).toEqual([1, 2]) // applied in order, not skipping
    expect(out).toMatchObject({ a: 1, b: 2 })
  })

  it('skips a version gap that has no registered step', () => {
    const out = applyMigrations({ x: 1 }, 1, 3, { 2: (d) => ({ ...d, y: 2 }) })
    expect(out).toEqual({ x: 1, y: 2 })
  })
})

describe('migrate() branches on schemaVersion', () => {
  it('treats a missing / legacy schemaVersion as v1', () => {
    const m = migrate({ settings: { newPerDay: 5 } }, NOW)
    expect(m.schemaVersion).toBe(1)
    expect(m.settings.newPerDay).toBe(5)
  })

  it('importJSON rejects a backup newer than this build supports', () => {
    const future = JSON.stringify({ schemaVersion: 999, reviews: {} })
    expect(() => importJSON(future, NOW)).toThrow(FutureSchemaError)
  })

  it('the load path coerces a future shape best-effort rather than throwing', () => {
    // a downgraded app must never wipe real data just because the blob is newer
    const m = migrate({ schemaVersion: 999, settings: { newPerDay: 9 } }, NOW)
    expect(m.schemaVersion).toBe(1)
    expect(m.settings.newPerDay).toBe(9)
  })
})
