import { describe, expect, it } from 'vitest'
import { shouldNudgeBackup } from '../src/lib/backup'

const DAY = 86_400_000
const NOW = 1_700_000_000_000

describe('shouldNudgeBackup', () => {
  it('stays quiet until the user is engaged (>= 4 sessions)', () => {
    expect(
      shouldNudgeBackup({ sessionCount: 3, createdAt: NOW - 30 * DAY, now: NOW }),
    ).toBe(false)
  })

  it('nudges an engaged user who has never backed up in a while', () => {
    expect(
      shouldNudgeBackup({ sessionCount: 6, createdAt: NOW - 8 * DAY, now: NOW }),
    ).toBe(true)
  })

  it('does not nudge a fresh, recently created account', () => {
    expect(
      shouldNudgeBackup({ sessionCount: 6, createdAt: NOW - 1 * DAY, now: NOW }),
    ).toBe(false)
  })

  it('is reset by a recent backup', () => {
    expect(
      shouldNudgeBackup({
        sessionCount: 10,
        createdAt: NOW - 60 * DAY,
        lastBackupAt: NOW - 1 * DAY,
        now: NOW,
      }),
    ).toBe(false)
  })

  it('stays quiet for two weeks after a dismissal', () => {
    const base = { sessionCount: 10, createdAt: NOW - 60 * DAY, now: NOW }
    expect(shouldNudgeBackup({ ...base, dismissedAt: NOW - 3 * DAY })).toBe(false)
    expect(shouldNudgeBackup({ ...base, dismissedAt: NOW - 20 * DAY })).toBe(true)
  })
})
