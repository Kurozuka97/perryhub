'use client'
import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Channel } from '@/lib/types'
import { useIPTV } from '@/hooks/useIPTV'
import IPTVPlayer from './IPTVPlayer'

type StreamStatus = 'checking' | 'live' | 'dead'

export default function IPTVTab() {
  const { channels, loading, error } = useIPTV()
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('all')
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [limit, setLimit] = useState(200)
  const [streamStatus, setStreamStatus] = useState<Record<string, StreamStatus>>({})

  const checkStream = useCallback(async (channel: Channel) => {
    if (streamStatus[channel.url]) return // already checked
    setStreamStatus(prev => ({ ...prev, [channel.url]: 'checking' }))
    try {
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(channel.url)}`, {
        signal: AbortSignal.timeout(5000),
      })
      setStreamStatus(prev => ({ ...prev, [channel.url]: res.ok ? 'live' : 'dead' }))
    } catch {
      setStreamStatus(prev => ({ ...prev, [channel.url]: 'dead' }))
    }
  }, [streamStatus])

  const countries = useMemo(() => {
    return Array.from(new Set(channels.map(c => c.country).filter(Boolean))).sort()
  }, [channels])

  const filtered = useMemo(() => {
    setLimit(200)
    return channels.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
      const matchCountry = country === 'all' || c.country === country
      return matchSearch && matchCountry
    })
  }, [channels, search, country])

  const visible = filtered.slice(0, limit)

  function getDotColor(url: string) {
    const s = streamStatus[url]
    if (s === 'live') return '#00ff88'
    if (s === 'dead') return '#ff4444'
    if (s === 'checking') return '#ff8c42'
    return '#1a3a3a'
  }

  function getDotGlow(url: string) {
    return streamStatus[url] === 'live' ? '0 0 6px #00ff88' : 'none'
  }

  if (error) return (
    <div className="flex items-center justify-center h-48">
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#1a3a3a', textTransform: 'uppercase', letterSpacing: 2 }}>
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
          onClose={() => setActiveChannel(null)}
        />
      )}

      {/* Filter bar */}
      <div className="shrink-0 px-4 md:px-8 py-4 flex flex-wrap gap-3 items-center" style={{ borderBottom: '1px solid rgba(0,201,201,0.05)' }}>
        <div className="flex-1 min-w-[160px] flex items-center gap-3 pb-2" style={{ borderBottom: '1px solid rgba(0,201,201,0.1)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a3a3a" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search channels..."
            className="flex-1 bg-transparent outline-none uppercase"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#e8f5f5' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#1a3a3a' }}>
              Clear
            </button>
          )}
        </div>

        <select
          value={country}
          onChange={e => setCountry(e.target.value)}
          className="rounded outline-none cursor-pointer uppercase"
          style={{ background: 'transparent', border: '1px solid rgba(0,201,201,0.1)', padding: '6px 10px', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#4a8888' }}
        >
          <option value="all">All Countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#1a3a3a', flexShrink: 0 }}>
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
              {visible.map((channel, i) => (
                <motion.button
                  key={`${channel.name}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(i * 0.01, 0.3) }}
                  onClick={() => setActiveChannel(channel)}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,201,201,0.3)'
                    e.currentTarget.style.background = '#0d2022'
                    checkStream(channel)
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(0,201,201,0.07)'
                    e.currentTarget.style.background = '#0a1a1b'
                  }}
                  className="text-left rounded p-4 transition-all"
                  style={{ background: '#0a1a1b', border: '1px solid rgba(0,201,201,0.07)' }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={channel.name}
                        width={32}
                        height={32}
                        style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }}
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <div style={{
                        width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                        background: 'rgba(0,201,201,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c9c9" strokeWidth="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                      </div>
                    )}
                    <span className="text-sm font-medium truncate" style={{ color: 'rgba(232,245,245,0.9)' }}>
                      {channel.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#a0c4c4', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {channel.country || 'N/A'}
                    </span>
                    <div
                      className="w-1.5 h-1.5 rounded-full transition-all"
                      style={{
                        background: getDotColor(channel.url),
                        boxShadow: getDotGlow(channel.url),
                      }}
                    />
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Load More */}
            {filtered.length > limit && (
              <button
                onClick={() => setLimit(l => l + 200)}
                className="w-full py-3 mt-6 rounded transition-all"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#4a8888', border: '1px solid rgba(0,201,201,0.1)', letterSpacing: 1, textTransform: 'uppercase' }}
                onMouseEnter={e => e.currentTarget.style.color = '#00c9c9'}
                onMouseLeave={e => e.currentTarget.style.color = '#4a8888'}
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
