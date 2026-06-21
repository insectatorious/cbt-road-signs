/** Adaptive response-time grading.
 *
 *  In a flashcard the user supplies CORRECTNESS (Got it / Missed); the *shade*
 *  of a correct recall — Hard / Good / Easy — is inferred from how fast it was
 *  RELATIVE to that user's own EMA baseline (kept separately for study vs quiz).
 *  Defensive about two real-world hazards: time inflated by looking away (idle),
 *  and corrupt baselines loaded from storage/import. Pure + unit-tested. */
import type { Grade } from './types'

export const MIN_THINK_MS = 400 // floor: faster than this is a misclick, not recall
export const MAX_THINK_MS = 30_000 // hard cap on any latency
export const IDLE_MS = 20_000 // beyond this a correct reveal was almost certainly "away", not recall
const ALPHA = 0.12 // EMA weight for each new sample (small = slow, stable adaptation)
const FAST_RATIO = 0.6 // <= 0.6× your typical pace → Easy
const SLOW_RATIO = 1.7 // >= 1.7× your typical pace → Hard
const FALLBACK_MS = 5000 // reference used until a personal baseline exists

export function clampThink(ms: number): number {
  return Math.min(MAX_THINK_MS, Math.max(MIN_THINK_MS, Math.round(ms)))
}

/** A baseline is usable only if it's a finite, positive number — guards against
 *  corrupt/imported state (0 → Infinity ratio, NaN → sticky poison, etc.). */
function validBaseline(b: number | undefined): number | undefined {
  return typeof b === 'number' && Number.isFinite(b) && b > 0 ? b : undefined
}

/** Roll the user's typical recall time toward a new sample. Idle samples are
 *  ignored (so looking away never inflates the baseline); a corrupt baseline is
 *  treated as "no baseline" and re-seeded from the fresh sample. */
export function updateBaseline(baseline: number | undefined, thinkMs: number): number | undefined {
  const b = validBaseline(baseline)
  if (!Number.isFinite(thinkMs) || thinkMs >= IDLE_MS) return b // never learn from away-time
  const t = clampThink(thinkMs)
  return b == null ? t : Math.round(b * (1 - ALPHA) + t * ALPHA)
}

/** For a CORRECT recall: Hard (1) | Good (2) | Easy (3), by speed vs baseline.
 *  An idle (looked-away) reveal is a neutral Good — neither rewarded nor punished. */
export function shadeFromTime(thinkMs: number, baseline: number | undefined): Grade {
  if (!Number.isFinite(thinkMs) || thinkMs >= IDLE_MS) return 2 // looked away → neutral
  const ratio = clampThink(thinkMs) / (validBaseline(baseline) ?? FALLBACK_MS)
  if (ratio <= FAST_RATIO) return 3 // Easy — quick, fluent recall
  if (ratio >= SLOW_RATIO) return 1 // Hard — slow, effortful recall
  return 2 // Good
}

/** correctness + time → SR grade. Missed is always Again (0). */
export function gradeFromRecall(
  gotIt: boolean,
  thinkMs: number,
  baseline: number | undefined,
): Grade {
  return gotIt ? shadeFromTime(thinkMs, baseline) : 0
}
