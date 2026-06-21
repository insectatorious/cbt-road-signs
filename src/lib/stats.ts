/** Performance metrics: per-card struggle/mastery + aggregate report. Pure. */
import {
  CATEGORY_META,
  type ReviewState,
  type SessionRecord,
  type SignCategory,
  type SignDefinition,
} from './types'
import { DAY_MS, isDue, startOfDay } from './scheduler'

const MIN_REVIEWS_FOR_RANK = 3
const MASTERY_INTERVAL = 21
const RETENTION_WINDOW_DAYS = 30

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function accuracyOf(rs: ReviewState | undefined): number | null {
  return rs && rs.timesSeen ? rs.correct / rs.timesSeen : null
}

export function isMastered(rs: ReviewState | undefined): boolean {
  if (!rs || !rs.timesSeen) return false
  return rs.intervalDays >= MASTERY_INTERVAL && rs.correct / rs.timesSeen >= 0.9 && rs.lapses <= 1
}

/** 0 = solid, 1 = struggling. Blends accuracy, ease and lapses. */
export function struggleScore(rs: ReviewState): number {
  const acc = rs.timesSeen ? rs.correct / rs.timesSeen : 0
  const easeNorm = clamp((rs.ease - 1.3) / (2.7 - 1.3), 0, 1)
  return (1 - acc) * 0.6 + (1 - easeNorm) * 0.25 + (Math.min(rs.lapses, 5) / 5) * 0.15
}

function mode(arr: string[]): string | undefined {
  if (!arr.length) return undefined
  const counts = new Map<string, number>()
  let best: string | undefined
  let bestN = 0
  for (const x of arr) {
    const n = (counts.get(x) ?? 0) + 1
    counts.set(x, n)
    if (n > bestN) {
      bestN = n
      best = x
    }
  }
  return best
}

export interface RankedCard {
  id: string
  accuracy: number
  lapses: number
  ease: number
  timesSeen: number
  intervalDays: number
  struggle: number
  topConfusion?: string
}

function toRanked(rs: ReviewState): RankedCard {
  return {
    id: rs.id,
    accuracy: rs.timesSeen ? rs.correct / rs.timesSeen : 0,
    lapses: rs.lapses,
    ease: rs.ease,
    timesSeen: rs.timesSeen,
    intervalDays: rs.intervalDays,
    struggle: struggleScore(rs),
    topConfusion: mode(rs.confusionLog),
  }
}

export function rankCards(
  reviews: Record<string, ReviewState>,
  n = 8,
): { worst: RankedCard[]; best: RankedCard[] } {
  const eligible = Object.values(reviews).filter((r) => r.timesSeen >= MIN_REVIEWS_FOR_RANK)
  const worst = [...eligible]
    .sort((a, b) => struggleScore(b) - struggleScore(a))
    .filter((r) => struggleScore(r) > 0.12)
    .slice(0, n)
    .map(toRanked)
  // keep the two lists disjoint — a card can't be both "needs work" and "strongest"
  const worstIds = new Set(worst.map((c) => c.id))
  const best = [...eligible]
    .filter((r) => !worstIds.has(r.id))
    .sort((a, b) => struggleScore(a) - struggleScore(b) || b.intervalDays - a.intervalDays)
    .slice(0, n)
    .map(toRanked)
  return { worst, best }
}

export interface CategoryStat {
  category: SignCategory
  label: string
  total: number
  seen: number
  mastered: number
  struggling: number
  accuracy: number | null
}

export interface Report {
  overallAccuracy: number | null
  totalReviews: number
  dueToday: number
  introduced: number
  total: number
  mastered: number
  retention: number | null
  studyStreakDays: number
  perCategory: CategoryStat[]
  coreMasteredPct: number
}

function retention(reviews: Record<string, ReviewState>, now: number): number | null {
  const cutoff = now - RETENTION_WINDOW_DAYS * DAY_MS
  let remembered = 0
  let total = 0
  for (const rs of Object.values(reviews)) {
    for (const ev of rs.history) {
      if (ev.t >= cutoff) {
        total++
        if (ev.grade > 0) remembered++ // anything but "Again" = recalled
      }
    }
  }
  return total ? remembered / total : null
}

function studyStreak(sessions: SessionRecord[], now: number): number {
  const active = new Set(sessions.filter((s) => s.reviewed > 0).map((s) => s.date))
  if (!active.size) return 0
  let streak = 0
  let day = startOfDay(now)
  const fmt = (t: number) => {
    const d = new Date(t)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  // allow the streak to count even if today isn't done yet (start from yesterday)
  if (!active.has(fmt(day))) day -= DAY_MS
  while (active.has(fmt(day))) {
    streak++
    day -= DAY_MS
  }
  return streak
}

export function buildReport(
  deck: SignDefinition[],
  reviews: Record<string, ReviewState>,
  sessions: SessionRecord[],
  now: number,
): Report {
  let totalReviews = 0
  let totalCorrect = 0
  let introduced = 0
  let mastered = 0
  let dueToday = 0

  const cats = new Map<SignCategory, CategoryStat>()
  let coreTotal = 0
  let coreMastered = 0

  for (const sign of deck) {
    const rs = reviews[sign.id]
    let cat = cats.get(sign.category)
    if (!cat) {
      cat = {
        category: sign.category,
        label: CATEGORY_META[sign.category].label,
        total: 0,
        seen: 0,
        mastered: 0,
        struggling: 0,
        accuracy: null,
      }
      cats.set(sign.category, cat)
    }
    cat.total++
    if (sign.tier === 'core') coreTotal++

    if (rs?.introduced) {
      introduced++
      cat.seen++
      totalReviews += rs.timesSeen
      totalCorrect += rs.correct
      const acc = rs.timesSeen ? rs.correct / rs.timesSeen : 0
      cat.accuracy = (cat.accuracy ?? 0) + acc
      if (isMastered(rs)) {
        mastered++
        cat.mastered++
        if (sign.tier === 'core') coreMastered++
      } else if (rs.timesSeen >= MIN_REVIEWS_FOR_RANK && struggleScore(rs) > 0.3) {
        cat.struggling++
      }
    }
    if (isDue(rs, now)) dueToday++
  }

  // turn summed accuracy into a mean per category
  const perCategory = [...cats.values()]
    .map((c) => ({ ...c, accuracy: c.seen ? (c.accuracy ?? 0) / c.seen : null }))
    .sort((a, b) => CATEGORY_META[a.category].order - CATEGORY_META[b.category].order)

  return {
    overallAccuracy: totalReviews ? totalCorrect / totalReviews : null,
    totalReviews,
    dueToday,
    introduced,
    total: deck.length,
    mastered,
    retention: retention(reviews, now),
    studyStreakDays: studyStreak(sessions, now),
    perCategory,
    coreMasteredPct: coreTotal ? coreMastered / coreTotal : 0,
  }
}
