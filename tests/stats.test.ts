import { describe, expect, it } from 'vitest'
import { DAY_MS, newReviewState, startOfDay } from '../src/lib/scheduler'
import {
  accuracyVerdict,
  buildForecast,
  buildReport,
  canRecallUnaided,
  classifyStages,
  coachAction,
  daysSinceStart,
  intervalHistogram,
  isMastered,
  rankCards,
  recallReadiness,
  sentenceForPlan,
  struggleScore,
  windowedRetention,
} from '../src/lib/stats'
import type { ReviewEvent, ReviewState, SignDefinition } from '../src/lib/types'

const NOW = new Date('2026-06-20T10:00:00').getTime()

function rs(id: string, o: Partial<ReviewState>): ReviewState {
  return { ...newReviewState(id), introduced: true, timesSeen: 1, ...o }
}

function sign(id: string, o: Partial<SignDefinition> = {}): SignDefinition {
  return {
    id,
    caption: id,
    category: 'warning',
    tier: 'core',
    enabled: true,
    shape: 'triangle',
    colour: '',
    asset: '',
    explanation: '',
    confusedWith: [],
    searchTerms: [],
    ...o,
  }
}

describe('struggleScore', () => {
  it('ranks a weak card above a strong one', () => {
    const strong = rs('a', { timesSeen: 5, correct: 5, ease: 2.5 })
    const weak = rs('b', { timesSeen: 5, correct: 1, ease: 1.5, lapses: 3 })
    expect(struggleScore(weak)).toBeGreaterThan(struggleScore(strong))
  })
})

describe('isMastered', () => {
  it('requires long interval, high accuracy and few lapses', () => {
    expect(isMastered(rs('a', { intervalDays: 21, timesSeen: 6, correct: 6, lapses: 0 }))).toBe(true)
    expect(isMastered(rs('a', { intervalDays: 10, timesSeen: 6, correct: 6, lapses: 0 }))).toBe(false)
    expect(isMastered(rs('a', { intervalDays: 30, timesSeen: 10, correct: 5, lapses: 0 }))).toBe(false)
    expect(isMastered(undefined)).toBe(false)
  })
})

describe('rankCards', () => {
  it('excludes cards below the review threshold and ranks worst first', () => {
    const reviews: Record<string, ReviewState> = {
      good: rs('good', { timesSeen: 5, correct: 5, ease: 2.6 }),
      bad: rs('bad', { timesSeen: 5, correct: 1, ease: 1.4, lapses: 4 }),
      thin: rs('thin', { timesSeen: 1, correct: 0, ease: 1.3 }), // too few reviews
    }
    const { worst, best } = rankCards(reviews)
    expect(worst[0].id).toBe('bad')
    expect(worst.find((c) => c.id === 'thin')).toBeUndefined()
    expect(best[0].id).toBe('good')
  })

  it('never lists the same card in both best and worst', () => {
    const reviews: Record<string, ReviewState> = {
      a: rs('a', { timesSeen: 4, correct: 2, ease: 1.8, lapses: 1 }),
      b: rs('b', { timesSeen: 4, correct: 3, ease: 2.2, lapses: 0 }),
    }
    const { worst, best } = rankCards(reviews)
    const worstIds = new Set(worst.map((c) => c.id))
    expect(best.some((c) => worstIds.has(c.id))).toBe(false)
  })
})

