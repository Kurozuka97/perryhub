/** Small TTL cache backed by sessionStorage (private mode safe). */

interface CacheEntry<T> {
  value: T
  cachedAt: number
}

export function readSessionCache<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (Date.now() - entry.cachedAt > ttlMs) {
      sessionStorage.removeItem(key)
      return null
    }
    return entry.value
  } catch {
    return null
  }
}

export function writeSessionCache<T>(key: string, value: T): void {
  try {
    const entry: CacheEntry<T> = { value, cachedAt: Date.now() }
    sessionStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Storage full / unavailable — caching is best-effort.
  }
}
