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
/** days: once a card's interval clears the 1d→6d graduating steps it is "settling" */
const SETTLING_INTERVAL = 7
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

// ---- the spaced-repetition plan: forward forecast + learned state ----

export interface Forecast {
  /** counts by day; index 0 = today (INCLUDING all overdue) */
  buckets: number[]
  /** introduced cards due beyond the `days` window */
  overflow: number
  /** cards due tomorrow (= buckets[1]) */
  tomorrow: number
  /** cards due in the next 7 days (days 1–7, excluding today/overdue) */
  next7: number
  /** cards due in the next 30 days (days 1–30, excluding today/overdue) */
  next30: number
}

/** Forward due-date forecast of CURRENTLY-SCHEDULED reviews — "the plan".
 *
 *  Each introduced card is bucketed once at its stored `dueAt` (we never re-simulate
 *  future reviews). Bucketing uses local `startOfDay` so it agrees with `isDue`'s
 *  day math across timezones/DST; overdue cards (negative day index) collapse into
 *  bucket 0, and un-introduced cards are excluded (they have no date schedule —
 *  `newReviewState` leaves `dueAt = 0`). By construction `buckets[0]` equals
 *  `buildReport(...).dueToday`. */
export function buildForecast(
  deck: SignDefinition[],
  reviews: Record<string, ReviewState>,
  now: number,
  days = 14,
): Forecast {
  const today0 = startOfDay(now)
  const buckets = new Array(Math.max(1, days)).fill(0)
  let overflow = 0
  let next7 = 0
  let next30 = 0
  for (const sign of deck) {
    const rs = reviews[sign.id]
    if (!rs || !rs.introduced) continue // not on a date schedule
    // round, not floor: two local midnights are 23h/25h apart across a DST change,
    // so floor would mis-bin by a day; rounding recovers the true calendar gap.
    const idx = Math.round((startOfDay(rs.dueAt) - today0) / DAY_MS)
    const b = idx < 0 ? 0 : idx
    if (b < buckets.length) buckets[b]++
    else overflow++
    if (idx >= 1 && idx <= 7) next7++
    if (idx >= 1 && idx <= 30) next30++
  }
  return { buckets, overflow, tomorrow: buckets[1] ?? 0, next7, next30 }
}

export interface StageCounts {
  newToStart: number
  learning: number
  settling: number
  lockedIn: number
  introducedTotal: number
  /** mean current interval over introduced cards, in days (0 if none) */
  avgGapDays: number
}

/** Disjoint, exhaustive learning-stage breakdown over the in-scope deck — "what
 *  the system has learnt". Classified in priority order so the buckets never
 *  overlap and reconcile with the rest of the Report: new → locked-in
 *  (`isMastered`) → settling (interval ≥ 7d) → learning. A long-interval card
 *  that fails the mastery test is Settling, not Locked-in. Therefore the four
 *  counts sum to `deck.length`, `lockedIn === report.mastered`, and
 *  `introducedTotal === report.introduced`. */
export function classifyStages(
  deck: SignDefinition[],
  reviews: Record<string, ReviewState>,
): StageCounts {
  let newToStart = 0
  let learning = 0
  let settling = 0
  let lockedIn = 0
  let gapSum = 0
  let introduced = 0
  for (const sign of deck) {
    const rs = reviews[sign.id]
    if (!rs || !rs.introduced) {
      newToStart++
      continue
    }
    introduced++
    gapSum += rs.intervalDays
    if (isMastered(rs)) lockedIn++
    else if (rs.intervalDays >= SETTLING_INTERVAL) settling++
    else learning++
  }
  return {
    newToStart,
    learning,
    settling,
    lockedIn,
    introducedTotal: introduced,
    avgGapDays: introduced ? gapSum / introduced : 0,
  }
}

export interface IntervalBucket {
  label: string
  count: number
}

/** Distribution of current scheduling intervals over introduced in-scope cards
 *  — a read-out of memory durability. Buckets partition the number line by upper
 *  bound (first match wins), so every finite interval lands in exactly one and
 *  the counts sum to `report.introduced`. Labelled by interval length only — "due
 *  now" is a schedule fact and lives in the forecast, not here. */
export function intervalHistogram(
  deck: SignDefinition[],
  reviews: Record<string, ReviewState>,
): IntervalBucket[] {
  const defs: [string, (d: number) => boolean][] = [
    ['1 day or less', (d) => d < 2],
    ['2-6 days', (d) => d < 7],
    ['1-3 weeks', (d) => d < 21],
    ['3-8 weeks', (d) => d < 60],
    ['2 months+', () => true],
  ]
  const counts = new Array(defs.length).fill(0)
  for (const sign of deck) {
    const rs = reviews[sign.id]
    if (!rs || !rs.introduced) continue
    const i = defs.findIndex(([, test]) => test(rs.intervalDays))
    if (i >= 0) counts[i]++
  }
  return defs.map(([label], i) => ({ label, count: counts[i] }))
}

/** Plain-English lede for the Report: one line on what's been learnt, one on the
 *  plan. Pure and plural-safe; deliberately free of SR jargon (no "ease"/"interval"). */
export function sentenceForPlan(
  forecast: Forecast,
  stages: StageCounts,
  report: Report,
): string[] {
  const n = (count: number) => `${count} ${count === 1 ? 'sign' : 'signs'}`
  const out: string[] = []

  // what the system has learnt
  if (stages.lockedIn > 0) {
    const bedding = stages.learning + stages.settling
    out.push(
      `${n(stages.lockedIn)} ${stages.lockedIn === 1 ? 'is' : 'are'} now in long-term memory` +
        (bedding > 0 ? `, with ${bedding} more bedding in.` : '.'),
    )
  } else if (report.introduced > 0) {
    out.push(`You've started ${n(report.introduced)} — keep going and they'll start locking in.`)
  }

  // the plan
  const dueNow = forecast.buckets[0] ?? 0
  if (dueNow > 0) {
    out.push(
      `${dueNow} due to review now` +
        (forecast.next7 > 0 ? `, with ${forecast.next7} more in the next 7 days.` : '.'),
    )
  } else {
    const nextIdx = forecast.buckets.findIndex((c, i) => i >= 1 && c > 0)
    if (nextIdx === 1) out.push(`You're all caught up — nothing due until tomorrow.`)
    else if (nextIdx > 1) out.push(`You're all caught up — nothing due for ${nextIdx} days.`)
    else if (forecast.overflow > 0)
      out.push(`You're all caught up — nothing due for the next ${forecast.buckets.length} days.`)
    else out.push(`You're all caught up.`)
  }
  return out
}