describe('buildReport', () => {
  const deck = [
    sign('a', { category: 'warning', tier: 'core' }),
    sign('b', { category: 'warning', tier: 'core' }),
    sign('c', { category: 'prohibitory', tier: 'standard' }),
  ]

  it('summarises accuracy, mastery and per-category coverage', () => {
    const reviews: Record<string, ReviewState> = {
      a: rs('a', { timesSeen: 4, correct: 4, intervalDays: 25, lapses: 0 }), // mastered
      b: rs('b', { timesSeen: 4, correct: 2, intervalDays: 2 }),
    }
    const report = buildReport(deck, reviews, [], NOW)
    expect(report.total).toBe(3)
    expect(report.introduced).toBe(2)
    expect(report.mastered).toBe(1)
    expect(report.overallAccuracy).toBeCloseTo((4 + 2) / (4 + 4), 5)
    const warning = report.perCategory.find((c) => c.category === 'warning')!
    expect(warning.total).toBe(2)
    expect(warning.seen).toBe(2)
    expect(warning.mastered).toBe(1)
    expect(report.coreMasteredPct).toBeCloseTo(0.5, 5) // 1 of 2 core mastered
  })

  it('handles an empty history gracefully', () => {
    const report = buildReport(deck, {}, [], NOW)
    expect(report.overallAccuracy).toBeNull()
    expect(report.introduced).toBe(0)
    expect(report.retention).toBeNull()
  })
})

describe('buildForecast', () => {
  const D0 = startOfDay(NOW)
  const deck = [sign('a'), sign('b'), sign('c'), sign('d')]

  it('buckets introduced cards by due date; overdue + today collapse into bucket 0', () => {
    const reviews: Record<string, ReviewState> = {
      a: rs('a', { dueAt: D0 }), // today
      b: rs('b', { dueAt: D0 - 3 * DAY_MS }), // overdue
      c: rs('c', { dueAt: D0 + 1 * DAY_MS }), // tomorrow
      d: rs('d', { dueAt: D0 + 20 * DAY_MS }), // beyond the 14-day window
    }
    const f = buildForecast(deck, reviews, NOW)
    expect(f.buckets[0]).toBe(2) // today + overdue
    expect(f.buckets[1]).toBe(1) // tomorrow
    expect(f.tomorrow).toBe(1)
    expect(f.overflow).toBe(1) // d
    expect(f.next7).toBe(1) // only c (day 1)
    expect(f.next30).toBe(2) // c (1) + d (20)
  })

  it('bucket 0 equals report.dueToday (the reconciliation invariant)', () => {
    const reviews: Record<string, ReviewState> = {
      a: rs('a', { dueAt: D0 }),
      b: rs('b', { dueAt: D0 - 3 * DAY_MS }),
      c: rs('c', { dueAt: D0 + 1 * DAY_MS }),
    }
    const f = buildForecast(deck, reviews, NOW)
    const rep = buildReport(deck, reviews, [], NOW)
    expect(f.buckets[0]).toBe(rep.dueToday)
  })

  it('excludes not-yet-introduced cards (the dueAt-0 trap)', () => {
    const f = buildForecast([sign('a'), sign('b')], { a: newReviewState('a') }, NOW)
    expect(f.buckets.every((c) => c === 0)).toBe(true)
    expect(f.overflow).toBe(0)
    expect(f.next30).toBe(0)
  })

  it('window boundary: day 13 is charted, day 14 overflows (days=14)', () => {
    const reviews: Record<string, ReviewState> = {
      a: rs('a', { dueAt: D0 + 13 * DAY_MS }),
      b: rs('b', { dueAt: D0 + 14 * DAY_MS }),
    }
    const f = buildForecast([sign('a'), sign('b')], reviews, NOW, 14)
    expect(f.buckets[13]).toBe(1)
    expect(f.overflow).toBe(1)
  })

  it('uses local startOfDay so a late-evening "tomorrow" still buckets to day 1', () => {
    const LATE = new Date('2026-06-20T23:30:00').getTime()
    const f = buildForecast([sign('a')], { a: rs('a', { dueAt: startOfDay(LATE) + DAY_MS }) }, LATE)
    expect(f.buckets[0]).toBe(0)
    expect(f.buckets[1]).toBe(1)
  })
})

