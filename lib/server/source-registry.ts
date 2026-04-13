import { REPO_URLS } from '../types.js'
import { getValidSourceUrl } from '../source-utils.js'

interface SourceEntry {
  baseUrl?: string
  sources?: Array<{ baseUrl?: string }>
}

const CACHE_TTL_MS = 10 * 60 * 1000
const SAME_SITE_PREFIXES = new Set(['www', 'm', 'mobile', 'read', 'reader', 'beta', 'app', 'cms', 'wp'])

let cachedHosts: Set<string> | null = null
let cacheExpiresAt = 0
// Keep the last known good hosts so a temporary registry fetch failure
// doesn't suddenly deny all traffic.
let lastGoodHosts: Set<string> | null = null

export function expandAllowedHostVariants(hostname: string): Set<string> {
  const normalized = hostname.toLowerCase()
  const variants = new Set<string>([normalized])
  const labels = normalized.split('.')

  if (labels.length === 2) {
    variants.add(`www.${normalized}`)
    return variants
  }

  const [prefix, ...rest] = labels
  const parentHost = rest.join('.')
  if (parentHost && SAME_SITE_PREFIXES.has(prefix)) {
    variants.add(parentHost)
    if (rest.length === 2) {
      variants.add(`www.${parentHost}`)
    }
  }

  if (prefix === 'www' && parentHost) {
    variants.add(parentHost)
  }

  return variants
}

function collectHostnames(entries: SourceEntry[]): Set<string> {
  const hosts = new Set<string>()

  for (const entry of entries) {
    const validUrl = getValidSourceUrl(entry)
    if (!validUrl) {
      continue
    }

    for (const host of expandAllowedHostVariants(new URL(validUrl).hostname)) {
      hosts.add(host)
    }
  }

  return hosts
}

export async function getAllowedProxyHosts(fetchImpl: typeof fetch = fetch): Promise<Set<string>> {
  const now = Date.now()
  if (cachedHosts && now < cacheExpiresAt) {
    return cachedHosts
  }

  try {
    // Fetch all repo URLs — each one is independent; partial failures are OK.
    const payloads = await Promise.all(
      Object.values(REPO_URLS).map(async (urls) => {
        const sources: SourceEntry[] = []
        for (const url of urls) {
          try {
            const response = await fetchImpl(url, { redirect: 'follow' })
            if (!response.ok) continue
            const data = await response.json()
            if (Array.isArray(data)) {
              sources.push(...(data as SourceEntry[]))
            }
          } catch {
            // One failed URL should never block the others
          }
        }
        return sources
      }),
    )

    const hosts = new Set<string>()
    for (const payload of payloads) {
      for (const host of collectHostnames(payload)) {
        hosts.add(host)
      }
    }

    if (hosts.size === 0) {
      // Registry returned nothing — fall back to last known good set if available
      if (lastGoodHosts && lastGoodHosts.size > 0) {
        console.warn('[source-registry] Registry returned 0 hosts; using last known good allowlist')
        cachedHosts = lastGoodHosts
        cacheExpiresAt = now + CACHE_TTL_MS
        return cachedHosts
      }
      throw new Error('Registry fetch returned no hosts and no fallback is available')
    }

    cachedHosts = hosts
    lastGoodHosts = hosts
    cacheExpiresAt = now + CACHE_TTL_MS
    return hosts
  } catch (err) {
    // On total failure, serve last known good hosts instead of blocking everything
    if (lastGoodHosts && lastGoodHosts.size > 0) {
      console.warn('[source-registry] Registry fetch failed; using last known good allowlist:', err)
      cachedHosts = lastGoodHosts
      cacheExpiresAt = now + CACHE_TTL_MS
      return cachedHosts
    }
    throw err
  }
}

export function registerAllowedProxyHost(hostname: string): void {
  if (!cachedHosts) {
    return
  }

  for (const host of expandAllowedHostVariants(hostname)) {
    cachedHosts.add(host)
  }
}
