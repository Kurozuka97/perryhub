'use client'
import { useEffect, useState } from 'react'
import { Channel } from '@/lib/types'

const M3U_URL = 'https://iptv-org.github.io/iptv/index.m3u'

export function useIPTV() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchM3U() {
      try {
        // Fetch direct — GitHub Pages ada CORS *
        const res = await fetch(M3U_URL)
        const text = await res.text()
        const parsed = parseM3U(text)
        setChannels(parsed)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchM3U()
  }, [])

  return { channels, loading, error }
}

function parseM3U(text: string): Channel[] {
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
      channels.push({ name, url, logo, group, country, language })
    }
  }

  return channels
}
