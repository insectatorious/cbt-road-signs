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
/** Current persisted shape version. Bump this whenever the *shape* changes
 *  (a field renamed/split/moved — not a value tweak the coercion pass handles)
 *  and register a `MIGRATIONS[oldVersion]` transform that upgrades the previous
 *  shape to the new one. The ordered ladder in `migrate()` then walks any older
 *  backup up to here before the field-coercion pass normalises it. */
const SCHEMA_VERSION = 1
const SESSION_CAP = 120
const BOOKMARK_CAP = 400

type RawShape = Record<string, unknown>

/** Ordered shape transforms: `MIGRATIONS[n]` upgrades a v`n` blob to v`n+1`.
 *  Each must be pure and only handle the structural change — the coercion pass
 *  at the end of `migrate()` validates and defaults every field afterwards, so a
 *  transform never needs to sanitise types itself. Empty until the first bump;
 *  for a v1→v2 change, register `1: (d) => ...` that returns the v2-shaped blob. */
const MIGRATIONS: Record<number, (d: RawShape) => RawShape> = {}

/** Thrown when a backup declares a schemaVersion newer than this build supports.
 *  The importer surfaces this as a clear message rather than silently
 *  down-coercing a future shape (which could drop fields it doesn't know yet). */
export class FutureSchemaError extends Error {
  constructor(readonly version: number) {
    super(`Backup schema v${version} is newer than supported (v${SCHEMA_VERSION})`)
    this.name = 'FutureSchemaError'
  }
}

/** The incoming shape's version: a finite integer ≥ 1, else 1 (legacy backups
 *  pre-date the field, and v1 is the only shape that ever shipped without it). */
function schemaVersionOf(d: RawShape): number {
  const v = d.schemaVersion
  return typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1
}

/** Walk the migration ladder, applying steps `from`‥`to-1` in version order.
 *  A missing step (version gap) is skipped. Exposed for testing so a v1→v2
 *  transform can be exercised before any real bump ships. */
export function applyMigrations(
  raw: RawShape,
  from: number,
  to: number,
  ladder: Record<number, (d: RawShape) => RawShape> = MIGRATIONS,
): RawShape {
  let d = raw
  for (let v = from; v < to; v++) {
    const step = ladder[v]
    if (step) d = step(d)
  }
  return d
}

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

/** Coerce arbitrary parsed data into the current shape.
 *
 *  Versioning: read the incoming `schemaVersion`, walk the `MIGRATIONS` ladder
 *  up to `SCHEMA_VERSION`, then run the field-coercion pass below as the final
 *  normaliser. A backup *newer* than this build either throws `FutureSchemaError`
 *  (when `rejectFuture`, i.e. a user import — so we warn instead of dropping
 *  fields we don't understand) or, on our own load path, falls through to a
 *  best-effort coercion so a downgraded app never wipes existing data. */
export function migrate(
  data: unknown,
  now: number,
  { rejectFuture = false }: { rejectFuture?: boolean } = {},
): PersistShape {
  const base = fresh(now)
  if (!data || typeof data !== 'object') return base
  let raw = data as RawShape
  const from = schemaVersionOf(raw)
  if (from > SCHEMA_VERSION) {
    if (rejectFuture) throw new FutureSchemaError(from)
  } else {
    raw = applyMigrations(raw, from, SCHEMA_VERSION)
  }
  const d = raw as Partial<PersistShape>
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

export function save(data: PersistShape): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* quota exceeded or private mode — keep running in-memory */
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
  // A user-supplied file: reject a newer-than-supported shape loudly rather than
  // silently down-coercing it (the load path coerces best-effort instead).
  return migrate(JSON.parse(text), now, { rejectFuture: true })
}
