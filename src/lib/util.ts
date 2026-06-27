/** Small shared helpers. */

import type { Grade } from './types'

/** The inferred recall shade as a word, for screen-reader announcements.
 *  0 Again · 1 Hard · 2 Good · 3 Easy. */
export function gradeShadeLabel(g: Grade): string {
  return (['Again', 'Hard', 'Good', 'Easy'] as const)[g]
}

export function todayStr(t: number = Date.now()): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function pct(x: number | null | undefined, digits = 0): string {
  if (x == null || Number.isNaN(x)) return '—'
  return `${(x * 100).toFixed(digits)}%`
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/** Human interval, e.g. 1 → "1 day", 6 → "6 days", 30 → "1 mo". */
export function humanInterval(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  const m = Math.round(days / 30)
  return m === 1 ? '1 mo' : `${m} mo`
}
