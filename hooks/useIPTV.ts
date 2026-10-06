'use client'
import { useEffect, useState } from 'react'
import { Channel } from '@/lib/types'
import { readSessionCache, writeSessionCache } from '@/lib/session-cache'

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
  {
    id: 'samsung-tv-plus',
    label: 'Samsung TV Plus (200+ channels)',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/samsungtvplus_us.m3u',
  },
  {
    id: 'plex-tv',
    label: 'Plex TV Live Channels',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plex_us.m3u',
  },
  {
    id: 'roku-channel',
    label: 'Roku Channel (300+ channels)',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/roku_all.m3u',
  },
  {
    id: 'vizio-tv',
    label: 'Vizio TV (Kids, News, Food)',
    url: 'https://www.apsattv.com/vizio.m3u',
  },
  {
    id: 'xiaomi-tv',
    label: 'Xiaomi TV+ (250+ channels)',
    url: 'https://www.apsattv.com/xiaomi.m3u',
  },
  {
    id: 'distrotv',
    label: 'DistroTV (250+ channels)',
    url: 'https://www.apsattv.com/distro.m3u',
  },
  {
    id: 'local-now',
    label: 'Local Now (News, Weather, Lifestyle)',
    url: 'https://www.apsattv.com/localnow.m3u',
  },
  {
    id: 'lg-channels',
    label: 'LG Channels (1,000+ channels)',
    url: 'https://www.apsattv.com/lg.m3u',
  },
  {
    id: 'tablo',
    label: 'Tablo (150+ channels)',
    url: 'https://www.apsattv.com/tablo.m3u',
  },
  {
    id: 'fire-tv',
    label: 'Fire TV (50 channels)',
    url: 'https://www.apsattv.com/firetv.m3u',
  },
  {
    id: 'redbox-tv',
    label: 'Redbox TV',
    url: 'https://www.apsattv.com/redbox.m3u',
  },
  {
    id: 'xumo',
    label: 'Xumo (350+ channels)',
    url: 'https://www.apsattv.com/xumo.m3u',
  },
  {
    id: 'news-channels',
    label: 'News Channels',
    url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
  },
  {
    id: 'sports-channels',
    label: 'Sports Channels',
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
  },
  {
    id: 'movie-channels',
    label: 'Movie Channels',
    url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
  },
  {
    id: 'music-channels',
    label: 'Music Channels',
    url: 'https://iptv-org.github.io/iptv/categories/music.m3u',
  },
  {
    id: 'documentary-channels',
    label: 'Documentary Channels',
    url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u',
  },
  {
    id: 'entertainment-channels',
    label: 'Entertainment Channels',
    url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u',
  },
]

// Guard against accidental duplicate ids/urls sneaking back in.
const UNIQUE_SOURCES = SOURCES.filter(
  (source, index, all) =>
    all.findIndex((other) => other.id === source.id) === index &&
    all.findIndex((other) => other.url === source.url) === index,
)

const CACHE_KEY = 'iptv_channels_cache'
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

export function useIPTV() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function fetchAll() {
      const cached = readSessionCache<Channel[]>(CACHE_KEY, CACHE_TTL)
      if (cached) {
        setChannels(cached)
        setLoading(false)
        return
      }

      try {
        const results = await Promise.allSettled(
          UNIQUE_SOURCES.map((source) =>
            fetch(source.url, { signal: controller.signal }).then(async (res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
              return parseM3U(await res.text(), source.label)
            }),
          ),
        )

        const merged: Channel[] = []
        let succeeded = 0
        for (const result of results) {
          if (result.status === 'fulfilled') {
            succeeded += 1
            merged.push(...result.value)
          }
        }

        const seen = new Set<string>()
        const deduped = merged.filter((channel) => {
          if (!channel.url || seen.has(channel.url)) return false
          seen.add(channel.url)
          return true
        })

        if (cancelled) return

        // Every source failing means something is wrong — surface it.
        if (succeeded === 0) {
          setError(true)
        } else {
          writeSessionCache(CACHE_KEY, deduped)
          setChannels(deduped)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => {
      cancelled = true
      controller.abort()
    }
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
