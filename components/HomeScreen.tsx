'use client'
import { motion } from 'framer-motion'
import { RecentSource } from '@/lib/types'

interface Props {
  onOpenVault: () => void
  onOpenVaultTab: (tab: 'manga' | 'anime' | 'alternative' | 'iptv') => void
  mangaSources: { length: number }
  animeSources: { length: number }
  altSources: { length: number }
  onSelect: (url: string, name: string) => void
  recents?: RecentSource[]
}

const QUICK_TABS = [
  { tab: 'manga' as const, label: 'Manga', color: '#ff8c42' },
  { tab: 'anime' as const, label: 'Anime', color: '#00c9c9' },
  { tab: 'alternative' as const, label: 'Alternative', color: '#a78bfa' },
  { tab: 'iptv' as const, label: 'IPTV', color: '#00ff88' },
]

function RecentsRow({ recents, onSelect }: { recents: RecentSource[]; onSelect: (url: string, name: string) => void }) {
  if (!recents || recents.length === 0) return null

  return (
    <div className="px-4 md:px-8 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: 2, color: '#e8f5f5' }}>
          RECENTLY VISITED
        </h2>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00c9c9', opacity: 0.5 }} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
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
              className="shrink-0 flex items-center gap-2 px-3 py-2.5 rounded transition-all"
              style={{ background: '#0a1a1b', border: '1px solid rgba(0,201,201,0.07)', minWidth: 150 }}
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
                <img src={iconUrl} alt={r.name} width={24} height={24} style={{ width: 24, height: 24, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <div style={{ width: 24, height: 24, borderRadius: 5, flexShrink: 0, background: 'rgba(0,201,201,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue, sans-serif', fontSize: 13, color: '#00c9c9' }}>
                  {r.name.charAt(0)}
                </div>
              )}
              <div className="text-left min-w-0">
                <p style={{ color: 'rgba(232,245,245,0.85)', fontSize: 11, fontWeight: 500, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</p>
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

export default function HomeScreen({ onOpenVault, onOpenVaultTab, mangaSources, animeSources, altSources, onSelect, recents }: Props) {
  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#060d0e' }}>
      {/* Hero */}
      <div className="relative px-4 md:px-8 pt-8 md:pt-10 pb-8 md:pb-10 overflow-hidden">
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
          <div className="flex items-center gap-2 mb-3">
            <div style={{ width: 16, height: 2, background: '#00c9c9', borderRadius: 2 }} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, letterSpacing: 3, color: '#00c9c9', textTransform: 'uppercase' }}>
              Official Portal of Truck-Kun Survivors
            </span>
          </div>

          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(48px, 12vw, 72px)', letterSpacing: 4, lineHeight: 0.95, color: '#e8f5f5', marginBottom: 12 }}>
            PERRY{' '}
            <span style={{ WebkitTextStroke: '1.5px rgba(0,201,201,0.6)', color: 'transparent' }}>HUB</span>
          </h1>

          <p style={{ fontSize: 12, fontWeight: 300, color: 'rgba(232,245,245,0.35)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 20 }}>
            &quot;Welcome to the budget isekai. Your waifu is still 2D. Touch grass maybe.&quot;
          </p>

          <button
            onClick={onOpenVault}
            className="flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-sm transition-all"
            style={{ background: '#00c9c9', color: '#060d0e' }}
            onMouseEnter={e => e.currentTarget.style.background = '#00e0e0'}
            onMouseLeave={e => e.currentTarget.style.background = '#00c9c9'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Open Vault
          </button>
        </motion.div>
      </div>

      <div style={{ height: 1, background: 'rgba(0,201,201,0.06)', margin: '0 16px 20px' }} />

      {/* Recently Visited */}
      <RecentsRow recents={recents || []} onSelect={onSelect} />

      {/* Quick Access */}
      <div className="px-4 md:px-8 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: 2, color: '#e8f5f5' }}>
            QUICK ACCESS
          </h2>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {QUICK_TABS.map(({ tab, label, color }) => (
            <motion.button
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onOpenVaultTab(tab)}
              className="flex items-center gap-3 px-4 py-4 rounded transition-all"
              style={{ background: '#0a1a1b', border: '1px solid rgba(0,201,201,0.07)' }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(0,201,201,0.25)'
                e.currentTarget.style.background = '#0d2022'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(0,201,201,0.07)'
                e.currentTarget.style.background = '#0a1a1b'
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(232,245,245,0.6)', textTransform: 'uppercase', letterSpacing: 1, flex: 1, textAlign: 'left' }}>
                {label}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(0,201,201,0.3)' }}>→</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 md:px-8 py-6" style={{ borderTop: '1px solid rgba(0,201,201,0.05)' }}>
        <div className="flex justify-between items-center">
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#1a3a3a', textTransform: 'uppercase', letterSpacing: 1 }}>
            Perry Hub v2.0 · By Kuro
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#1a3a3a', textTransform: 'uppercase', letterSpacing: 1 }}>
            M:{mangaSources.length} · A:{animeSources.length} · Alt:{altSources.length}
          </p>
        </div>
      </div>
    </div>
  )
}
