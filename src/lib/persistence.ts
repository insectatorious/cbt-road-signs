/** Versioned localStorage persistence. Never throws to the UI:
 *  corrupt data is backed up and replaced with a fresh store. */
import { DEFAULT_SETTINGS, type ReviewState, type SessionRecord, type Settings } from './types'

const KEY = 'cbt-signs:v1'
const SCHEMA_VERSION = 1
const SESSION_CAP = 120

export interface PersistShape {
  schemaVersion: number
  reviews: Record<string, ReviewState>
  settings: Settings
  sessions: SessionRecord[]
  meta: {
    createdAt: number
    lastOpenedAt: number
    /** EMA of correct-recall latency (ms), per mode — for adaptive grading. */
    studyPaceMs?: number
    quizPaceMs?: number
  }
}

function fresh(now: number): PersistShape {
  return {
    schemaVersion: SCHEMA_VERSION,
    reviews: {},
    settings: { ...DEFAULT_SETTINGS },
    sessions: [],
    meta: { createdAt: now, lastOpenedAt: now },
  }
}

/** Accept a value only if it's a finite positive number, else drop it. */
function finitePos(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

/** Coerce arbitrary parsed data into the current shape (+ run migrations). */
export function migrate(data: unknown, now: number): PersistShape {
  const base = fresh(now)
  if (!data || typeof data !== 'object') return base
  const d = data as Partial<PersistShape>
  return {
    schemaVersion: SCHEMA_VERSION,
    reviews: d.reviews && typeof d.reviews === 'object' ? d.reviews : {},
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
    sessions: Array.isArray(d.sessions) ? d.sessions.slice(-SESSION_CAP) : [],
    meta: {
      createdAt: d.meta?.createdAt ?? now,
      lastOpenedAt: now,
      studyPaceMs: finitePos(d.meta?.studyPaceMs),
      quizPaceMs: finitePos(d.meta?.quizPaceMs),
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
  return migrate(JSON.parse(text), now)
}
