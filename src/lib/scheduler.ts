/** SM-2-lite spaced-repetition scheduler. Pure functions, unit-tested.
 *
 *  Four grades map to SM-2 quality q: Again=1, Hard=3, Good=4, Easy=5.
 *  q < 3 (Again) is the lapse path: reps reset, relearn tomorrow.
 *  Otherwise interval steps 1d → 6d → round(interval × ease); ease adapts
 *  per card so harder cards come back sooner. */
import type { Grade, ReviewState } from './types'

export const DAY_MS = 86_400_000
const HISTORY_CAP = 20
const Q: Record<Grade, number> = { 0: 1, 1: 3, 2: 4, 3: 5 }

export function newReviewState(id: string): ReviewState {
  return {
    id,
    ease: 2.5,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    dueAt: 0,
    lastReviewedAt: null,
    introduced: false,
    timesSeen: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    bestStreak: 0,
    avgResponseMs: 0,
    confusionLog: [],
    history: [],
  }
}

export function startOfDay(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfDay(now: number): number {
  return startOfDay(now) + DAY_MS - 1
}

export interface GradeOptions {
  responseMs?: number
  confusedWithId?: string
}

/** Apply a grade, returning a new ReviewState (never mutates the input). */
export function grade(
  state: ReviewState,
  g: Grade,
  now: number,
  opts: GradeOptions = {},
): ReviewState {
  const q = Q[g]
  const wasIntroduced = state.introduced
  const s: ReviewState = { ...state, history: state.history.slice(), confusionLog: state.confusionLog.slice() }

  s.introduced = true
  s.timesSeen += 1
  s.lastReviewedAt = now

  if (q < 3) {
    s.reps = 0
    s.intervalDays = 1
    if (wasIntroduced) s.lapses += 1 // only count forgetting after first learning
    s.streak = 0
    s.incorrect += 1
    if (opts.confusedWithId) {
      s.confusionLog.push(opts.confusedWithId)
      if (s.confusionLog.length > HISTORY_CAP) s.confusionLog = s.confusionLog.slice(-HISTORY_CAP)
    }
  } else {
    if (s.reps === 0) s.intervalDays = g === 3 ? 4 : 1 // Easy graduates faster
    else if (s.reps === 1) s.intervalDays = 6
    else s.intervalDays = Math.round(s.intervalDays * s.ease)
    if (g === 1 && s.reps >= 1) s.intervalDays = Math.max(1, Math.round(s.intervalDays * 0.8))
    if (g === 3 && s.reps >= 1) s.intervalDays = Math.max(s.intervalDays + 1, Math.round(s.intervalDays * 1.3))
    s.reps += 1
    s.streak += 1
    s.bestStreak = Math.max(s.bestStreak, s.streak)
    s.correct += 1
  }

  s.ease = s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (s.ease < 1.3) s.ease = 1.3

  s.dueAt = startOfDay(now) + s.intervalDays * DAY_MS

  if (opts.responseMs != null && opts.responseMs > 0) {
    const n = s.timesSeen
    s.avgResponseMs = Math.round((s.avgResponseMs * (n - 1) + opts.responseMs) / n)
  }

  s.history.push({ t: now, grade: g, intervalDays: s.intervalDays })
  if (s.history.length > HISTORY_CAP) s.history = s.history.slice(-HISTORY_CAP)
  return s
}

/** A card is due when it has been introduced and its due date is today or past. */
export function isDue(state: ReviewState | undefined, now: number): boolean {
  return !!state && state.introduced && state.dueAt <= endOfDay(now)
}
