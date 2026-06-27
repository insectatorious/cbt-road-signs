/** Multiple-choice quiz: question generation. (Grading lives in pace.ts/store.) */
import type { SignDefinition } from './types'

export interface QuizQuestion {
  sign: SignDefinition
  options: SignDefinition[]
  answerIndex: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Build a 4-option question. Distractors come from look-alike signs first
 *  (confusedWith), then the same category, then anywhere — so every question
 *  drills genuine confusions. Options never repeat a caption.
 *
 *  Direction-agnostic: the same question drives both quiz modes — "name the sign"
 *  shows the sign and offers caption options; "spot the sign" shows the caption
 *  and offers sign-image options. Only the view's presentation differs. */
export function buildQuestion(
  sign: SignDefinition,
  deck: SignDefinition[],
  byId: Map<string, SignDefinition>,
): QuizQuestion {
  const distractors: SignDefinition[] = []
  const usedCaptions = new Set([sign.caption])
  const inDeck = new Set(deck.map((d) => d.id))
  const add = (s: SignDefinition | undefined): void => {
    if (s && !usedCaptions.has(s.caption)) {
      usedCaptions.add(s.caption)
      distractors.push(s)
    }
  }

  for (const id of sign.confusedWith) {
    if (distractors.length >= 3) break
    const d = byId.get(id)
    // Opt-in modules (e.g. motorway) shouldn't surface as distractors when they're
    // not in the active deck — never quiz a non-motorway card with a motorway answer.
    if (d && d.category === 'motorway' && !inDeck.has(id)) continue
    add(d)
  }
  for (const s of shuffle(deck.filter((d) => d.category === sign.category))) {
    if (distractors.length >= 3) break
    add(s)
  }
  for (const s of shuffle(deck)) {
    if (distractors.length >= 3) break
    add(s)
  }

  const options = shuffle([sign, ...distractors.slice(0, 3)])
  return { sign, options, answerIndex: options.indexOf(sign) }
}
