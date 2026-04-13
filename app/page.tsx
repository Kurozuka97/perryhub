'use client'
import { useState, useCallback, useRef } from 'react'
import Navbar from '@/components/Navbar'
import HomeScreen from '@/components/HomeScreen'
import VaultModal from '@/components/VaultModal'
import AuthScreen from '@/components/AuthScreen'
import SettingsPanel from '@/components/SettingsPanel'
import { useFirebase } from '@/hooks/useFirebase'
import { useRepos } from '@/hooks/useRepos'
import { Source } from '@/lib/types'
import { detectEmbeddedProxyIssue } from '@/lib/embed-detection'

type SourceStatus = 'idle' | 'loading' | 'live' | 'error'
type VaultTab = 'manga' | 'anime' | 'alternative' | 'iptv' | 'bookmarks'

// Error codes from the proxy that mean the site blocked server-side access.
// For these we silently fall back to a direct iframe load instead of showing an error.
const PROXY_FALLBACK_CODES = new Set([
  'UPSTREAM_BROWSER_VERIFICATION_REQUIRED',
  'UPSTREAM_ACCESS_DENIED',
  'UPSTREAM_RATE_LIMITED',
])

export default function Home() {
  const {
    user, settings, saveSettings, status,
    authMode, perryId,
    register, login, continueAsGuest, logout,
    toggleBookmark, isBookmarked, addRecent,
  } = useFirebase()
  const { repos, loading } = useRepos()

  const [vaultOpen, setVaultOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [vaultInitialTab, setVaultInitialTab] = useState<VaultTab>('manga')
  const [frameUrl, setFrameUrl] = useState('')
  const [rawUrl, setRawUrl] = useState('') // original URL before proxy wrapping
  const [isDirect, setIsDirect] = useState(false) // true = bypassing proxy
  const [sourceName, setSourceName] = useState('')
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>('idle')
  const [embedIssue, setEmbedIssue] = useState('')
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const handleSelect = useCallback(async (url: string, name: string) => {
    if (!url || url === '#') return
    setRawUrl(url)
    setIsDirect(false)
    setFrameUrl(url)
    setSourceName(name)
    setSourceStatus('loading')
    setEmbedIssue('')
    saveSettings({ lastSelectedUrl: url, lastSelectedName: name })

    // Add to recents (fire-and-forget — do not block UI)
    const allSources = [...repos.manga, ...repos.anime, ...repos.alternative]
    const matched = allSources.find(s => (s.sources?.[0]?.baseUrl || s.baseUrl || '') === url)
    addRecent({
      url, name,
      lang: matched?.lang || '',
      nsfw: matched?.nsfw || 0,
      pkg: matched?.pkg,
    }).catch(() => {})
  }, [saveSettings, addRecent, repos])

  const handleHome = useCallback(() => {
    setFrameUrl('')
    setRawUrl('')
    setIsDirect(false)
    setSourceName('')
    setSourceStatus('idle')
    setEmbedIssue('')
    saveSettings({ lastSelectedUrl: '', lastSelectedName: '' })
  }, [saveSettings])

  const handleBookmark = useCallback((source: Source) => {
    toggleBookmark(source)
  }, [toggleBookmark])

  const handleFrameLoad = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    try {
      const doc = iframe.contentDocument
      const title = doc?.title || ''
      const bodyText = doc?.body?.innerText || ''

      // Check if the proxy returned a block error page — if so, sniff the error
      // code out of the page and decide whether to fall back to direct load.
      if (!isDirect && title === 'Proxy unavailable') {
        const errorCode = bodyText.match(/·\s*([A-Z_]+)$/m)?.[1] || ''
        if (PROXY_FALLBACK_CODES.has(errorCode)) {
          // Silently retry as a direct iframe load
          setIsDirect(true)
          setFrameUrl(rawUrl)
          return
        }
        // Any other proxy error — show the overlay
        setEmbedIssue(bodyText.trim() || 'Proxy error. Use Open in Tab.')
        setSourceStatus('error')
        return
      }

      const issue = detectEmbeddedProxyIssue(title, bodyText)
      if (issue) {
        setEmbedIssue(issue)
        setSourceStatus('error')
        return
      }
    } catch {
      // Ignore DOM inspection failures (cross-origin) — iframe may still be valid
    }

    setEmbedIssue('')
    setSourceStatus('live')
  }, [isDirect, rawUrl])

  const handleOpenVaultTab = useCallback((tab: VaultTab) => {
    setVaultInitialTab(tab)
    setVaultOpen(true)
  }, [])

  const allLangs = Array.from(new Set([
    ...repos.manga.map(s => s.lang),
    ...repos.anime.map(s => s.lang),
    ...repos.alternative.map(s => s.lang),
  ].filter(Boolean))).sort() as string[]

  if (authMode === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#060d0e' }}>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: 4, color: '#1a3a3a' }}>
          PERRY HUB
        </div>
      </div>
    )
  }

  if (authMode === 'auth') {
    return (
      <AuthScreen
        onGuest={continueAsGuest}
        onLogin={login}
        onRegister={register}
      />
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar
        onOpenVault={() => setVaultOpen(true)}
        onOpenVaultTab={handleOpenVaultTab}
        frameActive={!!frameUrl}
        onHome={handleHome}
        sourceName={sourceName}
        sourceStatus={sourceStatus}
        frameUrl={frameUrl}
        authMode={authMode}
        perryId={perryId}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex-1 overflow-hidden relative">
        {frameUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={isDirect ? frameUrl : `/api/proxy?url=${encodeURIComponent(frameUrl)}`}
              onLoad={handleFrameLoad}
              className={`w-full h-full ${embedIssue ? 'pointer-events-none opacity-0' : ''}`}
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            {embedIssue ? (
              <div className="absolute inset-0 grid place-items-center p-6">
                <div
                  className="w-full max-w-xl rounded-xl p-6"
                  style={{
                    background: 'rgba(10, 26, 27, 0.96)',
                    border: '1px solid rgba(0,201,201,0.18)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
                  }}
                >
                  <h2
                    className="mb-3"
                    style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 30, letterSpacing: 2, color: '#e8f5f5' }}
                  >
                    Embedded View Unavailable
                  </h2>
                  <p className="mb-5" style={{ color: 'rgba(232,245,245,0.78)', lineHeight: 1.6 }}>
                    {embedIssue}
                  </p>
                  <button
                    onClick={() => window.open(rawUrl || frameUrl, '_blank', 'noopener,noreferrer')}
                    className="px-4 py-2 rounded transition-all"
                    style={{
                      background: 'rgba(0,201,201,0.12)',
                      border: '1px solid rgba(0,201,201,0.28)',
                      color: '#00c9c9',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    Open in Tab
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <HomeScreen
            onOpenVault={() => setVaultOpen(true)}
            mangaSources={repos.manga}
            onOpenVaultTab={handleOpenVaultTab}
            animeSources={repos.anime}
            altSources={repos.alternative}
            onSelect={handleSelect}
            recents={settings.recents || []}
          />
        )}
      </main>

      <VaultModal
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        initialTab={vaultInitialTab}
        repos={repos}
        loading={loading}
        settings={settings}
        onSave={saveSettings}
        onSelect={handleSelect}
        onBookmark={handleBookmark}
        isBookmarked={isBookmarked}
        uid={user?.uid || ''}
        status={status}
        perryId={perryId}
        authMode={authMode}
        onLogout={logout}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={saveSettings}
        langs={allLangs}
        uid={user?.uid || ''}
        status={status}
        perryId={perryId}
        authMode={authMode}
        onLogout={logout}
      />
    </div>
  )
}
