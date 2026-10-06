'use client'
import { Source, Tab } from '@/lib/types'
import { motion } from 'framer-motion'
import { useState, useEffect, useRef, memo } from 'react'
import { checkSourceHealth, recheckSourceHealth, SourceHealthStatus } from '@/lib/source-health'
import { getValidSourceUrl, cleanSourceName } from '@/lib/source-utils'

interface Props {
  source: Source
  index: number
  tab?: Tab | string          // only 'anime' triggers health check
  onSelect: (url: string, name: string) => void
  onBookmark?: (source: Source) => void
  bookmarked?: boolean
}

const BADGE: Record<SourceHealthStatus, { dot: string; text: string; label: string }> = {
  checking: { dot: '#3b82f6', text: '#6ababa', label: 'Checking…' },
  ok:       { dot: '#4ade80', text: '#4ade80', label: 'Works directly' },
  slow:     { dot: '#fb923c', text: '#fb923c', label: 'Slow response' },
  blocked:  { dot: '#facc15', text: '#facc15', label: 'Needs ext. browser' },
  dead:     { dot: '#f87171', text: '#f87171', label: 'Dead link' },
}

function HealthBadge({ status, onRecheck }: { status: SourceHealthStatus; onRecheck: () => void }) {
  const b = BADGE[status]
  return (
    <div className="flex items-center gap-1" style={{ marginTop: 6 }}>
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: b.dot,
          animation: status === 'checking' ? 'pulse 1.2s ease-in-out infinite' : undefined,
          display: 'inline-block',
        }}
      />
      <span aria-live="polite" style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        color: b.text,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
      }}>
        {b.label}
      </span>
      {status !== 'checking' && (
        <button
          onClick={(e) => { e.stopPropagation(); onRecheck() }}
          aria-label={`Recheck ${b.label} source`}
          className="opacity-40 hover:opacity-100 transition-opacity ml-1 bg-transparent border-0 p-0 leading-none cursor-pointer"
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={b.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 4v6h-6"/>
            <path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      )}
    </div>
  )
}

function SourceCard({ source, index, tab, onSelect, onBookmark, bookmarked }: Props) {
  const url = getValidSourceUrl(source) || '#'
  const name = cleanSourceName(source.name)
  const domain = url !== '#' ? url.replace(/https?:\/\//, '').split('/')[0] : 'N/A'
  const [imgError, setImgError] = useState(false)
  const [health, setHealth] = useState<SourceHealthStatus | null>(
    tab === 'anime' ? 'checking' : null
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  const handleRecheck = () => {
    setHealth('checking')
    recheckSourceHealth(url, setHealth)
  }

  // Health checks fire only when the card scrolls into view — never for
  // off-screen cards (opening a tab with 1k sources would otherwise issue
  // hundreds of upstream fetches at once).
  useEffect(() => {
    if (tab !== 'anime' || startedRef.current) return
    const el = rootRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startedRef.current = true
          observer.disconnect()
          checkSourceHealth(url, setHealth)
        }
      },
      { rootMargin: '300px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [url, tab])

  const iconUrl = source.pkg
    ? `https://raw.githubusercontent.com/keiyoushi/extensions/repo/icon/${source.pkg}.png`
    : null

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
      className="group relative rounded overflow-hidden bg-[#0a1a1b] border border-[rgba(0,201,201,0.07)] hover:border-[rgba(0,201,201,0.3)] hover:bg-[#0d2022] transition-colors"
    >
      {/* Bookmark — top right */}
      {onBookmark && (
        <button
          onClick={(e) => { e.stopPropagation(); onBookmark(source) }}
          aria-label={bookmarked ? `Remove ${name} from bookmarks` : `Add ${name} to bookmarks`}
          aria-pressed={bookmarked}
          className="absolute top-2 right-2 z-10 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
          style={{
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: bookmarked ? 'rgba(0,201,201,0.2)' : 'rgba(0,0,0,0.5)',
            border: `1px solid ${bookmarked ? 'rgba(0,201,201,0.6)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 4,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill={bookmarked ? '#00c9c9' : 'none'} stroke={bookmarked ? '#00c9c9' : '#8a9a9a'} strokeWidth="2" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      )}

      <button
        className="w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9] outline-offset-[-2px]"
        onClick={() => onSelect(url, name)}
      >
        <div className="p-4">
          {/* Icon + name */}
          <div className="flex items-center gap-3 mb-3">
            {iconUrl && !imgError ? (
              <img
                src={iconUrl}
                alt=""
                width={36}
                height={36}
                onError={() => setImgError(true)}
                style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: 'rgba(0,201,201,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, color: '#00c9c9',
              }} aria-hidden="true">
                {name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block" style={{ color: 'rgba(232,245,245,0.9)' }}>
                {name}
              </span>
            </div>
          </div>

          {/* Domain */}
          <p className="truncate" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#a0c4c4', marginBottom: health ? 0 : 12 }}>
            {domain}
          </p>

          {/* Health badge — anime only */}
          {health && <HealthBadge status={health} onRecheck={handleRecheck} />}

          {/* Spacer when no badge */}
          {!health && <div style={{ marginBottom: 0 }} />}

          {/* Meta — lang left, 18+ right */}
          <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#a0c4c4', textTransform: 'uppercase', letterSpacing: 1 }}>
              {source.lang || 'N/A'}
            </span>
            {source.nsfw ? (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                padding: '2px 5px', background: 'rgba(255,140,66,0.15)',
                color: '#ff8c42', borderRadius: 3, border: '1px solid rgba(255,140,66,0.3)',
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                18+
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </motion.div>
  )
}

export default memo(SourceCard)
