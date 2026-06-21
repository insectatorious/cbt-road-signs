import { describe, expect, it } from 'vitest'
import { newReviewState } from '../src/lib/scheduler'
import {
  buildReport,
  isMastered,
  rankCards,
  struggleScore,
} from '../src/lib/stats'
import type { ReviewState, SignDefinition } from '../src/lib/types'

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
