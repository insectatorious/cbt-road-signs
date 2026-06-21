/** Deck filtering + daily study-queue construction. */
import {
  CATEGORY_META,
  SCOPE_TIERS,
  type ReviewState,
  type Settings,
  type SignDefinition,
  type Tier,
} from './types'
import { isDue } from './scheduler'

const TIER_RANK: Record<Tier, number> = { core: 0, standard: 1, edge: 2 }

/** Signs in scope for the current settings. The deck-scope slider sets the tier
 *  breadth for ordinary road signs; the markings and motorway modules are
 *  orthogonal opt-in toggles (motorway is opt-in because it's beyond CBT scope). */
export function activeDeck(signs: SignDefinition[], settings: Settings): SignDefinition[] {
  const tiers = SCOPE_TIERS[settings.deckScope] ?? SCOPE_TIERS.standard
  return signs.filter((s) => {
    if (s.category === 'motorway') return settings.includeMotorway // opt-in, independent of scope
    if (s.category === 'marking' && !settings.includeMarkings) return false
    return tiers.includes(s.tier)
  })
}

/** Introduction order for new cards: most important first. */
export function introOrder(a: SignDefinition, b: SignDefinition): number {
  return (
    TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
    CATEGORY_META[a.category].order - CATEGORY_META[b.category].order ||
    a.caption.localeCompare(b.caption)
  )
}

/** Fisher–Yates shuffle (returns a new array; used for cross-category mixing). */
function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function interleave(due: string[], fresh: string[]): string[] {
  if (!fresh.length) return due
  if (!due.length) return fresh
  const out: string[] = []
  const gap = Math.max(1, Math.floor(due.length / fresh.length))
  let fi = 0
  for (let i = 0; i < due.length; i++) {
    out.push(due[i])
    if ((i + 1) % gap === 0 && fi < fresh.length) out.push(fresh[fi++])
  }
  while (fi < fresh.length) out.push(fresh[fi++])
  return out
}

export interface QueueInfo {
  ids: string[]
  dueCount: number
  newCount: number
}

/** Build today's queue: due reviews (most overdue first) interleaved with up to
 *  newPerDay never-seen cards in importance order. */
export function buildStudyQueue(
  deck: SignDefinition[],
  reviews: Record<string, ReviewState>,
  newPerDay: number,
  now: number,
  shuffleNew = false,
): QueueInfo {
  const dueStates: ReviewState[] = []
  const fresh: SignDefinition[] = []
  for (const sign of deck) {
    const rs = reviews[sign.id]
    if (rs?.introduced) {
      if (isDue(rs, now)) dueStates.push(rs)
    } else {
      fresh.push(sign)
    }
  }
  dueStates.sort((a, b) => a.dueAt - b.dueAt)
  // default: introduce new cards in importance (tier→category) order, which groups
  // them by category. shuffleNew mixes categories by taking a random selection.
  const orderedFresh = shuffleNew ? shuffled(fresh) : fresh.slice().sort(introOrder)
  const dueIds = dueStates.map((r) => r.id)
  const newIds = orderedFresh.slice(0, Math.max(0, newPerDay)).map((s) => s.id)
  return { ids: interleave(dueIds, newIds), dueCount: dueIds.length, newCount: newIds.length }
}

/** Count of due reviews only (for the nav badge / report). */
export function dueCount(
  deck: SignDefinition[],
  reviews: Record<string, ReviewState>,
  now: number,
): number {
  let n = 0
  for (const sign of deck) if (isDue(reviews[sign.id], now)) n++
  return n
}
