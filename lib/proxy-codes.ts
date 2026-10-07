/**
 * Shared classification of /api/proxy error codes — used by the client to
 * decide when to fall back to a direct iframe, and by the health checker to
 * label sources.
 */

/**
 * Server-side access fails but a direct browser load often succeeds — bot
 * walls, datacenter IP blocks, TLS quirks. Also implies direct-iframe
 * fallback on the client ("Needs ext. browser" when the browser is beaten too).
 */
export const BROWSER_REQUIRED_CODES = new Set([
  'UPSTREAM_BROWSER_VERIFICATION_REQUIRED',
  'UPSTREAM_ACCESS_DENIED',
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_LOGIN_REQUIRED',
  'UPSTREAM_TLS_ERROR',
  'UPSTREAM_CONNECTION_ERROR',
  'UPSTREAM_FETCH_FAILED',
])

/** Genuinely unreachable / gone. */
export const DEAD_CODES = new Set([
  'UPSTREAM_NOT_FOUND',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_SITE_ERROR',
  'UPSTREAM_HTTP_ERROR',
  'UPSTREAM_DNS_ERROR',
  'UPSTREAM_RESPONSE_TOO_LARGE',
  'UPSTREAM_REDIRECT_LOOP',
])

/** Not proxied at all — the client silently uses a direct iframe instead. */
export const DIRECT_FALLBACK_CODES = new Set([
  ...BROWSER_REQUIRED_CODES,
  'UNSUPPORTED_PROTOCOL',
  'INVALID_URL',
  'PRIVATE_HOST_BLOCKED',
  'HOST_NOT_ALLOWED',
  'INVALID_DNS_PROVIDER',
  'RATE_LIMITED',
])
