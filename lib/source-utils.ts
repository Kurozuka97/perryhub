import type { Source } from './types.ts'
import { isPrivateAddress } from './net.ts'

/** Strips upstream prefix noise from display names. */
export function cleanSourceName(name: string): string {
  return name.replace(/Tachiyomi: |Aniyomi: /g, '')
}

interface SourceUrlEntry {
  baseUrl?: string
}

interface SourceUrlCandidate {
  baseUrl?: string
  sources?: SourceUrlEntry[]
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

      if (isPrivateAddress(parsed.hostname)) {
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
