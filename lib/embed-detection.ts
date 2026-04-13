const EMBED_ROUTE_MISMATCH_LEADING_PATTERNS = [/^404(?:\s|$)/i]

const EMBED_ROUTE_MISMATCH_BODY_PATTERNS = [
  /page not found\.?(?:\s+the page you are trying to get doesn't exist\.?)?/i,
  /the page you are trying to get doesn't exist\.?/i,
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

  if (!looksLikeNotFound) {
    return null
  }

  return 'Source loaded, but its frontend rejected the embedded proxy URL. Use Open in Tab.'
}
