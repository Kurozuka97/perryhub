'use client'
import { useState } from 'react'
import { VaultTab, TAB_META } from '@/lib/types'
import { isPublicHttpUrl } from '@/lib/net'

interface Props {
  onOpenVault: () => void
  onOpenVaultTab: (tab: VaultTab) => void
  frameActive: boolean
  onHome: () => void
  sourceName: string
  sourceStatus: 'idle' | 'loading' | 'live' | 'error'
  frameUrl?: string
  rawUrl?: string
  authMode: 'loading' | 'auth' | 'guest' | 'user'
  perryId: string | null
  onOpenSettings: () => void
}

const NAV_TABS: { label: string; tab: VaultTab }[] = ['manga', 'anime', 'alternative', 'iptv'].map(
  (tab) => ({ label: TAB_META[tab as VaultTab].label, tab: tab as VaultTab }),
)

export default function Navbar({ onOpenVault, onOpenVaultTab, frameActive, onHome, sourceName, sourceStatus, frameUrl, rawUrl, authMode, perryId, onOpenSettings }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  const statusColor = {
    idle: '#1a3a3a',
    loading: '#ff8c42',
    live: '#00c9c9',
    error: '#ff4444',
  }[sourceStatus]

  const statusLabel = {
    idle: 'Standby',
    loading: 'Loading',
    live: 'Live',
    error: 'Error',
  }[sourceStatus]

  const openInTab = () => {
    const urlToOpen = rawUrl && rawUrl !== '#' ? rawUrl : frameUrl
    if (urlToOpen && isPublicHttpUrl(urlToOpen)) {
      window.open(urlToOpen, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <>
      <nav
        aria-label="Main"
        className="h-14 shrink-0 flex items-center justify-between px-4 md:px-8 z-50"
        style={{
          background: 'linear-gradient(to bottom, rgba(6,13,14,0.98), rgba(6,13,14,0.85))',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,201,201,0.06)',
        }}
      >
        {/* Left */}
        <div className="flex items-center gap-4 md:gap-8">
          <button
            onClick={onHome}
            aria-label="Go to home screen"
            className="hover:opacity-80 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
          >
            <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, letterSpacing: 3, color: '#00c9c9' }}>
              PERRY HUB
            </span>
          </button>

          {/* Desktop nav tabs */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_TABS.map(({ label, tab }) => (
              <button
                key={tab}
                onClick={() => onOpenVaultTab(tab)}
                className="text-sm transition-colors text-[rgba(232,245,245,0.45)] hover:text-[#e8f5f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9] bg-transparent border-0 p-0 cursor-pointer"
                style={{ fontWeight: 400 }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Source status — mobile show dot only */}
          {frameActive && (
            <div
              className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded"
              style={{ background: 'rgba(0,201,201,0.06)', border: '1px solid rgba(0,201,201,0.1)' }}
              role="status"
              aria-label={`Source status: ${statusLabel}`}
            >
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                aria-hidden="true"
                style={{ background: statusColor, boxShadow: sourceStatus === 'live' ? `0 0 6px ${statusColor}` : 'none' }}
              />
              <span className="hidden sm:block font-mono text-[10px] truncate max-w-[100px] uppercase" style={{ color: '#4a8888', letterSpacing: 1 }}>
                {sourceStatus === 'idle' ? 'Standby' : sourceName}
              </span>
            </div>
          )}

          {/* Open in tab — hide on mobile */}
          {frameActive && frameUrl && (
            <button
              onClick={openInTab}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded transition-colors bg-transparent border border-[rgba(0,201,201,0.25)] text-[#00c9c9] hover:bg-[rgba(0,201,201,0.08)] hover:border-[rgba(0,201,201,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9] cursor-pointer"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open in Tab
            </button>
          )}

          {/* Account — icon only on mobile */}
          <button
            onClick={onOpenSettings}
            aria-label={authMode === 'user' && perryId ? `Open settings for ${perryId}` : 'Open settings (guest)'}
            className="flex items-center gap-2 px-2 md:px-3 py-2 rounded transition-colors bg-transparent border border-[rgba(0,201,201,0.25)] text-[#00c9c9] hover:bg-[rgba(0,201,201,0.08)] hover:border-[rgba(0,201,201,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9] cursor-pointer"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: 1 }}
          >
            {authMode === 'user' && perryId ? (
              <>
                <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, background: 'rgba(0,201,201,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue, sans-serif', fontSize: 11, color: '#00c9c9' }}>
                  {perryId.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:block">{perryId}</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
                <span className="hidden sm:block">Guest</span>
              </>
            )}
          </button>

          {/* Vault button */}
          <button
            onClick={onOpenVault}
            aria-label="Open the Vault"
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded transition-colors bg-[rgba(0,201,201,0.1)] border border-[rgba(0,201,201,0.25)] text-[#00c9c9] hover:bg-[rgba(0,201,201,0.18)] hover:border-[rgba(0,201,201,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9] cursor-pointer"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="hidden sm:block">Vault</span>
          </button>

          {/* Mobile hamburger for nav tabs */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded border border-[rgba(0,201,201,0.15)] text-[#4a8888] hover:text-[#00c9c9] hover:border-[rgba(0,201,201,0.35)] transition-colors bg-transparent cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M18 6L6 18M6 6l12 12"/> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          className="md:hidden shrink-0 flex flex-col"
          style={{ background: 'rgba(6,13,14,0.98)', borderBottom: '1px solid rgba(0,201,201,0.06)', zIndex: 49 }}
        >
          {NAV_TABS.map(({ label, tab }) => (
            <button
              key={tab}
              onClick={() => { onOpenVaultTab(tab); setMenuOpen(false) }}
              className="px-6 py-3 text-left transition-colors text-[#4a8888] hover:text-[#00c9c9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9] bg-transparent border-0 cursor-pointer"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid rgba(0,201,201,0.04)' }}
            >
              {label}
            </button>
          ))}
          {frameActive && frameUrl && (
            <button
              onClick={() => { openInTab(); setMenuOpen(false) }}
              className="px-6 py-3 text-left transition-colors text-[#4a8888] hover:text-[#00c9c9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9] bg-transparent border-0 cursor-pointer"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}
            >
              Open in Tab ↗
            </button>
          )}
        </div>
      )}
    </>
  )
}
