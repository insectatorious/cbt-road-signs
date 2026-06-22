// Force a DST-observing timezone so these tests deterministically exercise the
// 23h / 25h day-length edge cases regardless of the host machine's clock.
// (Node honours a runtime TZ reassignment for Dates created afterwards; the
// sanity test below fails loudly if that ever stops being true.)
process.env.TZ = 'Europe/London'

import { describe, expect, it } from 'vitest'
import { DAY_MS, endOfDay, newReviewState, startOfDay } from '../src/lib/scheduler'
import { buildForecast, buildReport, windowedRetention } from '../src/lib/stats'
import type { ReviewState, SignDefinition } from '../src/lib/types'

const HOUR = 3_600_000

function rs(id: string, o: Partial<ReviewState>): ReviewState {
  return { ...newReviewState(id), introduced: true, timesSeen: 1, correct: 1, ...o }
}
function sign(id: string): SignDefinition {
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
  }
}

describe('DST day boundaries (Europe/London)', () => {
  it('sanity: the timezone override is in effect (23h/25h days)', () => {
    const fallBack = new Date('2025-10-26T12:00:00').getTime() // 25h day
    expect(endOfDay(fallBack) - startOfDay(fallBack)).toBe(25 * HOUR - 1)
    const springFwd = new Date('2025-03-30T12:00:00').getTime() // 23h day
    expect(endOfDay(springFwd) - startOfDay(springFwd)).toBe(23 * HOUR - 1)
  })

  it('spring-forward: a day-1 card is not folded into today, and bucket0 === dueToday', () => {
    const now = new Date('2025-03-30T12:00:00').getTime()
    const deck = [sign('a')]
    const reviews = { a: rs('a', { dueAt: startOfDay(new Date('2025-03-31T12:00:00').getTime()) }) }
    const f = buildForecast(deck, reviews, now)
    const rep = buildReport(deck, reviews, [], now)
    expect(f.buckets[0]).toBe(0)
    expect(f.buckets[1]).toBe(1)
    expect(f.buckets[0]).toBe(rep.dueToday)
  })

  it('fall-back: a card due in the extra 25th hour still counts as due today', () => {
    const now = new Date('2025-10-26T15:00:00').getTime()
    // grade() shape startOfDay(prevDay) + N*DAY_MS lands at 23:00 local on the 26th
    const dueAt = startOfDay(new Date('2025-10-25T12:00:00').getTime()) + 2 * DAY_MS
    expect(startOfDay(dueAt)).toBe(startOfDay(now)) // genuinely the same calendar day
    const deck = [sign('a')]
    const reviews = { a: rs('a', { dueAt }) }
    const f = buildForecast(deck, reviews, now)
    const rep = buildReport(deck, reviews, [], now)
    expect(rep.dueToday).toBe(1)
    expect(f.buckets[0]).toBe(1)
    expect(f.buckets[0]).toBe(rep.dueToday)
  })

  it('windowedRetention keeps a review a fixed 24h×N window would wrongly drop after fall-back', () => {
    // 14 calendar days before now spans the 25h fall-back day, so the true window
    // reaches back to 2025-10-19T12:00 local; a hard 14*DAY_MS offset stops an hour
    // short (12:00 UTC vs 11:00 UTC), excluding a review from that boundary hour.
    const now = new Date('2025-11-02T12:00:00').getTime()
    const ev = new Date('2025-10-19T12:30:00').getTime() // inside the calendar window only
    const reviews = { a: rs('a', { history: [{ t: ev, grade: 2, intervalDays: 2 }] }) }
    expect(windowedRetention(reviews, now, 14, 1)).toBe(1) // included → 100%, not null
  })
})
