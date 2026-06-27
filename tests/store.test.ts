import { beforeEach, describe, expect, it } from 'vitest'
import {
  store,
  SIGNS,
  gradeRecall,
  gradeQuiz,
  resetProgress,
  reviewFor,
  toggleBookmark,
  isBookmarked,
  setSetting,
  exportData,
  importData,
} from '../src/lib/store.svelte'
import { DEFAULT_SETTINGS } from '../src/lib/types'

const ID = SIGNS[0].id
const ID2 = SIGNS[1].id

/** A full reset: resetProgress() deliberately KEEPS bookmarks/settings/pace, so
 *  clear those too for an isolated starting point each test. */
function freshStore() {
  resetProgress()
  store.bookmarks = []
  store.settings = { ...DEFAULT_SETTINGS }
  store.pace = { study: undefined, quiz: undefined }
  store.lastBackupAt = undefined
  store.backupNudgeDismissedAt = undefined
}

describe('store grade mutations', () => {
  beforeEach(freshStore)

  it('gradeRecall updates the review, session log, and study-pace baseline', () => {
    expect(reviewFor(ID)).toBeUndefined()
    expect(store.pace.study).toBeUndefined()

    gradeRecall(ID, true, 1500)

    expect(reviewFor(ID)?.introduced).toBe(true)
    expect(reviewFor(ID)?.timesSeen).toBe(1)
    expect(store.sessions.at(-1)).toMatchObject({ reviewed: 1, correct: 1, newSeen: 1 })
    expect(typeof store.pace.study).toBe('number') // EMA seeded from the first correct recall
  })

  it('a wrong quiz answer counts a review but no correct, and leaves the quiz pace untouched', () => {
    gradeRecall(ID, true, 1000) // introduce the card (touches study pace only)
    const quizPaceBefore = store.pace.quiz

    gradeQuiz(ID, false, 3000, ID2)

    const s = store.sessions.at(-1)
    expect(s).toMatchObject({ reviewed: 2, correct: 1 }) // reviewed++ but not correct on a miss
    expect(store.pace.quiz).toBe(quizPaceBefore) // only correct answers move the quiz baseline
  })

  it('a correct quiz answer updates the quiz-pace baseline', () => {
    gradeRecall(ID, true, 1000)
    expect(store.pace.quiz).toBeUndefined()
    gradeQuiz(ID, true, 2500)
    expect(typeof store.pace.quiz).toBe('number')
  })
})

describe('resetProgress', () => {
  beforeEach(freshStore)

  it('wipes reviews + sessions and restarts the clock, but keeps bookmarks and settings', () => {
    setSetting('newPerDay', 17)
    toggleBookmark(ID)
    gradeRecall(ID, true, 1500)
    const createdBefore = store.createdAt
    expect(Object.keys(store.reviews)).toHaveLength(1)
    expect(store.sessions.length).toBeGreaterThan(0)

    resetProgress()

    expect(store.reviews).toEqual({}) // progress wiped
    expect(store.sessions).toEqual([])
    expect(store.createdAt).toBeGreaterThanOrEqual(createdBefore) // day-N clock restarted
    expect(isBookmarked(ID)).toBe(true) // curation kept
    expect(store.settings.newPerDay).toBe(17) // preferences kept
  })
})

describe('bookmarks', () => {
  beforeEach(freshStore)

  it('toggleBookmark adds then removes a saved id', () => {
    expect(isBookmarked(ID)).toBe(false)
    toggleBookmark(ID)
    expect(isBookmarked(ID)).toBe(true)
    expect(store.bookmarks).toContain(ID)
    toggleBookmark(ID)
    expect(isBookmarked(ID)).toBe(false)
  })
})

describe('export / import', () => {
  beforeEach(freshStore)

  it('round-trips reviews, settings, and the pace baseline through export → import', () => {
    setSetting('newPerDay', 23)
    gradeRecall(ID, true, 1500)
    const paceBefore = store.pace.study
    const json = exportData()

    // mutate the live store, then restore from the snapshot
    setSetting('newPerDay', 7)
    resetProgress()
    expect(reviewFor(ID)).toBeUndefined()

    expect(importData(json)).toBe(true)
    expect(store.settings.newPerDay).toBe(23)
    expect(store.pace.study).toBe(paceBefore)
    expect(reviewFor(ID)?.introduced).toBe(true)
  })

  it('prunes orphan review + bookmark ids that no longer match a known sign', () => {
    gradeRecall(ID, true, 1500)
    toggleBookmark(ID)
    const obj = JSON.parse(exportData())
    obj.reviews['__ghost_review__'] = { id: '__ghost_review__', introduced: true }
    obj.bookmarks.push('__ghost_bookmark__')

    expect(importData(JSON.stringify(obj))).toBe(true)

    expect(store.reviews['__ghost_review__']).toBeUndefined() // orphan review dropped
    expect(reviewFor(ID)?.introduced).toBe(true) // the real one survives
    expect(store.bookmarks).not.toContain('__ghost_bookmark__') // orphan bookmark dropped
    expect(isBookmarked(ID)).toBe(true)
  })

  it('returns false (and leaves state intact) for an unreadable file', () => {
    gradeRecall(ID, true, 1500)
    expect(importData('}{ not json')).toBe(false)
    expect(reviewFor(ID)?.introduced).toBe(true) // unchanged
  })
})
