import { describe, expect, it } from 'vitest'
import { buildQuestion } from '../src/lib/quiz'
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
