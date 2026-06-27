/** Opt-in, local-only daily reminder. No backend: uses the Notification +
 *  Notification Triggers (TimestampTrigger) APIs via the existing service worker
 *  where available, and no-ops everywhere else. Every DOM call is feature-detected
 *  and wrapped, so this can never throw into the app. The schedule-time maths is a
 *  pure, unit-tested helper. */

const TAG = 'cbt-daily-reminder'

/** Timestamp of the next occurrence of local "HH:MM" at or after `now` rolls to
 *  the next calendar day when today's time has already passed. Pure. */
export function nextReminderAt(time: string, now: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  const h = m ? Number(m[1]) : 18
  const min = m ? Number(m[2]) : 0
  const d = new Date(now)
  d.setHours(h, min, 0, 0)
  if (d.getTime() <= now) d.setDate(d.getDate() + 1) // setDate, not +DAY_MS, so DST days stay correct
  return d.getTime()
}

// minimal shapes for the experimental Notification Triggers API (not in lib.dom)
interface TimestampTriggerCtor {
  new (timestamp: number): unknown
}
type TriggerNotificationOptions = NotificationOptions & { showTrigger?: unknown }

function triggerCtor(): TimestampTriggerCtor | undefined {
  return (globalThis as unknown as { TimestampTrigger?: TimestampTriggerCtor }).TimestampTrigger
}

/** True when scheduled local reminders can actually be delivered on this browser. */
export function remindersSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    !!triggerCtor()
  )
}

async function clearScheduled(reg: ServiceWorkerRegistration): Promise<void> {
  try {
    const opts = { tag: TAG, includeTriggered: true } as unknown as GetNotificationOptions
    const pending = await reg.getNotifications(opts)
    pending.forEach((n) => n.close())
  } catch {
    /* best-effort */
  }
}

/** Reconcile the OS reminder with the setting: schedule the next daily reminder
 *  when enabled (asking permission once), or clear it when disabled. Re-arm on
 *  each app open so the *next* day's reminder is always queued. Safe to call
 *  unconditionally — no-ops when unsupported or permission is refused. */
export async function syncReminder(enabled: boolean, time: string, now = Date.now()): Promise<void> {
  if (!remindersSupported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    await clearScheduled(reg)
    if (!enabled) return
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return
    }
    const Ctor = triggerCtor()
    if (!Ctor) return
    const opts: TriggerNotificationOptions = {
      tag: TAG,
      body: 'A few road signs keeps your streak going.',
      showTrigger: new Ctor(nextReminderAt(time, now)),
    }
    await reg.showNotification('Time to revise', opts)
  } catch {
    /* best-effort — never break the app over a reminder */
  }
}
