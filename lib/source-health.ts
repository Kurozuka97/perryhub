export type SourceHealthStatus = 'checking' | 'ok' | 'blocked' | 'dead'

const cache = new Map<string, SourceHealthStatus>()

// Max 4 concurrent checks so we don't flood the proxy
let active = 0
const queue: Array<() => void> = []
const MAX_CONCURRENT = 4

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
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_TLS_ERROR',
  'UPSTREAM_FETCH_FAILED',
])

const CF_SIGNATURES = [
  'just a moment',
  'cf-browser-verification',
  'cf_chl_opt',
  '__cf_bm',
  'cloudflare',
  'attention required',
  'enable javascript',
  'ddos-guard',
  'please wait',
  '_cf_chl',
]

function isBlocked(html: string): boolean {
  const lower = html.toLowerCase()
  return CF_SIGNATURES.some(sig => lower.includes(sig))
}

export function checkSourceHealth(
  url: string,
  onResult: (status: SourceHealthStatus) => void
): void {
  if (url === '#' || !url.startsWith('http')) {
    onResult('dead')
    return
  }

  if (cache.has(url)) {
    onResult(cache.get(url)!)
    return
  }

  enqueue(async () => {
    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)

      const res = await fetch(proxyUrl, { signal: controller.signal })
      clearTimeout(timer)

      // Check proxy error code header first — most reliable signal
      const proxyErrorCode = res.headers.get('X-Proxy-Error-Code') || ''

      if (BLOCKED_CODES.has(proxyErrorCode)) {
        cache.set(url, 'blocked')
        onResult('blocked')
        return
      }

      if (DEAD_CODES.has(proxyErrorCode)) {
        cache.set(url, 'dead')
        onResult('dead')
        return
      }

      if (!res.ok) {
        cache.set(url, 'dead')
        onResult('dead')
        return
      }

      // No error code — read body to check for JS challenge pages
      const text = await res.text()
      const status: SourceHealthStatus = isBlocked(text) ? 'blocked' : 'ok'
      cache.set(url, status)
      onResult(status)
    } catch {
      cache.set(url, 'dead')
      onResult('dead')
    } finally {
      dequeue()
    }
  })
}
