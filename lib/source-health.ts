export type SourceHealthStatus = 'checking' | 'ok' | 'blocked' | 'slow' | 'dead'

// Cache entries expire after 5 minutes so status stays fresh
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { status: SourceHealthStatus; ts: number }>()

function getCached(url: string): SourceHealthStatus | null {
  const entry = cache.get(url)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(url)
    return null
  }
  return entry.status
}

function setCached(url: string, status: SourceHealthStatus) {
  cache.set(url, { status, ts: Date.now() })
}

// Max concurrent checks — raised from 4 to 6
let active = 0
const queue: Array<() => void> = []
const MAX_CONCURRENT = 6

function enqueue(fn: () => void) {
  if (active < MAX_CONCURRENT) {
    active++
    fn()
  } else {
    queue.push(fn)
  }
}

function dequeue() {
  active--
  if (queue.length > 0) {
    const next = queue.shift()!
    active++
    next()
  }
}

// Proxy error codes that mean the site is alive but requires a real browser
const BLOCKED_CODES = new Set([
  'UPSTREAM_BROWSER_VERIFICATION_REQUIRED',
  'UPSTREAM_ACCESS_DENIED',
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_LOGIN_REQUIRED',
])

// Proxy error codes that mean the site is genuinely unreachable
const DEAD_CODES = new Set([
  'UPSTREAM_NOT_FOUND',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_SITE_ERROR',
  'UPSTREAM_HTTP_ERROR',
  'UPSTREAM_DNS_ERROR',
  'UPSTREAM_CONNECTION_ERROR',
  'UPSTREAM_TLS_ERROR',
  'UPSTREAM_FETCH_FAILED',
])

// More precise CF/bot challenge signatures — avoid broad keywords like 'cloudflare'
const CF_SIGNATURES = [
  'cf-browser-verification',
  'cf_chl_opt',
  '__cf_bm',
  '_cf_chl',
  'cf_chl_prog',
  'jschl-answer',
  'ddos-guard',
  'x-bzg',                    // DDoS-Guard signature
  'please enable javascript and cookies', // common bot page
  'enable javascript to continue',
]

function isChallengePage(html: string): boolean {
  const lower = html.toLowerCase()
  return CF_SIGNATURES.some(sig => lower.includes(sig))
}

// Thresholds
const TIMEOUT_MS = 10_000   // total timeout
const SLOW_THRESHOLD_MS = 5_000  // mark as slow if response takes longer than this

export function checkSourceHealth(
  url: string,
  onResult: (status: SourceHealthStatus) => void
): void {
  if (url === '#' || !url.startsWith('http')) {
    onResult('dead')
    return
  }

  const cached = getCached(url)
  if (cached) {
    onResult(cached)
    return
  }

  enqueue(async () => {
    const start = Date.now()

    const finish = (status: SourceHealthStatus) => {
      setCached(url, status)
      onResult(status)
    }

    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const res = await fetch(proxyUrl, { signal: controller.signal })
      clearTimeout(timer)

      const elapsed = Date.now() - start

      // Check proxy error code header first — most reliable signal
      const proxyErrorCode = res.headers.get('X-Proxy-Error-Code') || ''

      if (BLOCKED_CODES.has(proxyErrorCode)) return finish('blocked')

      // Timeout from proxy side = slow/unreachable, not hard dead
      if (proxyErrorCode === 'UPSTREAM_TIMEOUT') return finish('slow')

      if (DEAD_CODES.has(proxyErrorCode)) return finish('dead')

      if (!res.ok) return finish('dead')

      // Read body to detect challenge pages
      const text = await res.text()

      if (isChallengePage(text)) return finish('blocked')

      // Site responded but took a while
      if (elapsed > SLOW_THRESHOLD_MS) return finish('slow')

      finish('ok')
    } catch (err) {
      // AbortError = our own timeout
      if (err instanceof DOMException && err.name === 'AbortError') {
        finish('slow')
      } else {
        finish('dead')
      }
    } finally {
      dequeue()
    }
  })
}

// Force recheck — clears cache for a URL and runs fresh check
export function recheckSourceHealth(
  url: string,
  onResult: (status: SourceHealthStatus) => void
): void {
  cache.delete(url)
  onResult('checking')
  checkSourceHealth(url, onResult)
}
