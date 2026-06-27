import { describe, expect, it } from 'vitest'
import { activeDeck, buildStudyQueue, sortReference } from '../src/lib/deck'
import { newReviewState } from '../src/lib/scheduler'
import { DEFAULT_SETTINGS, type ReviewState, type Settings, type SignDefinition } from '../src/lib/types'

function sign(id: string, tier: SignDefinition['tier'], extra: Partial<SignDefinition> = {}): SignDefinition {
  return {
    id,
    caption: id,
    category: 'warning',
    tier,
    enabled: tier !== 'edge',
    shape: 'triangle',
    colour: '',
    asset: '',
    explanation: '',
    confusedWith: [],
    searchTerms: [],
    ...extra,
  }
}

const deck: SignDefinition[] = [
  sign('c1', 'core'),
  sign('s1', 'standard'),
  sign('e1', 'edge'),
  sign('mw', 'core', { category: 'motorway' }), // motorway — opt-in, off by default
  sign('mark', 'standard', { category: 'marking' }),
]

const withScope = (deckScope: Settings['deckScope'], includeMarkings = true): Settings => ({
  ...DEFAULT_SETTINGS,
  deckScope,
  includeMarkings,
})

describe('activeDeck — deck-scope slider', () => {
  it('essential = core tier only', () => {
    const ids = activeDeck(deck, withScope('essential')).map((s) => s.id)
    expect(ids).toContain('c1')
    expect(ids).not.toContain('s1')
    expect(ids).not.toContain('e1')
  })

  it('standard adds the standard tier but never edge', () => {
    const ids = activeDeck(deck, withScope('standard')).map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(['c1', 's1', 'mark']))
    expect(ids).not.toContain('e1')
  })

  it('comprehensive includes every tier', () => {
    const ids = activeDeck(deck, withScope('comprehensive')).map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(['c1', 's1', 'e1', 'mark']))
  })

  it('the scope widens monotonically (each stage is a superset)', () => {
    const ess = activeDeck(deck, withScope('essential')).length
    const std = activeDeck(deck, withScope('standard')).length
    const all = activeDeck(deck, withScope('comprehensive')).length
    expect(ess).toBeLessThan(std)
    expect(std).toBeLessThan(all)
  })

  it('excludes motorway by default at every scope (opt-in module)', () => {
    for (const scope of ['essential', 'standard', 'comprehensive'] as const) {
      expect(activeDeck(deck, withScope(scope)).map((s) => s.id)).not.toContain('mw')
    }
  })

  it('includes motorway only when includeMotorway is on, independent of scope', () => {
    for (const scope of ['essential', 'standard', 'comprehensive'] as const) {
      const ids = activeDeck(deck, { ...withScope(scope), includeMotorway: true }).map((s) => s.id)
      expect(ids).toContain('mw') // appears even at the narrowest scope — orthogonal to the slider
    }
  })

  it('markings are gated by their own toggle, orthogonal to scope', () => {
    expect(activeDeck(deck, withScope('comprehensive', false)).map((s) => s.id)).not.toContain('mark')
    expect(activeDeck(deck, withScope('comprehensive', true)).map((s) => s.id)).toContain('mark')
  })
})

describe('buildStudyQueue — shuffle across categories', () => {
  const fresh: SignDefinition[] = [
    sign('p1', 'core', { category: 'prohibitory' }),
    sign('m1', 'core', { category: 'mandatory' }),
    sign('w1', 'core', { category: 'warning' }),
    sign('i1', 'standard', { category: 'information' }),
  ]

  it('introduces new cards in category/importance order by default', () => {
    const ids = buildStudyQueue(fresh, {}, 10, 0, false).ids
    // CATEGORY_META order: prohibitory < mandatory < warning < information
    expect(ids).toEqual(['p1', 'm1', 'w1', 'i1'])
  })

  it('shuffled keeps the same set of new cards (order may differ)', () => {
    const plain = buildStudyQueue(fresh, {}, 10, 0, false).ids
    const shuf = buildStudyQueue(fresh, {}, 10, 0, true).ids
    expect([...shuf].sort()).toEqual([...plain].sort()) // permutation of the same ids
    expect(shuf).toHaveLength(plain.length)
  })

  it('respects newPerDay when shuffling', () => {
    const q = buildStudyQueue(fresh, {}, 2, 0, true)
    expect(q.ids).toHaveLength(2)
    expect(q.newCount).toBe(2)
  })
})

