'use client'
import { useEffect, useState } from 'react'
import { Tab, Source, REPO_URLS } from '@/lib/types'

type RepoData = Record<Tab, Source[]>

const CACHE_KEY = 'repos_cache'
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

interface CacheEntry {
  repos: RepoData
  cachedAt: number
}

function getCache(): RepoData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    const expired = Date.now() - entry.cachedAt > CACHE_TTL
    if (expired) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return entry.repos
  } catch {
    return null
  }
}

function setCache(repos: RepoData) {
  try {
    const entry: CacheEntry = { repos, cachedAt: Date.now() }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // sessionStorage full — skip caching
  }
}

export function useRepos() {
  const [repos, setRepos] = useState<RepoData>({ manga: [], anime: [], alternative: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      // Check cache first
      const cached = getCache()
      if (cached) {
        setRepos(cached)
        setLoading(false)
        return
      }

      const entries = await Promise.all(
        (Object.entries(REPO_URLS) as [Tab, string[]][]).map(async ([key, urls]) => {
          const results = await Promise.allSettled(
            urls.map(url => fetch(url).then(res => res.json()))
          )
          const merged = results
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => (r as PromiseFulfilledResult<Source[]>).value)
          return [key, merged] as [Tab, Source[]]
        })
      )

      const data = Object.fromEntries(entries) as RepoData
      setCache(data)
      setRepos(data)
      setLoading(false)
    }

    fetchAll()
  }, [])

  return { repos, loading }
}
