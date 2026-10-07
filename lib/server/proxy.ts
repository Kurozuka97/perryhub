import { DNS_OPTIONS } from '../types.ts'
import { detectEmbeddedProxyIssue } from '../embed-detection.ts'
import { isPrivateAddress } from '../net.ts'
import {
  PROXY_ENDPOINT_PREFIX,
  PROXY_RUNTIME_ATTRIBUTE,
  buildProxyRuntimeScript,
} from './proxy-runtime.ts'

export { isPrivateAddress } from '../net.ts'
export { buildProxyRuntimeScript } from './proxy-runtime.ts'

const HTML_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml'])
// Content types browsers will execute script from when navigated to directly.
const SCRIPTABLE_DOCUMENT_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/xml',
  'text/xml',
])
const REQUEST_TIMEOUT_MS = 15_000
const MAX_REDIRECT_HOPS = 5
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024
const DOH_CACHE_MAX_ENTRIES = 500
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const ALLOWED_DOH_ENDPOINTS = new Set(
  DNS_OPTIONS.map((option) => option.value).filter((value) => value !== 'none'),
)

// Proxied HTML runs in an opaque origin so it can never touch the app's
// storage or APIs, while still being able to execute its own scripts.
export const PROXY_CSP_DOCUMENT =
  'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads'
// Everything else (JSON, playlists, SVG, media) is served script-free.
export const PROXY_CSP_STRICT = 'sandbox'

// --- DoH resolver ---

const DOH_CACHE = new Map<string, string>()

function rememberDoh(key: string, ip: string): void {
  if (DOH_CACHE.size >= DOH_CACHE_MAX_ENTRIES) {
    const oldest = DOH_CACHE.keys().next().value
    if (oldest !== undefined) DOH_CACHE.delete(oldest)
  }
  DOH_CACHE.set(key, ip)
}

async function resolveViaDoH(hostname: string, dohUrl: string): Promise<string | null> {
  if (!ALLOWED_DOH_ENDPOINTS.has(dohUrl)) {
    throw new ProxyRequestError(400, 'INVALID_DNS_PROVIDER', 'Unsupported DNS provider')
  }

  const cacheKey = `${dohUrl}|${hostname}`
  if (DOH_CACHE.has(cacheKey)) return DOH_CACHE.get(cacheKey)!

  try {
    const url = `${dohUrl}?name=${encodeURIComponent(hostname)}&type=A`
    const res = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { Answer?: { type: number; data: string }[] }
    const ip = data.Answer?.find((r) => r.type === 1)?.data ?? null
    if (ip) rememberDoh(cacheKey, ip)
    return ip
  } catch {
    return null
  }
}

// --- Error class ---

export class ProxyRequestError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ProxyRequestError'
    this.status = status
    this.code = code
  }
}

export interface ProxyPayload {
  body: string
  contentType: string
  status: number
  upstreamUrl: string
  /** Content-Security-Policy value the route should apply to this response. */
  csp: string
}

interface ProxyOptions {
  /** Enforced before the request is made (strict allowlist mode). */
  allowedHosts?: Set<string>
  /**
   * When set, document responses (html/xhtml/svg/xml) are only served if the
   * final host is in this set. Non-document responses (json, m3u8, media)
   * pass through so health checks keep working for arbitrary stream hosts.
   */
  documentAllowlist?: Set<string>
  /** Must be one of DNS_OPTIONS; validated before use. */
  dnsProvider?: string
  /** Optional per-hop DNS validation hook (used by the route for SSRF defence). */
  dnsLookup?: (hostname: string) => Promise<string[]>
  /** Aborted when the client disconnects — cancels the upstream fetch. */
  signal?: AbortSignal
  /**
   * Headers-only health probe: fetch upstream but never download the body.
   * Used by source/channel status checks to keep bandwidth low.
   */
  checkOnly?: boolean
}

// --- URL parsing ---

