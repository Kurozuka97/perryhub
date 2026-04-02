'use client'
import { motion } from 'framer-motion'
import { Source, RecentSource } from '@/lib/types'

interface Props {
  onOpenVault: () => void
  mangaSources: Source[]
  animeSources: Source[]
  altSources: Source[]
  onSelect: (url: string, name: string) => void
  recents?: RecentSource[]
}

function SourceRow({ title, sources, onSelect }: { title: string; sources: Source[]; onSelect: (url: string, name: string) => void }) {
  const visible = sources.filter(s => !s.nsfw).slice(0, 10)

  return (
    <div className="px-8 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 20, letterSpacing: 2, color: '#e8f5f5' }}>
          {title}
        </h2>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
        {visible.map((source, i) => {
          const url = source.sources?.[0]?.baseUrl || source.baseUrl || '#'
          const name = source.name.replace(/Tachiyomi: |Aniyomi: /g, '')
          const iconUrl = source.pkg
            ? `https://raw.githubusercontent.com/keiyoushi/extensions/repo/icon/${source.pkg}.png`
            : null

          return (
            <motion.button
              key={`${source.name}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
              onClick={() => onSelect(url, name)}
              className="group text-left rounded overflow-hidden transition-all duration-200"
              style={{ background: '#0a1a1b', border: '1px solid rgba(0,201,201,0.07)' }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.04)'
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,201,201,0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div
                className="w-full flex items-center justify-center relative overflow-hidden"
                style={{ aspectRatio: '1', background: 'linear-gradient(135deg, #0a1a1c, #0d2426)' }}
              >
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(6,13,14,0.85) 0%, transparent 50%)' }} />
                {iconUrl ? (
                  <img
                    src={iconUrl}
                    alt={name}
                    width={48}
                    height={48}
                    style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', position: 'relative', zIndex: 1 }}
                    onError={(e) => {
                      const el = e.currentTarget
                      el.style.display = 'none'
                      const sibling = el.nextElementSibling as HTMLElement
                      if (sibling) sibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div
                  style={{
                    display: iconUrl ? 'none' : 'flex',
                    width: 48, height: 48, borderRadius: 10,
                    background: 'rgba(0,201,201,0.15)',
                    alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, color: '#00c9c9',
                    position: 'relative', zIndex: 1,
                  }}
                >
                  {name.charAt(0)}
                </div>
                {source.nsfw ? (
                  <div
                    className="absolute top-1.5 right-1.5"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
                      padding: '2px 5px', background: 'rgba(255,140,66,0.9)',
                      color: '#060d0e', borderRadius: 3, letterSpacing: 0.5,
                      textTransform: 'uppercase', fontWeight: 700, zIndex: 2,
                    }}
                  >
                    18+
                  </div>
                ) : null}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium truncate" style={{ color: 'rgba(232,245,245,0.85)' }}>{name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#1a4a4a', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {source.lang || 'N/A'}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#102828' }}>
                    v{source.version || '1.0'}
                  </span>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function RecentsRow({ recents, onSelect }: { recents: RecentSource[]; onSelect: (url: string, name: string) => void }) {
  if (!recents || recents.length === 0) return null

  return (
    <div className="px-8 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 20, letterSpacing: 2, color: '#e8f5f5' }}>
          RECENTLY VISITED
        </h2>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00c9c9', opacity: 0.5 }} />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {recents.map((r, i) => {
          const iconUrl = r.pkg
            ? `https://raw.githubusercontent.com/keiyoushi/extensions/repo/icon/${r.pkg}.png`
            : null

          return (
            <motion.button
              key={`${r.url}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              onClick={() => onSelect(r.url, r.name)}
              className="shrink-0 flex items-center gap-3 px-4 py-3 rounded transition-all"
              style={{
                background: '#0a1a1b',
                border: '1px solid rgba(0,201,201,0.07)',
                minWidth: 180,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(0,201,201,0.3)'
                e.currentTarget.style.background = '#0d2022'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(0,201,201,0.07)'
                e.currentTarget.style.background = '#0a1a1b'
              }}
            >
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={r.name}
                  width={28}
                  height={28}
                  style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: 'rgba(0,201,201,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Bebas Neue, sans-serif', fontSize: 14, color: '#00c9c9',
                }}>
                  {r.name.charAt(0)}
                </div>
              )}
              <div className="text-left min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'rgba(232,245,245,0.85)', maxWidth: 120 }}>{r.name}</p>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#1a4a4a', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {r.lang || 'N/A'}
                </p>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

export default function HomeScreen({ onOpenVault, mangaSources, animeSources, altSources, onSelect, recents }: Props) {
  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#060d0e' }}>
      {/* Hero */}
      <div className="relative px-8 pt-10 pb-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `
            linear-gradient(to right, rgba(6,13,14,0.97) 30%, rgba(6,13,14,0.2) 70%),
            linear-gradient(to top, rgba(6,13,14,1) 0%, transparent 40%),
            radial-gradient(ellipse 80% 100% at 65% 40%, rgba(0,180,180,0.28) 0%, rgba(0,80,100,0.15) 40%, transparent 70%)
          `
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(0,201,201,0.015) 40px, rgba(0,201,201,0.015) 41px)'
        }} />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 max-w-xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <div style={{ width: 20, height: 2, background: '#00c9c9', borderRadius: 2 }} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: 3, color: '#00c9c9', textTransform: 'uppercase' }}>
              Official Portal of Truck-Kun Survivors
            </span>
          </div>

          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 72, letterSpacing: 4, lineHeight: 0.95, color: '#e8f5f5', marginBottom: 12 }}>
            PERRY{' '}
            <span style={{ WebkitTextStroke: '1.5px rgba(0,201,201,0.6)', color: 'transparent' }}>HUB</span>
          </h1>

          <p style={{ fontSize: 13, fontWeight: 300, color: 'rgba(232,245,245,0.35)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 24 }}>
            &quot;Welcome to the budget isekai. Your waifu is still 2D. Touch grass maybe.&quot;
          </p>

          <button
            onClick={onOpenVault}
            className="flex items-center gap-2 px-6 py-3 rounded font-semibold text-sm transition-all"
            style={{ background: '#00c9c9', color: '#060d0e' }}
            onMouseEnter={e => e.currentTarget.style.background = '#00e0e0'}
            onMouseLeave={e => e.currentTarget.style.background = '#00c9c9'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Open Vault
          </button>
        </motion.div>
      </div>

      <div style={{ height: 1, background: 'rgba(0,201,201,0.06)', margin: '0 32px 24px' }} />

      {/* Recently Visited */}
      <RecentsRow recents={recents || []} onSelect={onSelect} />

      {/* Source Rows */}
      {mangaSources.length > 0 && (
        <SourceRow title="MANGA SECTION" sources={mangaSources} onSelect={onSelect} />
      )}
      {animeSources.length > 0 && (
        <SourceRow title="ANIME SECTION" sources={animeSources} onSelect={onSelect} />
      )}
      {altSources.length > 0 && (
        <SourceRow title="ALTERNATIVE" sources={altSources} onSelect={onSelect} />
      )}

      {/* Footer */}
      <div className="px-8 py-6" style={{ borderTop: '1px solid rgba(0,201,201,0.05)' }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#1a3a3a', textTransform: 'uppercase', letterSpacing: 1 }}>
          Perry Hub v2.0 · By Kuro
        </p>
      </div>
    </div>
  )
}