describe('buildStudyQueue — reviewCap on the due backlog', () => {
  // an introduced, due review with an explicit dueAt so most-overdue ordering is deterministic
  function dueReview(id: string, dueAt: number): ReviewState {
    return { ...newReviewState(id), introduced: true, dueAt }
  }

  // 6 due cards: d1 has dueAt -6 (smallest ⇒ most overdue) … d6 has -1 (least overdue)
  const deck6: SignDefinition[] = Array.from({ length: 6 }, (_, i) => sign(`d${i + 1}`, 'core'))
  const reviews6: Record<string, ReviewState> = Object.fromEntries(
    deck6.map((s, i) => [s.id, dueReview(s.id, -(6 - i))]),
  )

  it('uncapped by default — every due card is surfaced', () => {
    const q = buildStudyQueue(deck6, reviews6, 0, 0)
    expect(q.dueCount).toBe(6)
    expect(q.dueDeferred).toBe(0)
    expect(q.ids).toHaveLength(6)
  })

  it('caps the due portion and reports the deferred remainder', () => {
    const q = buildStudyQueue(deck6, reviews6, 0, 0, false, 4)
    expect(q.dueCount).toBe(4)
    expect(q.dueDeferred).toBe(2)
    expect(q.ids).toHaveLength(4)
  })

  it('keeps the most-overdue cards when capping', () => {
    // dueAt -6 (d1) is most overdue … -1 (d6) least; a cap of 2 keeps d1, d2
    const q = buildStudyQueue(deck6, reviews6, 0, 0, false, 2)
    expect(q.ids).toEqual(['d1', 'd2'])
    expect(q.dueDeferred).toBe(4)
  })

  it('never exceeds reviewCap due + newPerDay new cards', () => {
    const freshSigns: SignDefinition[] = [sign('n1', 'core'), sign('n2', 'core'), sign('n3', 'core')]
    const q = buildStudyQueue([...deck6, ...freshSigns], reviews6, 2, 0, false, 3)
    expect(q.dueCount).toBe(3)
    expect(q.newCount).toBe(2)
    expect(q.ids).toHaveLength(5)
    expect(q.dueDeferred).toBe(3)
  })

  it('a cap at or above the backlog defers nothing', () => {
    const q = buildStudyQueue(deck6, reviews6, 0, 0, false, 10)
    expect(q.dueCount).toBe(6)
    expect(q.dueDeferred).toBe(0)
  })
})

describe('sortReference', () => {
  const signs = [sign('a', 'core'), sign('b', 'core'), sign('c', 'core')]
  const intro = (o: Partial<ReviewState>): ReviewState => ({
    ...newReviewState('x'),
    introduced: true,
    ...o,
  })

  it("'default' preserves the incoming order and returns a new array", () => {
    const out = sortReference(signs, {}, 'default')
    expect(out.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(signs)
  })

  it("'seen' orders by timesSeen desc, unreviewed last", () => {
    const reviews: Record<string, ReviewState> = { a: intro({ timesSeen: 2 }), b: intro({ timesSeen: 9 }) }
    expect(sortReference(signs, reviews, 'seen').map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })

  it("'worst' orders by struggle desc, parking unseen cards last", () => {
    const reviews: Record<string, ReviewState> = {
      a: intro({ timesSeen: 5, correct: 5, ease: 2.6 }), // solid
      b: intro({ timesSeen: 5, correct: 1, ease: 1.4, lapses: 4 }), // struggling
    }
    expect(sortReference(signs, reviews, 'worst').map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })

  it("'due' orders by soonest dueAt, new cards last", () => {
    const reviews: Record<string, ReviewState> = { a: intro({ dueAt: 200 }), b: intro({ dueAt: 100 }) }
    expect(sortReference(signs, reviews, 'due').map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })

  it("'mastered' puts mastered cards first", () => {
    const reviews: Record<string, ReviewState> = {
      a: intro({ timesSeen: 2, correct: 1, intervalDays: 2 }),
      b: intro({ timesSeen: 6, correct: 6, intervalDays: 30, lapses: 0 }), // mastered
    }
    expect(sortReference(signs, reviews, 'mastered').map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })
})
