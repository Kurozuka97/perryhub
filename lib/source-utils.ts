import type { Source } from './types'

interface SourceUrlEntry {
  baseUrl?: string
}

interface SourceUrlCandidate {
  baseUrl?: string
  sources?: SourceUrlEntry[]
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/i,
]

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
}

function extractUrlCandidates(rawUrl?: string): string[] {
  if (!rawUrl) {
    return []
  }

  return rawUrl
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function getValidSourceUrl(source: SourceUrlCandidate): string | null {
  const candidates = [
    ...(source.sources?.flatMap((entry) => extractUrlCandidates(entry.baseUrl)) || []),
    ...extractUrlCandidates(source.baseUrl),
  ]

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        continue
      }

      if (isPrivateHost(parsed.hostname)) {
        continue
      }

      return parsed.toString()
    } catch {
      continue
    }
  }

  return null
}

export function sanitizeSource(source: Source): Source | null {
  const validUrl = getValidSourceUrl(source)
  if (!validUrl) {
    return null
  }

  const sanitizedSources = source.sources?.length
    ? [{ baseUrl: validUrl }]
    : undefined

  return {
    ...source,
    baseUrl: validUrl,
    sources: sanitizedSources,
  }
}

export function sanitizeSources(sources: Source[]): Source[] {
  return sources
    .map((source) => sanitizeSource(source))
    .filter((source): source is Source => Boolean(source))
}
