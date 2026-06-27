import { describe, expect, it } from 'vitest'
import { nextReminderAt } from '../src/lib/reminders'

describe('nextReminderAt', () => {
  it('returns today at the given local time when it is still ahead', () => {
    const now = new Date('2026-06-20T09:00:00').getTime()
    const t = new Date(nextReminderAt('18:00', now))
    expect(t.getDate()).toBe(20)
    expect(t.getHours()).toBe(18)
    expect(t.getMinutes()).toBe(0)
  })

  it('rolls to tomorrow when the time has already passed today', () => {
    const now = new Date('2026-06-20T19:00:00').getTime()
    const t = new Date(nextReminderAt('18:00', now))
    expect(t.getDate()).toBe(21)
    expect(t.getHours()).toBe(18)
  })

  it('rolls over when exactly equal to now (strictly future)', () => {
    const now = new Date('2026-06-20T18:00:00').getTime()
    expect(nextReminderAt('18:00', now)).toBeGreaterThan(now)
  })

  it('falls back to 18:00 for a malformed time', () => {
    const now = new Date('2026-06-20T09:00:00').getTime()
    const t = new Date(nextReminderAt('not-a-time', now))
    expect(t.getHours()).toBe(18)
    expect(t.getMinutes()).toBe(0)
  })
})