describe('classifyStages', () => {
  const deck = [sign('new1'), sign('l1'), sign('s1'), sign('m1'), sign('mn1')]
  const reviews: Record<string, ReviewState> = {
    l1: rs('l1', { intervalDays: 3 }), // learning (<7d)
    s1: rs('s1', { intervalDays: 10 }), // settling (7–20d)
    m1: rs('m1', { intervalDays: 30, timesSeen: 6, correct: 6, lapses: 0 }), // locked in
    mn1: rs('mn1', { intervalDays: 30, timesSeen: 6, correct: 3, lapses: 0 }), // long but fails mastery
    // new1 has no review → newToStart
  }

  it('is disjoint, exhaustive, and reconciles with the report', () => {
    const st = classifyStages(deck, reviews)
    expect(st.newToStart).toBe(1)
    expect(st.learning).toBe(1)
    expect(st.settling).toBe(2) // s1 + mature-but-not-mastered mn1
    expect(st.lockedIn).toBe(1) // m1
    expect(st.newToStart + st.learning + st.settling + st.lockedIn).toBe(deck.length)
    const rep = buildReport(deck, reviews, [], NOW)
    expect(st.lockedIn).toBe(rep.mastered)
    expect(st.introducedTotal).toBe(rep.introduced)
  })

  it('classifies at the 7-day and 21-day boundaries', () => {
    const mastered = { timesSeen: 6, correct: 6, lapses: 0 }
    expect(classifyStages([sign('x')], { x: rs('x', { intervalDays: 6 }) }).learning).toBe(1)
    expect(classifyStages([sign('x')], { x: rs('x', { intervalDays: 7 }) }).settling).toBe(1)
    expect(classifyStages([sign('x')], { x: rs('x', { intervalDays: 20, ...mastered }) }).settling).toBe(1)
    expect(classifyStages([sign('x')], { x: rs('x', { intervalDays: 21, ...mastered }) }).lockedIn).toBe(1)
  })

  it('avgGapDays is the mean interval over introduced cards (0 when none)', () => {
    expect(classifyStages(deck, reviews).avgGapDays).toBeCloseTo((3 + 10 + 30 + 30) / 4, 5)
    expect(classifyStages([sign('x')], {}).avgGapDays).toBe(0)
  })
})

describe('intervalHistogram', () => {
  it('bins introduced intervals into contiguous buckets that sum to the introduced count', () => {
    const deck = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => sign(id))
    const reviews: Record<string, ReviewState> = {
      a: rs('a', { intervalDays: 0 }),
      b: rs('b', { intervalDays: 1 }),
      c: rs('c', { intervalDays: 6 }),
      d: rs('d', { intervalDays: 7 }),
      e: rs('e', { intervalDays: 21 }),
      f: rs('f', { intervalDays: 60 }),
      g: newReviewState('g'), // not introduced → excluded
    }
    const h = intervalHistogram(deck, reviews)
    const count = (label: string) => h.find((b) => b.label === label)!.count
    expect(count('1 day or less')).toBe(2) // a, b
    expect(count('2-6 days')).toBe(1) // c
    expect(count('1-3 weeks')).toBe(1) // d
    expect(count('3-8 weeks')).toBe(1) // e
    expect(count('2 months+')).toBe(1) // f
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(6) // g excluded
  })

  it('partitions fractional intervals with no gaps (sum stays exact)', () => {
    const deck = ['a', 'b', 'c'].map((id) => sign(id))
    const reviews: Record<string, ReviewState> = {
      a: rs('a', { intervalDays: 1.5 }), // old gap between buckets 0 and 1
      b: rs('b', { intervalDays: 6.5 }), // old gap between buckets 1 and 2
      c: rs('c', { intervalDays: 20.5 }), // old gap between buckets 2 and 3
    }
    const h = intervalHistogram(deck, reviews)
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(3) // none silently dropped
    const count = (label: string) => h.find((b) => b.label === label)!.count
    expect(count('1 day or less')).toBe(1)
    expect(count('2-6 days')).toBe(1)
    expect(count('1-3 weeks')).toBe(1)
  })
})

