import { describe, expect, it } from 'vitest'
import { activeDeck, buildStudyQueue } from '../src/lib/deck'
import { DEFAULT_SETTINGS, type Settings, type SignDefinition } from '../src/lib/types'

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
  sign('mw', 'core', { excludeFromV1: true }), // motorway — never in scope
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

  it('always excludes motorway (excludeFromV1) at every scope', () => {
    for (const scope of ['essential', 'standard', 'comprehensive'] as const) {
      expect(activeDeck(deck, withScope(scope)).map((s) => s.id)).not.toContain('mw')
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
