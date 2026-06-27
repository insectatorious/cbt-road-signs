/** The single reactive app store. Wires the SR engine to persisted state. */
import { signs as ALL_SIGNS } from '../data/signs'
import { activeDeck } from './deck'
import { grade as applyGrade, newReviewState, type GradeOptions } from './scheduler'
import { gradeFromRecall, shadeFromTime, updateBaseline } from './pace'
import * as persistence from './persistence'
import { todayStr } from './util'
import type { Grade, ReviewState, Settings, SignDefinition } from './types'

export const SIGNS = ALL_SIGNS
export const SIGN_BY_ID = new Map(ALL_SIGNS.map((s) => [s.id, s]))

const loaded = persistence.load(Date.now())
for (const id of Object.keys(loaded.reviews)) {
  if (!SIGN_BY_ID.has(id)) delete loaded.reviews[id] // drop orphans from old datasets
}
loaded.bookmarks = loaded.bookmarks.filter((id) => SIGN_BY_ID.has(id)) // same for saved ids

export const store = $state({
  reviews: loaded.reviews as Record<string, ReviewState>,
  settings: loaded.settings,
  sessions: loaded.sessions,
  bookmarks: loaded.bookmarks as string[],
  createdAt: loaded.meta.createdAt,
  pace: { study: loaded.meta.studyPaceMs, quiz: loaded.meta.quizPaceMs } as {
    study: number | undefined
    quiz: number | undefined
  },
  lastBackupAt: loaded.meta.lastBackupAt as number | undefined,
  backupNudgeDismissedAt: loaded.meta.backupNudgeDismissedAt as number | undefined,
})

/** Signs in scope for the current settings (scope slider + markings/motorway opt-ins). */
export function activeSigns(): SignDefinition[] {
  return activeDeck(SIGNS, store.settings)
}

export function reviewFor(id: string): ReviewState | undefined {
  return store.reviews[id]
}

/** A sign's look-alikes, resolved and respecting the motorway opt-out: when the
 *  module is off, motorway signs never surface as "commonly confused with" links. */
export function lookalikesFor(sign: SignDefinition): SignDefinition[] {
  return sign.confusedWith
    .map((id) => SIGN_BY_ID.get(id))
    .filter(
      (s): s is SignDefinition =>
        !!s && (s.category !== 'motorway' || store.settings.includeMotorway),
    )
}

// ---- bookmarks (saved signs): a hand-curated study list, kept across resets ----
export function isBookmarked(id: string): boolean {
  return store.bookmarks.includes(id)
}

/** Add or remove a saved sign. Reassigns the array so Svelte 5 `$derived`
 *  consumers (the Reference filter + the chip count) recompute. */
export function toggleBookmark(id: string): void {
  store.bookmarks = store.bookmarks.includes(id)
    ? store.bookmarks.filter((b) => b !== id)
    : [...store.bookmarks, id]
  persist()
}

/** A one-shot set of ids for a focused "drill these" quiz (from the Report). */
export const quizFocus = $state<{ ids: string[] }>({ ids: [] })
export function setQuizFocus(ids: string[]): void {
  quizFocus.ids = ids
}
export function takeQuizFocus(): string[] {
  const ids = quizFocus.ids
  quizFocus.ids = []
  return ids
}

// ---- persistence: debounced, flushed on tab hide (mobile-safe) ----
let saveTimer: ReturnType<typeof setTimeout> | undefined

function snapshot(): persistence.PersistShape {
  return {
    schemaVersion: 1,
    reviews: store.reviews,
    settings: store.settings,
    sessions: store.sessions,
    bookmarks: store.bookmarks,
    meta: {
      createdAt: store.createdAt,
      lastOpenedAt: Date.now(),
      studyPaceMs: store.pace.study,
      quizPaceMs: store.pace.quiz,
      lastBackupAt: store.lastBackupAt,
      backupNudgeDismissedAt: store.backupNudgeDismissedAt,
    },
  }
}

function persist(): void {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => persistence.save(snapshot()), 300)
}

function flush(): void {
  clearTimeout(saveTimer)
  persistence.save(snapshot())
}

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}

// ---- session log ----
type SessionCounts = { reviewed: number; correct: number; newSeen: number }
/** What a single grade did to the session log, so it can be reverted exactly. */
type SessionUndo = { index: number; created: boolean; prev: SessionCounts | undefined }

function recordSession(g: Grade, wasNew: boolean): SessionUndo {
  const date = todayStr()
  let s = store.sessions[store.sessions.length - 1]
  let created = false
  let prev: SessionCounts | undefined
  if (!s || s.date !== date) {
    s = { date, reviewed: 0, correct: 0, newSeen: 0 }
    store.sessions.push(s)
    created = true
  } else {
    prev = { reviewed: s.reviewed, correct: s.correct, newSeen: s.newSeen }
  }
  s.reviewed += 1
  if (g > 0) s.correct += 1
  if (wasNew) s.newSeen += 1
  return { index: store.sessions.length - 1, created, prev }
}

// ---- single-step undo of the most recent grade ----
interface GradeUndo {
  id: string
  prevReview: ReviewState | undefined // undefined ⇒ the card had no review entry yet
  paceMode: 'study' | 'quiz'
  prevPace: number | undefined
  session: SessionUndo
}
let lastUndo: GradeUndo | null = null

