/** Versioned localStorage persistence. Never throws to the UI:
 *  corrupt data is backed up and replaced with a fresh store. */
import {
  DEFAULT_SETTINGS,
  SCOPE_TIERS,
  type DeckScope,
  type ReviewState,
  type SessionRecord,
  type Settings,
} from './types'
import { newReviewState } from './scheduler'

const KEY = 'cbt-signs:v1'
const SCHEMA_VERSION = 1
const SESSION_CAP = 120
const BOOKMARK_CAP = 400

export interface PersistShape {
  schemaVersion: number
  reviews: Record<string, ReviewState>
  settings: Settings
  sessions: SessionRecord[]
  /** ids of signs the learner has saved (a hand-curated study list, not progress) */
  bookmarks: string[]
  meta: {
    createdAt: number
    lastOpenedAt: number
    /** EMA of correct-recall latency (ms), per mode — for adaptive grading. */
    studyPaceMs?: number
    quizPaceMs?: number
    /** Backup-nudge bookkeeping (epoch ms). */
    lastBackupAt?: number
    backupNudgeDismissedAt?: number
  }
}

function fresh(now: number): PersistShape {
  return {
    schemaVersion: SCHEMA_VERSION,
    reviews: {},
    settings: { ...DEFAULT_SETTINGS },
    sessions: [],
    bookmarks: [],
    meta: { createdAt: now, lastOpenedAt: now },
  }
}

/** Accept a value only if it's a finite positive number, else drop it. */
function finitePos(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Normalise each review to a COMPLETE, well-typed ReviewState. A partial,
 *  old, or hand-edited backup (missing the history/confusionLog arrays, NaN
 *  numbers, non-object entries) must never reach the scheduler/stats — those
 *  iterate/slice these fields and would crash and then wedge the app. */
function sanitizeReviews(raw: unknown): Record<string, ReviewState> {
  const out: Record<string, ReviewState> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const v = value as Partial<ReviewState>
    const base = newReviewState(id)
    out[id] = {
      id,
      ease: num(v.ease, base.ease),
      intervalDays: num(v.intervalDays, base.intervalDays),
      reps: num(v.reps, base.reps),
      lapses: num(v.lapses, base.lapses),
      dueAt: num(v.dueAt, base.dueAt),
      lastReviewedAt: typeof v.lastReviewedAt === 'number' && Number.isFinite(v.lastReviewedAt) ? v.lastReviewedAt : base.lastReviewedAt,
      introduced: typeof v.introduced === 'boolean' ? v.introduced : base.introduced,
      timesSeen: num(v.timesSeen, base.timesSeen),
      correct: num(v.correct, base.correct),
      incorrect: num(v.incorrect, base.incorrect),
      streak: num(v.streak, base.streak),
      bestStreak: num(v.bestStreak, base.bestStreak),
      avgResponseMs: num(v.avgResponseMs, base.avgResponseMs),
      confusionLog: Array.isArray(v.confusionLog) ? v.confusionLog : base.confusionLog,
      history: Array.isArray(v.history) ? v.history : base.history,
    }
  }
  return out
}

function sanitizeSessions(raw: unknown): SessionRecord[] {
  if (!Array.isArray(raw)) return []
  const out: SessionRecord[] = []
  for (const s of raw) {
    if (!s || typeof s !== 'object' || typeof (s as SessionRecord).date !== 'string') continue
    const r = s as Partial<SessionRecord>
    // coerce the counts so a missing/NaN field from an old or hand-edited backup
    // can never reach the report/stats math (mirrors sanitizeReviews)
    out.push({
      date: r.date as string,
      reviewed: num(r.reviewed, 0),
      correct: num(r.correct, 0),
      newSeen: num(r.newSeen, 0),
    })
  }
  return out.slice(-SESSION_CAP)
}

/** Coerce bookmarks to a clean, de-duped, capped list of non-empty string ids.
 *  Ids are NOT validated against the sign set here — persistence has no access to
 *  it; the store prunes orphaned ids on load (as it does for reviews). */
function sanitizeBookmarks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  for (const v of raw) {
    if (typeof v === 'string' && v) seen.add(v)
  }
  return [...seen].slice(-BOOKMARK_CAP)
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

/** Resolve the deck-scope slider, migrating the old `includeEdge` boolean
 *  (true ⇒ comprehensive, false ⇒ standard) from pre-slider backups. */
function coerceScope(r: Record<string, unknown>): DeckScope {
  if (typeof r.deckScope === 'string' && r.deckScope in SCOPE_TIERS) return r.deckScope as DeckScope
  if (typeof r.includeEdge === 'boolean') return r.includeEdge ? 'comprehensive' : 'standard'
  return DEFAULT_SETTINGS.deckScope
}

function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    newPerDay: Math.min(100, Math.max(1, Math.round(num(r.newPerDay, DEFAULT_SETTINGS.newPerDay)))),
    reviewCap: Math.min(500, Math.max(5, Math.round(num(r.reviewCap, DEFAULT_SETTINGS.reviewCap)))),
    deckScope: coerceScope(r),
    includeMarkings: bool(r.includeMarkings, DEFAULT_SETTINGS.includeMarkings),
    includeMotorway: bool(r.includeMotorway, DEFAULT_SETTINGS.includeMotorway),
    showCategoryHint: bool(r.showCategoryHint, DEFAULT_SETTINGS.showCategoryHint),
    shuffleCategories: bool(r.shuffleCategories, DEFAULT_SETTINGS.shuffleCategories),
  }
}

/** Coerce arbitrary parsed data into the current shape (+ run migrations). */
export function migrate(data: unknown, now: number): PersistShape {
  const base = fresh(now)
  if (!data || typeof data !== 'object') return base
  const d = data as Partial<PersistShape>
  return {
    schemaVersion: SCHEMA_VERSION,
    reviews: sanitizeReviews(d.reviews),
    settings: sanitizeSettings(d.settings),
    sessions: sanitizeSessions(d.sessions),
    bookmarks: sanitizeBookmarks(d.bookmarks),
    meta: {
      createdAt: d.meta?.createdAt ?? now,
      lastOpenedAt: now,
      studyPaceMs: finitePos(d.meta?.studyPaceMs),
      quizPaceMs: finitePos(d.meta?.quizPaceMs),
      lastBackupAt: finitePos(d.meta?.lastBackupAt),
      backupNudgeDismissedAt: finitePos(d.meta?.backupNudgeDismissedAt),
    },
  }
}

export function load(now: number): PersistShape {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return fresh(now)
  }
  if (!raw) return fresh(now)
  try {
    return migrate(JSON.parse(raw), now)
  } catch {
    try {
      localStorage.setItem(`${KEY}:corrupt:${now}`, raw)
    } catch {
      /* ignore */
    }
    return fresh(now)
  }
}

/** Persist the state. Returns whether the write succeeded — a `false` means
 *  storage is blocked (quota exceeded or private mode) and the app is now
 *  running in-memory only, which the caller surfaces to the user. */
export function save(data: PersistShape): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false // quota exceeded or private mode — keep running in-memory
  }
}

/** Probe whether localStorage can actually be written, without touching the
 *  real data. Catches storage that's entirely unavailable (Safari private mode,
 *  disabled cookies/storage) up front, before the first real save. */
export function probeStorage(): boolean {
  const probeKey = `${KEY}:probe`
  try {
    localStorage.setItem(probeKey, '1')
    localStorage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function exportJSON(data: PersistShape): string {
  return JSON.stringify(data, null, 2)
}

export function importJSON(text: string, now: number): PersistShape {
  return migrate(JSON.parse(text), now)
}
