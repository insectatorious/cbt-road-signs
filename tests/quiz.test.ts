import { describe, expect, it } from 'vitest'
import { buildQuestion, repickCurrentSlot } from '../src/lib/quiz'
import { signs } from '../src/data/signs'
import type { SignDefinition } from '../src/lib/types'

function sign(id: string, confusedWith: string[] = []): SignDefinition {
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
    confusedWith,
    searchTerms: [],
  }
}

const deck = [
  sign('no-entry', ['no-motor-vehicles']),
  sign('no-motor-vehicles', ['no-entry']),
  sign('give-way'),
  sign('stop'),
  sign('roundabout'),
  sign('crossroads'),
]
const byId = new Map(deck.map((s) => [s.id, s]))

describe('buildQuestion', () => {
  it('produces four unique options including the correct answer', () => {
    const q = buildQuestion(byId.get('no-entry')!, deck, byId)
    expect(q.options).toHaveLength(4)
    expect(q.options[q.answerIndex].id).toBe('no-entry')
    const captions = q.options.map((o) => o.caption)
    expect(new Set(captions).size).toBe(4) // no duplicates
  })

  it('prefers look-alike signs as distractors', () => {
    const q = buildQuestion(byId.get('no-entry')!, deck, byId)
    expect(q.options.some((o) => o.id === 'no-motor-vehicles')).toBe(true)
  })

  // The reverse "spot the sign" mode reuses the exact same build, but renders the
  // options as sign IMAGES — so they must be four *distinct signs* (not just
  // distinct captions) or two cells would show identical artwork.
  it('yields four distinct signs for the reverse "spot the sign" mode', () => {
    const q = buildQuestion(byId.get('no-entry')!, deck, byId)
    expect(new Set(q.options.map((o) => o.id)).size).toBe(4)
    expect(q.options[q.answerIndex].id).toBe('no-entry') // the answer is still a real sign to render
    expect(q.options.some((o) => o.id === 'no-motor-vehicles')).toBe(true) // look-alike-first holds either direction
  })
})

// Flipping the direction toggle mid-question must re-present the slot with a sign the
// learner hasn't seen — otherwise the art/caption already on screen becomes one of the
// four options (the answer is revealed). This is the logic behind the user-visible fix:
// before, the toggle deferred to the *next* question and so looked completely inert.
describe('repickCurrentSlot (direction-flip on an unanswered question)', () => {
  const q = ['a', 'b', 'c', 'd']

  it('swaps an unseen sign ahead into the current slot, keeping the skipped one in rotation', () => {
    const seen = new Set(['a']) // only the current (slot 0) sign has been shown
    const next = repickCurrentSlot(q, 0, seen, deck)
    expect(next[0]).not.toBe('a') // the on-screen sign is gone — no reveal
    expect(seen.has(next[0])).toBe(false) // its replacement is genuinely unseen
    expect(next.slice().sort()).toEqual(q.slice().sort()) // same multiset — 'a' stays queued
    expect(next).not.toBe(q) // pure: a new array, input untouched
    expect(q[0]).toBe('a')
  })

  it('never re-shows an already-seen sign across repeated flips', () => {
    // flip, flip, flip — each time the new current must be one the learner hasn't seen
    let queue = q
    const seen = new Set([queue[0]])
    for (let i = 0; i < 3; i++) {
      queue = repickCurrentSlot(queue, 0, seen, deck)
      expect(seen.has(queue[0])).toBe(false)
      seen.add(queue[0]) // setQuestion() records each freshly-presented sign
    }
  })

  it('falls back to a fresh deck sign when nothing unseen remains ahead in the queue', () => {
    const queue = ['a', 'b']
    const seen = new Set(['a', 'b']) // both queued signs already shown
    const next = repickCurrentSlot(queue, 0, seen, deck)
    expect(next[0]).not.toBe('a')
    expect(seen.has(next[0])).toBe(false)
    expect(deck.some((s) => s.id === next[0])).toBe(true) // pulled from the deck
    // setReverse decides whether a flip took effect by reference identity (`next !== queue`),
    // so the fresh-deck branch — like the swap branch — MUST return a new array. A
    // mutate-in-place refactor would silently re-break the inert-toggle bug 1.12.1 fixed.
    expect(next).not.toBe(queue)
    expect(queue).toEqual(['a', 'b']) // input untouched (pure)
  })

  it('never returns a sign outside the supplied pool (the "Drill these" focus contract)', () => {
    // In a focus session the pool is restricted to the drilled signs, so when the queue
    // holds the whole pool there is nothing reveal-free to pull — it must defer (return the
    // same instance) rather than inject a sign that isn't part of the drill.
    const focusPool = deck.slice(0, 2) // the only signs allowed in this drill
    const queue = focusPool.map((s) => s.id)
    const seen = new Set(queue)
    expect(repickCurrentSlot(queue, 0, seen, focusPool)).toBe(queue)
  })

  it('leaves the queue unchanged when the deck is exhausted (no reveal-free choice exists)', () => {
    const queue = deck.map((s) => s.id)
    const seen = new Set(queue) // every sign has been seen
    expect(repickCurrentSlot(queue, 0, seen, deck)).toBe(queue)
  })
})

describe('reverse-mode artwork is distinguishable', () => {
  // buildQuestion guarantees four distinct *signs* by caption, but "spot the sign"
  // renders them as images — so two enabled signs sharing the same bundled SVG would
  // put visually identical cells in one grid. This guards the real content (today
  // every sign has unique artwork) against a future edit reintroducing a duplicate.
  it('no two enabled signs share the same bundled SVG asset', () => {
    const seen = new Map<string, string>()
    for (const s of signs) {
      if (!s.enabled || s.composite || !s.asset) continue
      const owner = seen.get(s.asset)
      expect(owner, `${s.id} reuses ${s.asset} already used by ${owner}`).toBeUndefined()
      seen.set(s.asset, s.id)
    }
  })
})
