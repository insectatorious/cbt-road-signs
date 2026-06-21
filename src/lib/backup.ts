/** Decides when to gently nudge the user to back up (export) their progress,
 *  since it lives only in this browser. Pure + unit-tested. */
import { DAY_MS } from './scheduler'

const MIN_SESSIONS = 4 // only nudge a genuinely engaged user
const STALE_MS = 5 * DAY_MS // ...who hasn't backed up in a while
const QUIET_AFTER_DISMISS_MS = 14 * DAY_MS // ...and hasn't just dismissed it

export interface NudgeInput {
  sessionCount: number
  createdAt: number
  lastBackupAt?: number
  dismissedAt?: number
  now: number
}

export function shouldNudgeBackup(i: NudgeInput): boolean {
  if (i.sessionCount < MIN_SESSIONS) return false
  if (i.dismissedAt != null && i.now - i.dismissedAt < QUIET_AFTER_DISMISS_MS) return false
  const since = i.lastBackupAt ?? i.createdAt
  return i.now - since > STALE_MS
}
