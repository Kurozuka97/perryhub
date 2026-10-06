'use client'
import { useEffect, useState } from 'react'
import { Tab, Source, REPO_URLS, REPO_TABS } from '@/lib/types'
import { getValidSourceUrl } from '@/lib/source-utils'
import { readSessionCache, writeSessionCache } from '@/lib/session-cache'

type RepoData = Record<Tab, Source[]>

const CACHE_KEY = 'repos_cache'
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

const EMPTY_REPOS: RepoData = { manga: [], anime: [], alternative: [] }

/** Validates and deduplicates a merged source list (first URL wins). */
function normalizeSources(sources: Source[]): Source[] {
  const seen = new Set<string>()
  const output: Source[] = []

  for (const source of sources) {
    if (!source || typeof source.name !== 'string') continue
    const url = getValidSourceUrl(source)
    if (!url || seen.has(url)) continue
    seen.add(url)
    output.push(source)
  }

  return output
}

export function useRepos() {
  const [repos, setRepos] = useState<RepoData>(EMPTY_REPOS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function fetchAll() {
      const cached = readSessionCache<RepoData>(CACHE_KEY, CACHE_TTL)
      if (cached) {
        setRepos(cached)
        setLoading(false)
        return
      }

      const entries = await Promise.all(
        (Object.entries(REPO_URLS) as [Tab, string[]][]).map(async ([key, urls]) => {
          const results = await Promise.allSettled(
            urls.map((url) =>
              fetch(url, { signal: controller.signal }).then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data = await res.json()
                if (!Array.isArray(data)) throw new Error('Repo payload is not an array')
                return data as Source[]
              }),
            ),
          )
          const merged = results
            .filter((r): r is PromiseFulfilledResult<Source[]> => r.status === 'fulfilled')
            .flatMap((r) => r.value)
          return [key, normalizeSources(merged)] as [Tab, Source[]]
        }),
      )

      if (cancelled) return

      const data = Object.fromEntries(entries) as RepoData
      for (const tab of REPO_TABS) {
        if (!data[tab]) data[tab] = []
      }
      writeSessionCache(CACHE_KEY, data)
      setRepos(data)
      setLoading(false)
    }

    fetchAll()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  return { repos, loading }
}
