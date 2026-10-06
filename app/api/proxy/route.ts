import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'node:dns/promises'
import { DNS_OPTIONS } from '@/lib/types'
import {
  PROXY_CSP_STRICT,
  ProxyRequestError,
  fetchProxyPayload,
  renderProxyErrorPage,
} from '@/lib/server/proxy'
import { getAllowedProxyHosts } from '@/lib/server/source-registry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_DNS_PROVIDERS = new Set(DNS_OPTIONS.map((option) => option.value))

// Best-effort in-memory rate limiting (per serverless instance).
const RATE_WINDOW_MS = 60_000
const RATE_MAX_REQUESTS = 240
const RATE_BUCKETS_MAX = 10_000

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function allowRequest(key: string): boolean {
  const now = Date.now()
  let bucket = rateBuckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    if (rateBuckets.size >= RATE_BUCKETS_MAX) {
      for (const [staleKey, stale] of rateBuckets) {
        if (now >= stale.resetAt) rateBuckets.delete(staleKey)
      }
      if (rateBuckets.size >= RATE_BUCKETS_MAX) {
        const oldest = rateBuckets.keys().next().value
        if (oldest !== undefined) rateBuckets.delete(oldest)
      }
    }
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS }
    rateBuckets.set(key, bucket)
  }

  bucket.count += 1
  return bucket.count <= RATE_MAX_REQUESTS
}

/** Per-hop DNS validation — every resolved address must be public. */
async function dnsLookup(hostname: string): Promise<string[]> {
  const results = await lookup(hostname, { all: true, verbatim: true })
  return results.map((entry) => entry.address)
}

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

function errorResponse(error: ProxyRequestError): NextResponse {
  return new NextResponse(
    renderProxyErrorPage({
      title: 'Proxy unavailable',
      message: error.message,
      status: error.status,
      code: error.code,
    }),
    {
      status: error.status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': PROXY_CSP_STRICT,
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
        'Referrer-Policy': 'no-referrer',
        'X-Proxy-Status': 'error',
        'X-Proxy-Error-Code': error.code,
        'X-Proxy-Error-Message': encodeURIComponent(error.message),
      },
      statusText: error.code,
    },
  )
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  const dnsProvider = req.nextUrl.searchParams.get('dns') || undefined

  if (!allowRequest(clientKey(req))) {
    return errorResponse(
      new ProxyRequestError(429, 'RATE_LIMITED', 'Too many proxy requests. Try again shortly.'),
    )
  }

  if (dnsProvider && !ALLOWED_DNS_PROVIDERS.has(dnsProvider)) {
    return errorResponse(
      new ProxyRequestError(400, 'INVALID_DNS_PROVIDER', 'Unsupported DNS provider'),
    )
  }

  try {
    const checkOnly = req.nextUrl.searchParams.get('check') === '1'

    // Document bodies are only served for hosts discovered in our source
    // registries; playlists/JSON pass through so stream checks keep working.
    const documentAllowlist = await getAllowedProxyHosts().catch(() => undefined)

    const payload = await fetchProxyPayload(url || '', fetch, {
      dnsProvider: dnsProvider === 'none' ? undefined : dnsProvider,
      documentAllowlist,
      dnsLookup,
      signal: req.signal,
      checkOnly,
    })

    return new NextResponse(payload.body, {
      status: payload.status,
      headers: {
        'Content-Type': payload.contentType,
        'Cache-Control': 'no-store',
        'X-Proxy-Status': payload.status >= 400 ? 'upstream-error' : 'ok',
        'Content-Security-Policy': payload.csp,
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch (error) {
    const proxyError =
      error instanceof ProxyRequestError
        ? error
        : new ProxyRequestError(502, 'UPSTREAM_FETCH_FAILED', 'Proxy error')

    return errorResponse(proxyError)
  }
}
