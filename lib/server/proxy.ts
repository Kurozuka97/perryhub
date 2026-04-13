const HTML_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml'])
const REQUEST_TIMEOUT_MS = 15_000
const MAX_REDIRECT_HOPS = 5
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const PROXY_RUNTIME_ATTRIBUTE = 'data-perry-proxy-runtime'
const PROXY_ENDPOINT_PREFIX = '/api/proxy?url='

// --- IP / hostname validation ---

const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^127\./,
  /^0\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
]

const PRIVATE_IPV6_PREFIXES = [
  '::1',
  'fc00',
  'fd00',
  'fe80',
  'fe90',
  'fea0',
  'feb0',
  'fec0',
  'fed0',
  'fee0',
  'fef0',
  '::ffff:127.',
  '::ffff:10.',
  '::ffff:192.168.',
  '::ffff:172.',
  '::ffff:169.254.',
  '::ffff:0.',
]

function isPrivateIpv4(host: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((p) => p.test(host))
}

function isPrivateIpv6(host: string): boolean {
  const lower = host.toLowerCase()
  const bare = lower.replace(/^\[|\]$/g, '')
  return PRIVATE_IPV6_PREFIXES.some((prefix) => bare.startsWith(prefix))
}

function isLocalHostname(hostname: string): boolean {
  return /^localhost$/i.test(hostname)
}

export function isPrivateAddress(hostname: string): boolean {
  return (
    isLocalHostname(hostname) ||
    isPrivateIpv4(hostname) ||
    isPrivateIpv6(hostname)
  )
}

// --- DoH resolver ---

const DOH_CACHE = new Map<string, string>()