export function parseProxyTarget(rawUrl: string): URL {
  if (!rawUrl?.trim()) {
    throw new ProxyRequestError(400, 'MISSING_URL', 'No URL')
  }

  let target: URL

  try {
    target = new URL(rawUrl)
  } catch {
    throw new ProxyRequestError(400, 'INVALID_URL', 'Invalid URL')
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new ProxyRequestError(400, 'UNSUPPORTED_PROTOCOL', 'Unsupported protocol')
  }

  if (isPrivateAddress(target.hostname)) {
    throw new ProxyRequestError(400, 'PRIVATE_HOST_BLOCKED', 'Private hosts are not allowed')
  }

  if (target.username || target.password) {
    throw new ProxyRequestError(400, 'INVALID_URL', 'Credentials in URL are not allowed')
  }

  return target
}

function assertHostAllowed(target: URL, allowedHosts?: Set<string>): void {
  if (!allowedHosts || allowedHosts.size === 0) {
    return
  }

  if (!allowedHosts.has(target.hostname.toLowerCase())) {
    throw new ProxyRequestError(
      403,
      'HOST_NOT_ALLOWED',
      'Host is not in the allowed source list',
    )
  }
}

async function assertResolvedAddressesPublic(
  hostname: string,
  dnsLookup?: (hostname: string) => Promise<string[]>,
): Promise<void> {
  if (!dnsLookup) return

  let addresses: string[]
  try {
    addresses = await dnsLookup(hostname)
  } catch (error) {
    const cause = error as { cause?: { code?: string } }
    const code = cause?.cause?.code ?? (error as { code?: string })?.code
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      throw new ProxyRequestError(502, 'UPSTREAM_DNS_ERROR', 'Source hostname could not be resolved')
    }
    throw error
  }

  if (!addresses.length) {
    throw new ProxyRequestError(502, 'UPSTREAM_DNS_ERROR', 'Source hostname could not be resolved')
  }

  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new ProxyRequestError(
        403,
        'PRIVATE_HOST_BLOCKED',
        'Hostname resolves to a private/reserved address',
      )
    }
  }
}

async function validateTarget(
  target: URL,
  options: ProxyOptions,
  isFinal = false,
): Promise<void> {
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new ProxyRequestError(400, 'UNSUPPORTED_PROTOCOL', 'Unsupported protocol')
  }
  if (isPrivateAddress(target.hostname)) {
    throw new ProxyRequestError(
      403,
      'PRIVATE_HOST_BLOCKED',
      isFinal
        ? 'Redirect to a private/reserved host is not allowed'
        : 'Private hosts are not allowed',
    )
  }
  if (options.allowedHosts && options.allowedHosts.size > 0) {
    assertHostAllowed(target, options.allowedHosts)
  }
  await assertResolvedAddressesPublic(target.hostname, options.dnsLookup)
}

// --- HTML helpers ---

export function isHtmlContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase().split(';')[0].trim()
  return HTML_CONTENT_TYPES.has(normalized)
}

function isScriptableDocument(contentType: string): boolean {
  const normalized = contentType.toLowerCase().split(';')[0].trim()
  return SCRIPTABLE_DOCUMENT_TYPES.has(normalized)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
}

function extractDocumentTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? decodeBasicEntities(match[1]) : ''
}

function extractVisibleText(html: string): string {
  return html
    .slice(0, 20_000)
    .replace(/<script[\s\S]*?(?:<\/script>|$)/gi, ' ')
    .replace(/<style[\s\S]*?(?:<\/style>|$)/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]{2,8};/gi, ' ')
}

// --- DOM injection ---

function buildBaseTag(target: URL): string {
  return `<base href="${escapeHtml(target.toString())}">`
}

export function injectBaseTag(html: string, target: URL): string {
  const baseTag = buildBaseTag(target)

  if (/<base\s/i.test(html)) {
    return html
  }

  if (/<head>/i.test(html)) {
    return html.replace(/<head>/i, `<head>${baseTag}`)
  }

  return `${baseTag}${html}`
}