describe('sentenceForPlan', () => {
  const build = (deck: SignDefinition[], reviews: Record<string, ReviewState>) => {
    const f = buildForecast(deck, reviews, NOW)
    const st = classifyStages(deck, reviews)
    const rep = buildReport(deck, reviews, [], NOW)
    return sentenceForPlan(f, st, rep).join(' ')
  }

  it('is plural-safe for a single locked-in card', () => {
    const s = build([sign('a')], {
      a: rs('a', {
        intervalDays: 30,
        timesSeen: 6,
        correct: 6,
        lapses: 0,
        dueAt: startOfDay(NOW) + 5 * DAY_MS,
      }),
    })
    expect(s).toContain('1 sign is now in long-term memory')
    expect(s).not.toContain('1 signs')
    expect(s).toContain('all caught up')
  })

  it('reports work due now and the early-learning state', () => {
    const s = build([sign('a'), sign('b')], {
      a: rs('a', { dueAt: startOfDay(NOW), intervalDays: 2 }),
      b: rs('b', { dueAt: startOfDay(NOW), intervalDays: 2 }),
    })
    expect(s).toContain("You've started 2 signs")
    expect(s).toContain('2 due to review now')
  })

  it('says "all caught up" with no data', () => {
    expect(build([], {})).toContain('all caught up')
  })

  it('gives a concrete horizon when the only cards are beyond the chart window', () => {
    const s = build([sign('a')], {
      a: rs('a', { intervalDays: 20, dueAt: startOfDay(NOW) + 20 * DAY_MS }),
    })
    expect(s).toContain('all caught up')
    expect(s).toContain('next 14 days') // not the vague "for a while"
  })
})

describe('daysSinceStart', () => {
  it('reads Day 1 on the first day and counts whole days from createdAt', () => {
    expect(daysSinceStart(NOW, [], NOW)).toBe(1)
    expect(daysSinceStart(NOW - 2 * DAY_MS, [], NOW)).toBe(3)
  })

  it('floors at 1 even if createdAt is somehow in the future', () => {
    expect(daysSinceStart(NOW + 5 * DAY_MS, [], NOW)).toBe(1)
  })

  it('trusts the oldest session when createdAt was reset newer than the data', () => {
    // createdAt says "today" but a session from 10 days ago proves longer history
    const sessions = [{ date: '2026-06-10', reviewed: 3, correct: 2, newSeen: 1 }]
    expect(daysSinceStart(NOW, sessions, NOW)).toBe(11) // 2026-06-10 → 2026-06-20 inclusive
  })
})

describe('accuracyVerdict', () => {
  it('maps accuracy bands to plain, jargon-free reads', () => {
    expect(accuracyVerdict(0.95, 5)).toContain('strong')
    expect(accuracyVerdict(0.8, 5)).toContain('good')
    expect(accuracyVerdict(0.65, 5)).toContain('getting there')
    expect(accuracyVerdict(0.4, 5)).toContain('early days')
  })

  it('softens with "so far" in the first 48h, except the already-early band', () => {
    expect(accuracyVerdict(0.8, 1)).toContain('so far')
    expect(accuracyVerdict(0.4, 1)).not.toContain('so far')
  })
})

describe('windowedRetention', () => {
  const ev = (t: number, grade: ReviewEvent['grade']): ReviewEvent => ({ t, grade, intervalDays: 1 })

  it('is the share of in-window reviews graded > 0', () => {
    const reviews = {
      a: rs('a', {
        history: [ev(NOW - DAY_MS, 2), ev(NOW - DAY_MS, 2), ev(NOW - DAY_MS, 0), ev(NOW - DAY_MS, 3)],
      }),
    }
    expect(windowedRetention(reviews, NOW, 30)).toBeCloseTo(3 / 4, 5)
  })

  it('excludes events older than the window', () => {
    const reviews = {
      a: rs('a', { history: [ev(NOW - 2 * DAY_MS, 2), ev(NOW - 40 * DAY_MS, 0)] }),
    }
    expect(windowedRetention(reviews, NOW, 30)).toBe(1) // the 40-day-old miss is out of window
  })

  it('returns null until minEvents reviews fall in the window', () => {
    const reviews = { a: rs('a', { history: [ev(NOW - DAY_MS, 2), ev(NOW - DAY_MS, 2)] }) }
    expect(windowedRetention(reviews, NOW, 30, 8)).toBeNull()
    expect(windowedRetention({}, NOW, 30, 1)).toBeNull()
  })
})