async function resolveViaDoH(hostname: string, dohUrl: string): Promise<string | null> {
  const cacheKey = `${dohUrl}|${hostname}`
  if (DOH_CACHE.has(cacheKey)) return DOH_CACHE.get(cacheKey)!

  try {
    const url = `${dohUrl}?name=${encodeURIComponent(hostname)}&type=A`
    const res = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const data = await res.json() as { Answer?: { type: number; data: string }[] }
    const ip = data.Answer?.find(r => r.type === 1)?.data ?? null
    if (ip) DOH_CACHE.set(cacheKey, ip)
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
  upstreamStatusText: string
}

interface ProxyOptions {
  allowedHosts?: Set<string>
  dnsProvider?: string
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

// --- HTML helpers ---

export function isHtmlContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase().split(';')[0].trim()
  return HTML_CONTENT_TYPES.has(normalized)
}

// --- DOM injection ---

export function injectBaseTag(html: string, target: URL): string {
  const baseTag = `<base href="${target.toString()}">`

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

export function buildProxyRuntimeScript(target: URL): string {
  const targetUrl = JSON.stringify(target.toString())
  const proxyPath = JSON.stringify(PROXY_ENDPOINT_PREFIX)

  return `<script ${PROXY_RUNTIME_ATTRIBUTE}="1">(function(){if(window.__PERRY_PROXY_RUNTIME__)return;window.__PERRY_PROXY_RUNTIME__=true;
const proxyOrigin=window.location.origin;const proxyPrefix=proxyOrigin+${proxyPath};let currentUrl=new URL(${targetUrl});function toAbsolute(input,base){try{return new URL(String(input),base||currentUrl);}catch{return null;}}function normalizeForProxy(absolute){if(!absolute||!/^https?:$/.test(absolute.protocol))return absolute;if(absolute.origin!==proxyOrigin)return absolute;if(absolute.pathname==='/api/proxy'){const encodedTarget=absolute.searchParams.get('url');if(encodedTarget){const decoded=toAbsolute(encodedTarget,currentUrl);if(decoded)return decoded;}return currentUrl;}return new URL(absolute.pathname+absolute.search+absolute.hash,currentUrl.origin);}function toProxyUrl(input,base){const absolute=toAbsolute(input,base);const normalized=normalizeForProxy(absolute);if(!normalized||!/^https?:$/.test(normalized.protocol))return input;return proxyPrefix+encodeURIComponent(normalized.toString());}function rewriteHistoryUrl(url){if(url==null||url==='')return url;const absolute=toAbsolute(url,currentUrl);const normalized=normalizeForProxy(absolute);if(!normalized||!/^https?:$/.test(normalized.protocol))return url;currentUrl=normalized;return proxyPrefix+encodeURIComponent(normalized.toString());}if(window.fetch){const originalFetch=window.fetch.bind(window);window.fetch=function(input,init){try{if(input instanceof Request){return originalFetch(new Request(toProxyUrl(input.url,currentUrl),input),init);}if(typeof input==='string'||input instanceof URL){return originalFetch(toProxyUrl(String(input),currentUrl),init);}}catch{}return originalFetch(input,init);};}const originalOpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url){const args=Array.prototype.slice.call(arguments);try{args[1]=toProxyUrl(String(url),currentUrl);}catch{}return originalOpen.apply(this,args);};const originalPushState=history.pushState.bind(history);history.pushState=function(state,unused,url){return originalPushState(state,unused,rewriteHistoryUrl(url));};const originalReplaceState=history.replaceState.bind(history);history.replaceState=function(state,unused,url){return originalReplaceState(state,unused,rewriteHistoryUrl(url));};document.addEventListener('click',function(event){const target=event.target;if(!(target instanceof Element))return;const anchor=target.closest('a[href]');if(!anchor)return;const href=anchor.getAttribute('href');if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||href.startsWith('javascript:'))return;const proxyUrl=toProxyUrl(href,currentUrl);if(typeof proxyUrl!=='string'||!proxyUrl.startsWith(proxyPrefix))return;if(anchor.target&&anchor.target!=='_self'){anchor.setAttribute('href',proxyUrl);return;}event.preventDefault();window.location.assign(proxyUrl);},true);})();</script>`
}

export function injectProxyDocument(html: string, target: URL): string {
  const withBaseTag = injectBaseTag(html, target)
  if (withBaseTag.includes(PROXY_RUNTIME_ATTRIBUTE)) {
    return withBaseTag
  }

  const runtimeScript = buildProxyRuntimeScript(target)
  const baseTag = `<base href="${target.toString()}">`

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
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title}</title>
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
      <h1>${input.title}</h1>
      <p>${input.message}</p>
      <code>HTTP ${input.status} · ${input.code}</code>
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

  if (causeCode.includes('CERT') || causeCode.startsWith('UNABLE_TO_')) {
    return new ProxyRequestError(502, 'UPSTREAM_TLS_ERROR', 'Upstream TLS handshake failed')
  }

  return new ProxyRequestError(502, 'UPSTREAM_FETCH_FAILED', 'Proxy error')
}

// --- Main fetch with manual redirect following ---

export async function fetchProxyPayload(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
  options: ProxyOptions = {},
): Promise<ProxyPayload> {
  const initial = parseProxyTarget(rawUrl)
  assertHostAllowed(initial, options.allowedHosts)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    // Resolve hostname via DoH if configured
    let fetchTarget: string | URL = initial
    if (options.dnsProvider) {
      const ip = await resolveViaDoH(initial.hostname, options.dnsProvider)
      if (ip) {
        const resolved = new URL(initial.toString())
        resolved.hostname = ip
        fetchTarget = resolved
      }
    }

    // Follow redirects automatically; Node.js fetch follows by default.
    // We validate the final URL after the response arrives.
    const response = await fetchImpl(fetchTarget, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
      },
    })

    // Validate the final URL after all redirects
    const finalUrl = response.url ? new URL(response.url) : initial
    assertHostAllowed(finalUrl, options.allowedHosts)
    if (isPrivateAddress(finalUrl.hostname)) {
      throw new ProxyRequestError(
        403,
        'PRIVATE_HOST_BLOCKED',
        'Redirect to a private/reserved host is not allowed',
      )
    }

    const contentType = response.headers.get('content-type') || 'text/plain; charset=utf-8'
    const body = await response.text()
    const failure = classifyUpstreamFailure(response.status, contentType, body)
    if (failure) {
      throw failure
    }

    const normalizedBody = isHtmlContentType(contentType)
      ? injectProxyDocument(body, finalUrl)
      : body

    return {
      body: normalizedBody,
      contentType,
      status: response.status,
      upstreamUrl: finalUrl.toString(),
      upstreamStatusText: response.statusText,
    }
  } catch (error) {
    throw mapProxyError(error)
  } finally {
    clearTimeout(timeout)
  }
}
