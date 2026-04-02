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
        (Object.entries(REPO_URLS) as [Tab, string][]).map(async ([key, url]) => {
          try {
            const res = await fetch(url)
            const data = await res.json()
            return [key, data] as [Tab, Source[]]
          } catch {
            return [key, []] as [Tab, Source[]]
          }
        })
      )
      setRepos(Object.fromEntries(entries) as RepoData)
      setLoading(false)
    }
    fetchAll()
  }, [])

  return { repos, loading }
}
