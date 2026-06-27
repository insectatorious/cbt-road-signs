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

/** Pick a replacement sign for the *current* quiz slot when the learner flips the
 *  direction toggle mid-question. Flipping the same sign would turn the art (or caption)
 *  already on screen into one of the four options — i.e. reveal the answer — so we move a
 *  sign the learner hasn't seen into the slot before re-presenting it in the new direction.
 *
 *  Prefers an unseen sign still ahead in the queue (swapped in, so the skipped one stays
 *  in rotation); failing that, pulls a fresh sign from the deck; failing that (the deck is
 *  exhausted — everything's been seen) returns the queue unchanged, since no reveal-free
 *  choice exists and at that size it's moot. Pure — never mutates its inputs. */
export function repickCurrentSlot(
  queue: string[],
  index: number,
  seen: Set<string>,
  deck: SignDefinition[],
): string[] {
  const ahead = queue.findIndex((id, j) => j > index && !seen.has(id))
  if (ahead !== -1) {
    const next = queue.slice()
    ;[next[index], next[ahead]] = [next[ahead], next[index]]
    return next
  }
  const queued = new Set(queue)
  const fresh = deck.find((s) => !seen.has(s.id) && !queued.has(s.id))
  if (fresh) {
    const next = queue.slice()
    next[index] = fresh.id
    return next
  }
  return queue
}