export function toProxyRequestUrl(target: URL, proxyOrigin: string): string {
  return `${proxyOrigin}${PROXY_ENDPOINT_PREFIX}${encodeURIComponent(target.toString())}`
}

export function normalizeProxyBrowserUrl(
  browserUrl: URL,
  currentUrl: URL,
  proxyOrigin: string,
): URL {
  if (browserUrl.origin !== proxyOrigin) {
    return browserUrl
  }

  if (browserUrl.pathname === '/api/proxy') {
    const encodedTarget = browserUrl.searchParams.get('url')
    if (encodedTarget) {
      try {
        return new URL(encodedTarget)
      } catch {
        return currentUrl
      }
    }

    return currentUrl
  }

  return new URL(`${browserUrl.pathname}${browserUrl.search}${browserUrl.hash}`, currentUrl.origin)
}

export function injectProxyDocument(html: string, target: URL): string {
  const withBaseTag = injectBaseTag(html, target)
  if (withBaseTag.includes(PROXY_RUNTIME_ATTRIBUTE)) {
    return withBaseTag
  }

  const runtimeScript = buildProxyRuntimeScript(target)
  const baseTag = buildBaseTag(target)

  if (withBaseTag.includes(baseTag)) {
    return withBaseTag.replace(baseTag, `${baseTag}${runtimeScript}`)
  }

  if (/<head>/i.test(withBaseTag)) {
    return withBaseTag.replace(/<head>/i, `<head>${runtimeScript}`)
  }

  return `${runtimeScript}${withBaseTag}`
}

// --- Error pages ---

