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

      if (!res.ok) {
        const status: SourceHealthStatus = res.status >= 400 ? 'dead' : 'blocked'
        cache.set(url, status)
        onResult(status)
        return
      }

      // Check proxy-level error header first
      const proxyStatus = res.headers.get('X-Proxy-Status')
      const proxyError = res.headers.get('X-Proxy-Error-Code')
      if (proxyStatus === 'error' || proxyError) {
        cache.set(url, 'dead')
        onResult('dead')
        return
      }

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
