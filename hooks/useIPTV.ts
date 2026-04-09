'use client'
import { useEffect, useState } from 'react'
import { Channel } from '@/lib/types'

const SOURCES = [
  {
    id: 'iptv-org',
    label: 'IPTV-Org (Global)',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
  },
  {
    id: 'free-tv',
    label: 'Free-TV (HD Only)',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
  },
  {
    id: 'pluto-tv',
    label: 'Pluto TV',
    url: 'https://i.mjh.nz/PlutoTV/all.m3u8',
  },
]

const CACHE_KEY = 'iptv_channels_cache'
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

interface CacheEntry {
  channels: Channel[]
  cachedAt: number
}

function getCache(): Channel[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    const expired = Date.now() - entry.cachedAt > CACHE_TTL
    if (expired) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return entry.channels
  } catch {
    return null
  }
}

function setCache(channels: Channel[]) {
  try {
    const entry: CacheEntry = { channels, cachedAt: Date.now() }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // sessionStorage full — skip caching
  }
}

export function useIPTV() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchAll() {
      // Check cache first
      const cached = getCache()
      if (cached) {
        setChannels(cached)
        setLoading(false)
        return
      }

      try {
        const results = await Promise.allSettled(
          SOURCES.map(s =>
            fetch(s.url)
              .then(res => res.text())
              .then(text => parseM3U(text, s.label))
          )
        )

        const merged: Channel[] = []
        for (const result of results) {
          if (result.status === 'fulfilled') merged.push(...result.value)
        }

        const seen = new Set<string>()
        const deduped = merged.filter(ch => {
          if (seen.has(ch.url)) return false
          seen.add(ch.url)
          return true
        })

        setCache(deduped)
        setChannels(deduped)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [])

  return { channels, loading, error }
}

function parseM3U(text: string, sourceLabel?: string): Channel[] {
  const lines = text.split('\n')
  const channels: Channel[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('#EXTINF')) continue
    const name = line.match(/,(.+)$/)?.[1]?.trim() || 'Unknown'
    const logo = line.match(/tvg-logo="([^"]+)"/)?.[1]
    const group = line.match(/group-title="([^"]+)"/)?.[1]
    const country = line.match(/tvg-country="([^"]+)"/)?.[1]
    const language = line.match(/tvg-language="([^"]+)"/)?.[1]
    const url = lines[i + 1]?.trim()
    if (url && !url.startsWith('#')) {
      channels.push({ name, url, logo, group, country, language, source: sourceLabel })
    }
  }
  return channels
}