describe('canRecallUnaided / recallReadiness', () => {
  it('needs two looks, a correct last answer, and a solid hit-rate', () => {
    expect(canRecallUnaided(rs('a', { timesSeen: 2, correct: 2, streak: 2 }))).toBe(true)
    expect(canRecallUnaided(rs('a', { timesSeen: 1, correct: 1, streak: 1 }))).toBe(false) // one look
    expect(canRecallUnaided(rs('a', { timesSeen: 2, correct: 2, streak: 0 }))).toBe(false) // just missed
    expect(canRecallUnaided(rs('a', { timesSeen: 2, correct: 1, streak: 1 }))).toBe(false) // 50% hit-rate
    expect(canRecallUnaided(undefined)).toBe(false)
  })

  it('is reachable long before isMastered (which needs ~3 weeks)', () => {
    const fresh = rs('a', { intervalDays: 1, timesSeen: 2, correct: 2, streak: 2, lapses: 0 })
    expect(canRecallUnaided(fresh)).toBe(true)
    expect(isMastered(fresh)).toBe(false)
  })

  it('counts only in-scope core signs', () => {
    const deck = [
      sign('a', { tier: 'core' }),
      sign('b', { tier: 'core' }),
      sign('c', { tier: 'standard' }),
    ]
    const reviews = {
      a: rs('a', { timesSeen: 2, correct: 2, streak: 2 }), // ready core
      b: rs('b', { timesSeen: 2, correct: 0, streak: 0 }), // not ready core
      c: rs('c', { timesSeen: 2, correct: 2, streak: 2 }), // ready but standard → ignored
    }
    expect(recallReadiness(deck, reviews)).toEqual({ ready: 1, coreTotal: 2 })
  })
})

describe('coachAction', () => {
  const base = { introduced: 5, dueNow: 0, tomorrow: 0, next7: 0, newAvailable: 0, newRemainingToday: 0 }

  it('tells a brand-new learner to start', () => {
    const a = coachAction({ ...base, introduced: 0 })
    expect(a.mode).toBe('start')
    expect(a.cta).toEqual({ label: 'Start studying', route: 'study' })
  })

  it('leads with review when something is due, and forecasts tomorrow', () => {
    const a = coachAction({ ...base, dueNow: 3, tomorrow: 2 })
    expect(a.mode).toBe('review')
    expect(a.heading).toBe('3 signs ready to review')
    expect(a.cta).toEqual({ label: 'Review 3 now', route: 'study' })
    expect(a.forward).toBe('Then 2 more land tomorrow.')
  })

  it('is plural-safe for a single due/tomorrow sign', () => {
    const a = coachAction({ ...base, dueNow: 1, tomorrow: 1 })
    expect(a.heading).toBe('1 sign ready to review')
    expect(a.forward).toBe('Then 1 more lands tomorrow.')
  })

  it('offers new cards when nothing is due, capped by today\'s budget', () => {
    const a = coachAction({ ...base, dueNow: 0, newAvailable: 9, newRemainingToday: 4 })
    expect(a.mode).toBe('learn')
    expect(a.cta).toEqual({ label: 'Learn 4 new', route: 'study' })
  })

  it('is caught-up when due and new are both exhausted, and points at the reference', () => {
    const deckDone = coachAction({ ...base, dueNow: 0, newAvailable: 0 })
    expect(deckDone.mode).toBe('caught-up')
    expect(deckDone.sub).toContain('met every sign')
    expect(deckDone.cta).toEqual({ label: 'Browse the reference', route: 'browse' })

    const budgetHit = coachAction({ ...base, dueNow: 0, newAvailable: 9, newRemainingToday: 0 })
    expect(budgetHit.mode).toBe('caught-up')
    expect(budgetHit.sub).toContain("today's new signs")
  })
})
