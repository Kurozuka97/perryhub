'use client'
import { useEffect, useState } from 'react'
import { Tab, Source, REPO_URLS } from '@/lib/types'

type RepoData = Record<Tab, Source[]>

export function useRepos() {
  const [repos, setRepos] = useState<RepoData>({ manga: [], anime: [], alternative: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
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
      setRepos(Object.fromEntries(entries) as RepoData)
      setLoading(false)
    }
    fetchAll()
  }, [])

  return { repos, loading }
}
