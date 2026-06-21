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

export const store = $state({
  reviews: loaded.reviews as Record<string, ReviewState>,
  settings: loaded.settings,
  sessions: loaded.sessions,
  createdAt: loaded.meta.createdAt,
  pace: { study: loaded.meta.studyPaceMs, quiz: loaded.meta.quizPaceMs } as {
    study: number | undefined
    quiz: number | undefined
  },
})

/** Signs in scope for the current settings (no motorway; edge/markings gated). */
export function activeSigns(): SignDefinition[] {
  return activeDeck(SIGNS, store.settings)
}

export function reviewFor(id: string): ReviewState | undefined {
  return store.reviews[id]
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
    meta: {
      createdAt: store.createdAt,
      lastOpenedAt: Date.now(),
      studyPaceMs: store.pace.study,
      quizPaceMs: store.pace.quiz,
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
function recordSession(g: Grade, wasNew: boolean): void {
  const date = todayStr()
  let s = store.sessions[store.sessions.length - 1]
  if (!s || s.date !== date) {
    s = { date, reviewed: 0, correct: 0, newSeen: 0 }
    store.sessions.push(s)
  }
  s.reviewed += 1
  if (g > 0) s.correct += 1
  if (wasNew) s.newSeen += 1
}

// ---- actions ----
export function gradeSign(id: string, g: Grade, opts: GradeOptions = {}): void {
  const prev = store.reviews[id] ?? newReviewState(id)
  const wasNew = !prev.introduced
  store.reviews[id] = applyGrade(prev, g, Date.now(), opts)
  recordSession(g, wasNew)
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
  const g: Grade = correct ? shadeFromTime(responseMs, store.pace.quiz) : 0
  if (correct) store.pace.quiz = updateBaseline(store.pace.quiz, responseMs)
  gradeSign(id, g, { responseMs, confusedWithId: correct ? undefined : chosenWrongId })
  return g
}

/** Grade a flashcard from correctness + time-to-flip; the shade (Hard/Good/
 *  Easy) is inferred from speed vs the user's study pace. */
export function gradeRecall(id: string, gotIt: boolean, thinkMs: number): Grade {
  const g = gradeFromRecall(gotIt, thinkMs, store.pace.study)
  if (gotIt) store.pace.study = updateBaseline(store.pace.study, thinkMs)
  gradeSign(id, g, { responseMs: thinkMs })
  return g
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  store.settings[key] = value
  persist()
}

export function resetProgress(): void {
  store.reviews = {}
  store.sessions = []
  persistence.clearProgress()
}

export function exportData(): string {
  return persistence.exportJSON(snapshot())
}

export function importData(text: string): boolean {
  try {
    const data = persistence.importJSON(text, Date.now())
    for (const id of Object.keys(data.reviews)) {
      if (!SIGN_BY_ID.has(id)) delete data.reviews[id]
    }
    store.reviews = data.reviews
    store.settings = data.settings
    store.sessions = data.sessions
    persist()
    return true
  } catch {
    return false
  }
}
