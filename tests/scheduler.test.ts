import { describe, expect, it } from 'vitest'
import {
  DAY_MS,
  endOfDay,
  grade,
  isDue,
  newReviewState,
  relearn,
  startOfDay,
} from '../src/lib/scheduler'
import type { ReviewState } from '../src/lib/types'

const NOW = new Date('2026-06-20T10:00:00').getTime()

describe('relearn', () => {
  it('resets a leech to a fresh, floor-eased, not-yet-introduced card', () => {
    const r = relearn('x')
    expect(r.id).toBe('x')
    expect(r.ease).toBe(1.3) // pinned to the floor — known-hard, comes back often
    expect(r.reps).toBe(0)
    expect(r.lapses).toBe(0)
    expect(r.introduced).toBe(false) // reintroduced → re-enters the queue as a new card
    expect(r.timesSeen).toBe(0)
    expect(isDue(r, NOW)).toBe(false) // not introduced ⇒ not "due", it's new
  })
})

describe('newReviewState', () => {
  it('starts un-introduced with default ease', () => {
    const s = newReviewState('x')
    expect(s.ease).toBe(2.5)
    expect(s.introduced).toBe(false)
    expect(s.intervalDays).toBe(0)
    expect(s.timesSeen).toBe(0)
  })
})

describe('grade — correct path', () => {
  it('Good on a new card schedules 1 day and keeps ease', () => {
    const s = grade(newReviewState('x'), 2, NOW)
    expect(s.reps).toBe(1)
    expect(s.intervalDays).toBe(1)
    expect(s.ease).toBeCloseTo(2.5, 5)
    expect(s.correct).toBe(1)
    expect(s.streak).toBe(1)
    expect(s.introduced).toBe(true)
    expect(s.dueAt).toBe(startOfDay(NOW) + DAY_MS)
  })

  it('three Goods step 1 → 6 → 15 days', () => {
    let s = grade(newReviewState('x'), 2, NOW)
    s = grade(s, 2, NOW)
    expect(s.intervalDays).toBe(6)
    s = grade(s, 2, NOW)
    expect(s.intervalDays).toBe(15) // round(6 * 2.5)
    expect(s.reps).toBe(3)
  })

  it('Easy raises ease, Hard lowers it', () => {
    expect(grade(newReviewState('x'), 3, NOW).ease).toBeCloseTo(2.6, 5)
    expect(grade(newReviewState('x'), 1, NOW).ease).toBeCloseTo(2.36, 5)
  })

  it('does not mutate the input state', () => {
    const before = newReviewState('x')
    const snapshot = JSON.stringify(before)
    grade(before, 2, NOW)
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe('grade — lapse path', () => {
  it('Again on a new card resets but does not count a lapse', () => {
    const s = grade(newReviewState('x'), 0, NOW)
    expect(s.reps).toBe(0)
    expect(s.intervalDays).toBe(1)
    expect(s.lapses).toBe(0) // never learned → not a lapse
    expect(s.incorrect).toBe(1)
    expect(s.streak).toBe(0)
  })

  it('Again after learning counts a lapse and resets streak', () => {
    let s = grade(newReviewState('x'), 2, NOW) // learn
    s = grade(s, 2, NOW)
    s = grade(s, 0, NOW) // forget
    expect(s.lapses).toBe(1)
    expect(s.reps).toBe(0)
    expect(s.streak).toBe(0)
  })

  it('ease never drops below 1.3', () => {
    let s = newReviewState('x')
    for (let i = 0; i < 10; i++) s = grade(s, 0, NOW)
    expect(s.ease).toBe(1.3)
  })

  it('logs the chosen distractor on a quiz miss', () => {
    const s = grade(newReviewState('x'), 0, NOW, { confusedWithId: 'other' })
    expect(s.confusionLog).toEqual(['other'])
  })
})

describe('isDue', () => {
  it('is false for un-introduced cards', () => {
    expect(isDue(newReviewState('x'), NOW)).toBe(false)
  })
  it('is false for a card due tomorrow, true once overdue', () => {
    const due: ReviewState = { ...newReviewState('x'), introduced: true, dueAt: endOfDay(NOW) + 1 }
    expect(isDue(due, NOW)).toBe(false)
    const overdue: ReviewState = { ...due, dueAt: startOfDay(NOW) - DAY_MS }
    expect(isDue(overdue, NOW)).toBe(true)
  })
})
