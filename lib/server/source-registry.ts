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

  const payloads = await Promise.all(
    Object.values(REPO_URLS).map(async (urls) => {
      const sources: SourceEntry[] = []
      for (const url of urls) {
        const response = await fetchImpl(url, { redirect: 'follow' })
        if (!response.ok) {
          continue
        }
        const data = await response.json()
        sources.push(...(data as SourceEntry[]))
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
    throw new Error('Registry fetch returned no hosts')
  }

  cachedHosts = hosts
  cacheExpiresAt = now + CACHE_TTL_MS
  return hosts
}

export function registerAllowedProxyHost(hostname: string): void {
  if (!cachedHosts) {
    return
  }

  for (const host of expandAllowedHostVariants(hostname)) {
    cachedHosts.add(host)
  }
}