/** Apply a grade to a card + the session log, returning the bits needed to undo
 *  it. Snapshots the prior review as a plain deep copy (scheduler.grade() is pure,
 *  but this guarantees the captured state can't alias the live reactive object). */
function applyGradeAndRecord(
  id: string,
  g: Grade,
  opts: GradeOptions,
): { prevReview: ReviewState | undefined; session: SessionUndo } {
  const existing = store.reviews[id]
  const prevReview = existing ? ($state.snapshot(existing) as ReviewState) : undefined
  const base = existing ?? newReviewState(id)
  const wasNew = !base.introduced
  store.reviews[id] = applyGrade(base, g, Date.now(), opts)
  const session = recordSession(g, wasNew)
  return { prevReview, session }
}

// ---- actions ----
export function gradeSign(id: string, g: Grade, opts: GradeOptions = {}): void {
  applyGradeAndRecord(id, g, opts)
  persist()
}

/** Grade a quiz answer: wrong → Again; correct → shade from speed vs the
 *  user's quiz pace. Updates the adaptive baseline on correct answers. */
export function gradeQuiz(
  id: string,
  correct: boolean,
  responseMs: number,
  chosenWrongId?: string,
): Grade {
  const prevPace = store.pace.quiz
  const g: Grade = correct ? shadeFromTime(responseMs, store.pace.quiz) : 0
  if (correct) store.pace.quiz = updateBaseline(store.pace.quiz, responseMs)
  const { prevReview, session } = applyGradeAndRecord(id, g, {
    responseMs,
    confusedWithId: correct ? undefined : chosenWrongId,
  })
  lastUndo = { id, prevReview, paceMode: 'quiz', prevPace, session }
  persist()
  return g
}

/** Grade a flashcard from correctness + time-to-flip; the shade (Hard/Good/
 *  Easy) is inferred from speed vs the user's study pace. */
export function gradeRecall(id: string, gotIt: boolean, thinkMs: number): Grade {
  const prevPace = store.pace.study
  const g = gradeFromRecall(gotIt, thinkMs, store.pace.study)
  if (gotIt) store.pace.study = updateBaseline(store.pace.study, thinkMs)
  const { prevReview, session } = applyGradeAndRecord(id, g, { responseMs: thinkMs })
  lastUndo = { id, prevReview, paceMode: 'study', prevPace, session }
  persist()
  return g
}

/** Is there a just-applied grade available to undo? (Drives the Undo toast.) */
export function canUndoGrade(): boolean {
  return lastUndo !== null
}

/** Revert the most recent grade — its ReviewState, the session counts, and the
 *  adaptive pace baseline. Single-step: only the latest grade is recoverable.
 *  Returns false when there's nothing to undo. */
export function undoLastGrade(): boolean {
  const u = lastUndo
  if (!u) return false
  if (u.prevReview) store.reviews[u.id] = u.prevReview
  else delete store.reviews[u.id] // the card had no entry before — return it to "new"
  const { index, created, prev } = u.session
  if (created) {
    if (index === store.sessions.length - 1) store.sessions.splice(index, 1)
  } else if (prev) {
    const s = store.sessions[index]
    if (s) {
      s.reviewed = prev.reviewed
      s.correct = prev.correct
      s.newSeen = prev.newSeen
    }
  }
  store.pace[u.paceMode] = u.prevPace
  lastUndo = null
  persist()
  return true
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  store.settings[key] = value
  persist()
}

/** Wipe learning progress (reviews + sessions) and restart the "day N" clock.
 *  Deliberately KEEPS bookmarks and settings — they're curation/preferences, not
 *  progress. Flushes synchronously (not the debounced persist) so the wiped state
 *  and the surviving saved signs land on disk atomically, with no window where the
 *  key is missing and a crash/reload could drop the kept bookmarks. */
export function resetProgress(): void {
  store.reviews = {}
  store.sessions = []
  store.createdAt = Date.now()
  lastUndo = null // nothing left to undo into — a stale snapshot would resurrect a wiped review
  flush()
}

export function exportData(): string {
  return persistence.exportJSON(snapshot())
}

/** Download the full state as a dated JSON file and mark it as backed up. */
export function downloadBackup(): void {
  if (typeof document !== 'undefined') {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cbt-progress-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  store.lastBackupAt = Date.now()
  persist()
}

export function dismissBackupNudge(): void {
  store.backupNudgeDismissedAt = Date.now()
  persist()
}

/** Restore the FULL state from a backup file (reviews, settings, sessions,
 *  pace baselines, and meta) — not just the reviews. */
export function importData(text: string): boolean {
  try {
    const data = persistence.importJSON(text, Date.now())
    for (const id of Object.keys(data.reviews)) {
      if (!SIGN_BY_ID.has(id)) delete data.reviews[id]
    }
    store.reviews = data.reviews
    store.settings = data.settings
    store.sessions = data.sessions
    store.bookmarks = data.bookmarks.filter((id) => SIGN_BY_ID.has(id))
    store.createdAt = data.meta.createdAt
    store.pace = { study: data.meta.studyPaceMs, quiz: data.meta.quizPaceMs }
    store.lastBackupAt = data.meta.lastBackupAt
    store.backupNudgeDismissedAt = data.meta.backupNudgeDismissedAt
    persist()
    return true
  } catch {
    return false
  }
}
