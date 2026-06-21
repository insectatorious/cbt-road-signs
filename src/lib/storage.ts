/** Thin wrappers around the Storage Manager API. All best-effort: they no-op
 *  (and never throw) when the API is unavailable, so callers needn't guard. */

export interface StorageStatus {
  supported: boolean
  persisted: boolean
}

function manager(): StorageManager | undefined {
  return typeof navigator !== 'undefined' ? navigator.storage : undefined
}

/** Ask the browser to make our origin's storage durable (not evicted under
 *  storage pressure / Safari's 7-day cleanup). Returns the resulting state.
 *  Safe to call repeatedly and on every launch. */
export async function requestPersistence(): Promise<boolean> {
  const s = manager()
  if (!s?.persist) return false
  try {
    if (s.persisted && (await s.persisted())) return true
    return await s.persist()
  } catch {
    return false
  }
}

export async function storageStatus(): Promise<StorageStatus> {
  const s = manager()
  if (!s?.persisted) return { supported: false, persisted: false }
  try {
    return { supported: true, persisted: await s.persisted() }
  } catch {
    return { supported: true, persisted: false }
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  const s = manager()
  if (!s?.estimate) return null
  try {
    const e = await s.estimate()
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 }
  } catch {
    return null
  }
}