export function renderProxyErrorPage(input: {
  title: string
  message: string
  status: number
  code: string
}): string {
  const title = escapeHtml(input.title)
  const message = escapeHtml(input.message)
  const status = String(input.status)
  const code = escapeHtml(input.code)

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #060d0e;
        color: #e8f5f5;
        font-family: system-ui, sans-serif;
      }
      main {
        width: min(32rem, calc(100vw - 2rem));
        border: 1px solid rgba(0, 201, 201, 0.18);
        background: rgba(10, 26, 27, 0.95);
        padding: 1.5rem;
        border-radius: 0.75rem;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
      }
      h1 { margin: 0 0 0.75rem; font-size: 1.25rem; }
      p { margin: 0 0 1rem; line-height: 1.5; color: rgba(232, 245, 245, 0.8); }
      code {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 0.375rem;
        background: rgba(0, 201, 201, 0.12);
        color: #00c9c9;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
      <code>HTTP ${status} · ${code}</code>
    </main>
  </body>
</html>`
}

// --- Upstream markers / classification ---

const UPSTREAM_BODY_MARKERS: Array<[string, RegExp]> = [
  ['cloudflare', /cloudflare|cf-ray|just a moment|checking your browser/i],
  ['captcha', /captcha|are you human|verify you are human/i],
  ['login', /login|sign in|log in/i],
  ['ddos-guard', /ddos-guard/i],
]

function getUpstreamAccessMarker(contentType: string, body: string): string | null {
  if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
    return null
  }

  const sample = body.slice(0, 8_000)

  for (const [marker, pattern] of UPSTREAM_BODY_MARKERS) {
    if (pattern.test(sample)) {
      return marker
    }
  }

  return null
}

function classifyUpstreamFailure(
  status: number,
  contentType: string,
  body: string,
): ProxyRequestError | null {
  const marker = getUpstreamAccessMarker(contentType, body)

  if (marker === 'login' || status === 401) {
    return new ProxyRequestError(
      401,
      'UPSTREAM_LOGIN_REQUIRED',
      'Source requires login in a real browser. Use Open in Tab.',
    )
  }

  if (
    marker === 'cloudflare' ||
    marker === 'captcha' ||
    marker === 'ddos-guard'
  ) {
    return new ProxyRequestError(
      403,
      'UPSTREAM_BROWSER_VERIFICATION_REQUIRED',
      'Source blocked automated access. Use Open in Tab.',
    )
  }

  if (status === 429) {
    return new ProxyRequestError(
      429,
      'UPSTREAM_RATE_LIMITED',
      'Source is rate limiting this proxy. Try again later.',
    )
  }

  if (status === 403) {
    return new ProxyRequestError(
      403,
      'UPSTREAM_ACCESS_DENIED',
      'Source denied access. Try Open in Tab.',
    )
  }

  if (status === 404 || status === 410) {
    return new ProxyRequestError(
      status,
      'UPSTREAM_NOT_FOUND',
      'Source endpoint is no longer available.',
    )
  }

  if (status === 451) {
    return new ProxyRequestError(
      451,
      'UPSTREAM_UNAVAILABLE',
      'Source is unavailable from this region or jurisdiction.',
    )
  }

  if (status >= 500) {
    return new ProxyRequestError(
      status,
      'UPSTREAM_SITE_ERROR',
      `Source returned HTTP ${status}.`,
    )
  }

  if (status >= 400) {
    return new ProxyRequestError(status, 'UPSTREAM_HTTP_ERROR', `Source returned HTTP ${status}.`)
  }

  return null
}

export function mapProxyError(error: unknown): ProxyRequestError {
  if (error instanceof ProxyRequestError) {
    return error
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  ) {
    return new ProxyRequestError(504, 'UPSTREAM_TIMEOUT', 'Upstream request timed out')
  }

  const cause =
    typeof error === 'object' && error !== null && 'cause' in error ? error.cause : undefined
  const causeCode =
    typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : ''

  if (causeCode === 'ENOTFOUND' || causeCode === 'EAI_AGAIN') {
    return new ProxyRequestError(502, 'UPSTREAM_DNS_ERROR', 'Source hostname could not be resolved')
  }

  if (
    causeCode === 'ECONNREFUSED' ||
    causeCode === 'ECONNRESET' ||
    causeCode === 'ENETUNREACH' ||
    causeCode === 'EHOSTUNREACH'
  ) {
    return new ProxyRequestError(502, 'UPSTREAM_CONNECTION_ERROR', 'Source refused the connection')
  }

  if (
    causeCode === 'ETIMEDOUT' ||
    causeCode === 'ECONNABORTED' ||
    causeCode === 'UND_ERR_CONNECT_TIMEOUT'
  ) {
    return new ProxyRequestError(504, 'UPSTREAM_TIMEOUT', 'Upstream request timed out')
  }

  if (
    causeCode.includes('CERT') ||
    causeCode.startsWith('UNABLE_TO_') ||
    causeCode.includes('SSL') ||
    causeCode.includes('TLS') ||
    causeCode.includes('QUIC') ||
    causeCode === 'EPROTO'
  ) {
    return new ProxyRequestError(502, 'UPSTREAM_TLS_ERROR', 'Upstream TLS handshake failed')
  }

  return new ProxyRequestError(502, 'UPSTREAM_FETCH_FAILED', 'Proxy error')
}

// --- Response body with size cap ---

function responseTooLarge(): ProxyRequestError {
  return new ProxyRequestError(
    502,
    'UPSTREAM_RESPONSE_TOO_LARGE',
    'Upstream response exceeded the size limit',
  )
}

async function readTextWithLimit(response: Response, limit: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) {
    throw responseTooLarge()
  }

  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let received = 0
  let output = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > limit) {
      await reader.cancel().catch(() => {})
      throw responseTooLarge()
    }
    output += decoder.decode(value, { stream: true })
  }

  return output + decoder.decode()
}

// --- Redirect handling ---

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

interface HopResult {
  response: Response
  finalUrl: URL
}

async function fetchFollowingRedirects(
  initial: URL,
  fetchImpl: typeof fetch,
  options: ProxyOptions,
  signal: AbortSignal,
): Promise<HopResult> {
  let currentUrl = initial

  for (let hop = 0; ; hop++) {
    await validateTarget(currentUrl, options)

    // Optional DoH pinning — the resolved address must itself be public.
    let fetchTarget: URL | string = currentUrl
    if (options.dnsProvider) {
      const ip = await resolveViaDoH(currentUrl.hostname, options.dnsProvider)
      if (ip) {
        if (isPrivateAddress(ip)) {
          throw new ProxyRequestError(
            403,
            'PRIVATE_HOST_BLOCKED',
            'DNS resolution returned a private/reserved address',
          )
        }
        const resolved = new URL(currentUrl.toString())
        resolved.hostname = ip
        fetchTarget = resolved
      }
    }

    const response = await fetchImpl(fetchTarget, {
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
      },
    })

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location')
      if (!location) {
        return { response, finalUrl: currentUrl }
      }
      if (hop >= MAX_REDIRECT_HOPS) {
        throw new ProxyRequestError(502, 'UPSTREAM_REDIRECT_LOOP', 'Too many redirects')
      }
      response.body?.cancel().catch(() => {})
      currentUrl = new URL(location, currentUrl)
      continue
    }

    // Mocked/odd fetch impls may report a different final URL.
    let finalUrl = currentUrl
    if (response.url) {
      try {
        finalUrl = new URL(response.url)
      } catch {
        finalUrl = currentUrl
      }
    }

    await validateTarget(finalUrl, options, true)
    return { response, finalUrl }
  }
}

// --- Main fetch ---

export async function fetchProxyPayload(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
  options: ProxyOptions = {},
): Promise<ProxyPayload> {
  const initial = parseProxyTarget(rawUrl)
  assertHostAllowed(initial, options.allowedHosts)
  if (options.dnsProvider && !ALLOWED_DOH_ENDPOINTS.has(options.dnsProvider)) {
    throw new ProxyRequestError(400, 'INVALID_DNS_PROVIDER', 'Unsupported DNS provider')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onExternalAbort = () => controller.abort()
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const { response, finalUrl } = await fetchFollowingRedirects(
      initial,
      fetchImpl,
      options,
      controller.signal,
    )

    const contentType = response.headers.get('content-type') || 'text/plain; charset=utf-8'
    const body = options.checkOnly ? '' : await readTextWithLimit(response, MAX_RESPONSE_BYTES)

    const failure = classifyUpstreamFailure(response.status, contentType, body)
    if (failure) {
      throw failure
    }

    if (!options.checkOnly && isScriptableDocument(contentType)) {
      // Defense in depth: document bodies are only served for known sources.
      // When no allowlist could be built (registry outage) we fail open —
      // the CSP sandbox below still isolates the content from the app.
      if (options.documentAllowlist && options.documentAllowlist.size > 0) {
        assertHostAllowed(finalUrl, options.documentAllowlist)
      }

      if (isHtmlContentType(contentType)) {
        const embedIssue = detectEmbeddedProxyIssue(
          extractDocumentTitle(body),
          extractVisibleText(body),
        )
        if (embedIssue) {
          throw new ProxyRequestError(404, 'UPSTREAM_EMBED_UNSUPPORTED', embedIssue)
        }
      }
    }

    const normalizedBody = isHtmlContentType(contentType)
      ? injectProxyDocument(body, finalUrl)
      : body

    return {
      body: normalizedBody,
      contentType,
      status: response.status,
      upstreamUrl: finalUrl.toString(),
      csp: isHtmlContentType(contentType) ? PROXY_CSP_DOCUMENT : PROXY_CSP_STRICT,
    }
  } catch (error) {
    throw mapProxyError(error)
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', onExternalAbort)
  }
}
