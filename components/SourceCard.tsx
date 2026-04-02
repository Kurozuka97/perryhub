'use client'
import { Source } from '@/lib/types'
import { motion } from 'framer-motion'
import { useState } from 'react'

interface Props {
  source: Source
  index: number
  onSelect: (url: string, name: string) => void
  onBookmark?: (source: Source) => void
  bookmarked?: boolean
}

export default function SourceCard({ source, index, onSelect, onBookmark, bookmarked }: Props) {
  const url = source.sources?.[0]?.baseUrl || source.baseUrl || '#'
  const name = source.name.replace(/Tachiyomi: |Aniyomi: /g, '')
  const domain = url.replace(/https?:\/\//, '').split('/')[0]
  const [imgError, setImgError] = useState(false)

  const iconUrl = source.pkg
    ? `https://raw.githubusercontent.com/keiyoushi/extensions/repo/icon/${source.pkg}.png`
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
      className="group relative rounded overflow-hidden"
      style={{ background: '#0a1a1b', border: '1px solid rgba(0,201,201,0.07)' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(0,201,201,0.3)'
        e.currentTarget.style.background = '#0d2022'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(0,201,201,0.07)'
        e.currentTarget.style.background = '#0a1a1b'
      }}
    >
      {/* Bookmark — top right */}
      {onBookmark && (
        <button
          onClick={(e) => { e.stopPropagation(); onBookmark(source) }}
          className="absolute top-2 right-2 z-10 transition-all"
          style={{
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: bookmarked ? 'rgba(0,201,201,0.2)' : 'rgba(0,0,0,0.5)',
            border: `1px solid ${bookmarked ? 'rgba(0,201,201,0.6)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 4,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill={bookmarked ? '#00c9c9' : 'none'} stroke={bookmarked ? '#00c9c9' : '#8a9a9a'} strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      )}

      <button className="w-full text-left" onClick={() => onSelect(url, name)}>
        <div className="p-4">
          {/* Icon + name */}
          <div className="flex items-center gap-3 mb-3">
            {iconUrl && !imgError ? (
              <img
                src={iconUrl}
                alt={name}
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
              }}>
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
          <p className="truncate mb-3" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#a0c4c4' }}>
            {domain}
          </p>

          {/* Meta — lang left, 18+ right */}
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#a0c4c4', textTransform: 'uppercase', letterSpacing: 1 }}>
              {source.lang || 'N/A'}
            </span>
            {source.nsfw ? (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
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
