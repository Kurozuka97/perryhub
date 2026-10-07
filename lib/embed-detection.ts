const EMBED_ROUTE_MISMATCH_LEADING_PATTERNS = [/^404(?:\s|$)/i]

const EMBED_ROUTE_MISMATCH_BODY_PATTERNS = [
  /page not found\.?(?:\s+the page you are trying to get doesn't exist\.?)?/i,
  /the page you are trying to get doesn't exist\.?/i,
]

// Explicit refusal language only — conservative so normal pages (app-store
// CTAs, footers) are never classified as refusing to embed.
const EMBED_REFUSAL_PATTERNS = [
  /open in (an? |the |our |your )?(external |another |a different )?browser/i,
  /web version (is )?(unavailable|not available)/i,
  /not available (in|on|for) (the )?(this )?browser/i,
  /download (our |the |its )?(mobile )?app\s+to\s+(continue|watch|view|read|listen|browse)/i,
]

export function detectEmbeddedProxyIssue(title: string, bodyText: string): string | null {
  const normalizedTitle = title.replace(/\s+/g, ' ').trim()
  const normalizedBody = bodyText.replace(/\s+/g, ' ').trim()
  const leadingText = normalizedBody.slice(0, 160)
  const bodySample = normalizedBody.slice(0, 600)

  const looksLikeNotFound =
    EMBED_ROUTE_MISMATCH_LEADING_PATTERNS.some((pattern) => pattern.test(leadingText)) ||
    EMBED_ROUTE_MISMATCH_BODY_PATTERNS.some((pattern) => pattern.test(bodySample)) ||
    (normalizedTitle === '404' && normalizedBody.length > 0)

  if (looksLikeNotFound) {
    return 'Source loaded, but its frontend rejected the embedded proxy URL. Use Open in Tab.'
  }

  const refusalText = `${normalizedTitle} ${normalizedBody.slice(0, 600)}`
  if (EMBED_REFUSAL_PATTERNS.some((pattern) => pattern.test(refusalText))) {
    return 'Source requires an external browser. Use Open in Tab.'
  }

  return null
}
