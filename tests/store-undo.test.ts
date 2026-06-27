import { beforeEach, describe, expect, it } from 'vitest'
import {
  store,
  SIGNS,
  gradeRecall,
  gradeQuiz,
  undoLastGrade,
  canUndoGrade,
  resetProgress,
  reviewFor,
} from '../src/lib/store.svelte'

const ID = SIGNS[0].id

function clone(v: unknown) {
  return JSON.parse(JSON.stringify(v))
}

describe('undoLastGrade — single-step undo of the most recent grade', () => {
  beforeEach(() => resetProgress())

  it('reverts a brand-new card: review entry, session record, and pace baseline', () => {
    expect(reviewFor(ID)).toBeUndefined()
    expect(store.pace.study).toBeUndefined()
    expect(canUndoGrade()).toBe(false)

    gradeRecall(ID, true, 1500)
    expect(reviewFor(ID)?.introduced).toBe(true)
    expect(store.sessions.at(-1)).toMatchObject({ reviewed: 1, correct: 1, newSeen: 1 })
    expect(typeof store.pace.study).toBe('number')
    expect(canUndoGrade()).toBe(true)

    expect(undoLastGrade()).toBe(true)
    expect(reviewFor(ID)).toBeUndefined() // entry was new → removed entirely
    expect(store.sessions.at(-1)).toBeUndefined() // the record we created is popped
    expect(store.pace.study).toBeUndefined() // baseline reverted
    expect(canUndoGrade()).toBe(false)
    expect(undoLastGrade()).toBe(false) // single-step: nothing left to undo
  })

  it('reverts only the latest grade, restoring the prior review state on a re-grade', () => {
    gradeRecall(ID, true, 1500)
    const afterFirst = clone(reviewFor(ID))
    const sessionAfterFirst = clone(store.sessions.at(-1))

    gradeRecall(ID, false, 4000) // a second grade on the same card (missed)
    expect(clone(reviewFor(ID))).not.toEqual(afterFirst)

    expect(undoLastGrade()).toBe(true)
    expect(clone(reviewFor(ID))).toEqual(afterFirst) // restored, not deleted
    expect(clone(store.sessions.at(-1))).toEqual(sessionAfterFirst) // counts rolled back
  })

  it('reverts a wrong quiz answer without touching the quiz pace (only correct updates it)', () => {
    gradeRecall(ID, true, 1500) // introduce the card first
    const quizPaceBefore = store.pace.quiz
    const reviewBefore = clone(reviewFor(ID))

    gradeQuiz(ID, false, 3000, SIGNS[1].id)
    expect(clone(reviewFor(ID))).not.toEqual(reviewBefore)

    expect(undoLastGrade()).toBe(true)
    expect(clone(reviewFor(ID))).toEqual(reviewBefore)
    expect(store.pace.quiz).toBe(quizPaceBefore)
  })

  it('does nothing after a reset (no stale snapshot resurrecting a wiped review)', () => {
    gradeRecall(ID, true, 1500)
    resetProgress()
    expect(canUndoGrade()).toBe(false)
    expect(undoLastGrade()).toBe(false)
    expect(reviewFor(ID)).toBeUndefined()
  })

  it('undoing a correct quiz answer reverts the quiz pace baseline it updated', () => {
    gradeRecall(ID, true, 1500) // introduce the card (updates the *study* pace only)
    const quizPaceBefore = store.pace.quiz

    gradeQuiz(ID, true, 2500) // correct → updates the quiz pace baseline
    expect(store.pace.quiz).not.toBe(quizPaceBefore)

    expect(undoLastGrade()).toBe(true)
    expect(store.pace.quiz).toBe(quizPaceBefore)
  })

  it('only pops the record this grade created, leaving an earlier day intact', () => {
    // a leftover record from a previous day (recordSession keys by today's date)
    store.sessions.push({ date: '2000-01-01', reviewed: 5, correct: 3, newSeen: 2 })

    gradeRecall(ID, true, 1500) // creates today's record (date differs from the last one)
    expect(store.sessions).toHaveLength(2)

    expect(undoLastGrade()).toBe(true)
    expect(store.sessions).toHaveLength(1) // today's record popped…
    expect(store.sessions[0]).toEqual({ date: '2000-01-01', reviewed: 5, correct: 3, newSeen: 2 }) // …earlier day untouched
  })
})
