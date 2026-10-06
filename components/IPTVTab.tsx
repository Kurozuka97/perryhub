'use client'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Channel } from '@/lib/types'
import { useIPTV } from '@/hooks/useIPTV'

const IPTVPlayer = dynamic(() => import('./IPTVPlayer'), { ssr: false })

type StreamStatus = 'checking' | 'live' | 'dead'

function useStreamCheck() {
  const [streamStatus, setStreamStatus] = useState<Record<string, StreamStatus>>({})
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const checkedUrlsRef = useRef<Set<string>>(new Set())

  const checkStream = useCallback(async (url: string) => {
    if (checkedUrlsRef.current.has(url)) return

    const controller = new AbortController()
    abortControllersRef.current.set(url, controller)
    checkedUrlsRef.current.add(url)

    setStreamStatus(prev => ({ ...prev, [url]: 'checking' }))
    try {
      // check=1 asks the proxy for a headers-only probe — no body download.
      const res = await fetch(`/api/proxy?check=1&url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
      })
      if (res.ok) {
        setStreamStatus(prev => ({ ...prev, [url]: 'live' }))
        return
      }
      const code = res.headers.get('x-proxy-error-code')
      if (code === 'RATE_LIMITED') {
        // Transient — allow a future retry instead of marking it dead.
        checkedUrlsRef.current.delete(url)
        setStreamStatus(prev => {
          const next = { ...prev }
          delete next[url]
          return next
        })
      } else {
        setStreamStatus(prev => ({ ...prev, [url]: 'dead' }))
      }
    } catch {
      if (!controller.signal.aborted) {
        setStreamStatus(prev => ({ ...prev, [url]: 'dead' }))
      }
    } finally {
      abortControllersRef.current.delete(url)
    }
  }, [])

  useEffect(() => {
    const controllers = abortControllersRef.current
    const checked = checkedUrlsRef.current
    return () => {
      controllers.forEach(controller => controller.abort())
      controllers.clear()
      checked.clear()
    }
  }, [])

  return { streamStatus, checkStream }
}

function ChannelCard({
  channel,
  onPlay,
  streamStatus,
  onVisible,
}: {
  channel: Channel
  onPlay: (ch: Channel) => void
  streamStatus: StreamStatus | undefined
  onVisible: (url: string) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible(channel.url)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [channel.url, onVisible])

  function getDotColor() {
    if (streamStatus === 'live') return '#00ff88'
    if (streamStatus === 'dead') return '#ff4444'
    if (streamStatus === 'checking') return '#ff8c42'
    return '#1a3a3a'
  }

  const dotLabel = streamStatus === 'live' ? 'Stream is live'
    : streamStatus === 'dead' ? 'Stream is unavailable'
    : streamStatus === 'checking' ? 'Checking stream'
    : 'Not checked yet'

  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onPlay(channel)}
      className="text-left rounded p-4 transition-colors bg-[#0a1a1b] border border-[rgba(0,201,201,0.07)] hover:border-[rgba(0,201,201,0.3)] hover:bg-[#0d2022] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
    >
      <div className="flex items-center gap-3 mb-2">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt=""
            width={32}
            height={32}
            style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: 4, flexShrink: 0,
            background: 'rgba(0,201,201,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c9c9" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>
            </svg>
          </div>
        )}
        <span className="text-sm font-medium truncate" style={{ color: 'rgba(232,245,245,0.9)' }}>
          {channel.name}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#a0c4c4', textTransform: 'uppercase', letterSpacing: 1 }}>
          {channel.country || 'N/A'}
        </span>
        <span
          className="sr-only"
          aria-live="polite"
        >
          {dotLabel}
        </span>
        <div
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full transition-all duration-300"
          style={{
            background: getDotColor(),
            boxShadow: streamStatus === 'live' ? '0 0 6px #00ff88' : 'none',
          }}
        />
      </div>
    </motion.button>
  )
}

export default function IPTVTab() {
  const { channels, loading, error } = useIPTV()
  const { streamStatus, checkStream } = useStreamCheck()
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('all')
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [limit, setLimit] = useState(200)

  const countries = useMemo(() => {
    return Array.from(new Set(channels.map(c => c.country).filter(Boolean))).sort()
  }, [channels])

  const filtered = useMemo(() => {
    return channels.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
      const matchCountry = country === 'all' || c.country === country
      return matchSearch && matchCountry
    })
  }, [channels, search, country])

  // Reset pagination when the result set changes (never inside useMemo).
  useEffect(() => {
    setLimit(200)
  }, [search, country, channels])

  const visible = filtered.slice(0, limit)
  const closePlayer = useCallback(() => setActiveChannel(null), [])

  if (error) return (
    <div className="flex items-center justify-center h-48" role="alert">
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#f87171', textTransform: 'uppercase', letterSpacing: 2 }}>
        Failed to load channels
      </p>
    </div>
  )

  return (
    <>
      {activeChannel && (
        <IPTVPlayer
          url={activeChannel.url}
          name={activeChannel.name}
          onClose={closePlayer}
        />
      )}

      {/* Filter bar */}
      <div className="shrink-0 px-4 md:px-8 py-4 flex flex-wrap gap-3 items-center" style={{ borderBottom: '1px solid rgba(0,201,201,0.05)' }}>
        <div className="flex-1 min-w-[160px] flex items-center gap-3 pb-2" style={{ borderBottom: '1px solid rgba(0,201,201,0.1)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a3a3a" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search channels"
            placeholder="Search channels..."
            className="flex-1 bg-transparent outline-none uppercase"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#e8f5f5' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear channel search"
              className="hover:text-[#e8f5f5] transition-colors bg-transparent border-0 p-0 cursor-pointer"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#4a8888' }}
            >
              Clear
            </button>
          )}
        </div>

        <select
          value={country}
          onChange={e => setCountry(e.target.value)}
          aria-label="Filter by country"
          className="rounded outline-none cursor-pointer uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
          style={{ background: 'transparent', border: '1px solid rgba(0,201,201,0.1)', padding: '6px 10px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#7ecece' }}
        >
          <option value="all">All Countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <span aria-live="polite" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6ababa', flexShrink: 0 }}>
          {visible.length}/{filtered.length} channels
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {loading ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-20 rounded animate-pulse" style={{ background: '#0a1a1b' }} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {visible.map((channel) => (
                <ChannelCard
                  key={channel.url}
                  channel={channel}
                  onPlay={setActiveChannel}
                  streamStatus={streamStatus[channel.url]}
                  onVisible={checkStream}
                />
              ))}
            </div>

            {filtered.length > limit && (
              <button
                onClick={() => setLimit(l => l + 200)}
                className="w-full py-3 mt-6 rounded transition-colors hover:text-[#00c9c9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#4a8888', border: '1px solid rgba(0,201,201,0.1)', letterSpacing: 1, textTransform: 'uppercase' }}
              >
                Load More — {filtered.length - limit} remaining
              </button>
            )}
          </>
        )}
      </div>
    </>
  )
}
