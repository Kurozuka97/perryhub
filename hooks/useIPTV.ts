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
    id: 'iptv-org',
    label: 'NFSW',
    url: 'https://iptv-org.github.io/iptv/index.nsfw.m3u',
  },
]

export function useIPTV() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchAll() {
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

        // Dedupe by stream URL
        const seen = new Set<string>()
        const deduped = merged.filter(ch => {
          if (seen.has(ch.url)) return false
          seen.add(ch.url)
          return true
        })

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
