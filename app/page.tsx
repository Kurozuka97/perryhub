'use client'
import { useState, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { MotionConfig } from 'framer-motion'
import Navbar from '@/components/Navbar'
import HomeScreen from '@/components/HomeScreen'
import AuthScreen from '@/components/AuthScreen'
import { useFirebase } from '@/hooks/useFirebase'
import { useRepos } from '@/hooks/useRepos'
import { Source, VaultTab } from '@/lib/types'
import { DIRECT_FALLBACK_CODES } from '@/lib/proxy-codes'
import { getValidSourceUrl } from '@/lib/source-utils'
import { isPublicHttpUrl } from '@/lib/net'

// Heavy, always-mounted overlays are split out of the initial bundle.
const VaultModal = dynamic(() => import('@/components/VaultModal'))
const SettingsPanel = dynamic(() => import('@/components/SettingsPanel'))

const EMBED_UNSUPPORTED_CODE = 'UPSTREAM_EMBED_UNSUPPORTED'

type SourceStatus = 'idle' | 'loading' | 'live' | 'error'

function dnsQuery(dnsProvider: string): string {
  return dnsProvider && dnsProvider !== 'none'
    ? `&dns=${encodeURIComponent(dnsProvider)}`
    : ''
}

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
  // iframeSrc is the fully-resolved URL set only after proxy/direct decision is made
  const [iframeSrc, setIframeSrc] = useState('')
  const [frameUrl, setFrameUrl] = useState('')
  const [rawUrl, setRawUrl] = useState('')
  const [isDirect, setIsDirect] = useState(false)
  const [sourceName, setSourceName] = useState('')
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>('idle')
  const [embedIssue, setEmbedIssue] = useState('')
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const proxyCheckControllerRef = useRef<AbortController | null>(null)

  const handleSelect = useCallback(
    async (url: string, name: string) => {
      if (!isPublicHttpUrl(url)) return

      // Cancel any ongoing proxy check
      proxyCheckControllerRef.current?.abort()

      // Reset — keep iframe hidden on about:blank while we decide proxy vs direct
      setRawUrl(url)
      setFrameUrl(url)
      setIframeSrc('about:blank')
      setIsDirect(false)
      setSourceName(name)
      setSourceStatus('loading')
      setEmbedIssue('')

      // Add to recents (fire-and-forget)
      const allSources = [...repos.manga, ...repos.anime, ...repos.alternative]
      const matched = allSources.find((s) => getValidSourceUrl(s) === url)
      addRecent({
        url,
        name,
        lang: matched?.lang || '',
        nsfw: matched?.nsfw || 0,
        pkg: matched?.pkg,
      }).catch(() => {})

      // Decide proxy vs direct — fully resolve before touching the iframe
      let direct = false
      let embedMessage = ''

      const isHttps = url.startsWith('https:')

      if (isHttps) {
        // Silent proxy pre-check — only reads headers, never shows anything to the user
        const controller = new AbortController()
        proxyCheckControllerRef.current = controller
        try {
          let errorCode = ''
          let errorMessage = ''
          try {
            const res = await fetch(
              `/api/proxy?url=${encodeURIComponent(url)}${dnsQuery(settings.dnsProvider)}`,
              { signal: controller.signal },
            )
            errorCode = res.headers.get('x-proxy-error-code') || ''
            errorMessage = decodeURIComponent(res.headers.get('x-proxy-error-message') || '')
            controller.abort()
          } catch (err: unknown) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) throw err
          }

          if (errorCode === EMBED_UNSUPPORTED_CODE) {
            embedMessage = errorMessage
          } else if (DIRECT_FALLBACK_CODES.has(errorCode)) {
            direct = true
          }
        } catch {
          direct = true
        } finally {
          proxyCheckControllerRef.current = null
        }
      } else {
        // Non-https — always direct, skip pre-check entirely
        direct = true
      }

      // Set both together — iframe gets correct src on first render, no flash
      setIsDirect(direct)
      setIframeSrc(
        direct
          ? url
          : `/api/proxy?url=${encodeURIComponent(url)}${dnsQuery(settings.dnsProvider)}`,
      )
      if (embedMessage) {
        setEmbedIssue(embedMessage)
        setSourceStatus('error')
      }
    },
    [addRecent, repos, settings.dnsProvider],
  )

  const handleHome = useCallback(() => {
    setIframeSrc('')
    setFrameUrl('')
    setRawUrl('')
    setIsDirect(false)
    setSourceName('')
    setSourceStatus('idle')
    setEmbedIssue('')
  }, [])

  const handleBookmark = useCallback((source: Source) => {
    toggleBookmark(source)
  }, [toggleBookmark])

  const handleFrameLoad = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    // The about:blank placeholder fires load before the real source does,
    // and a server-detected embed failure must keep its error status.
    if (!iframeSrc || iframeSrc === 'about:blank' || embedIssue) return
    // Cross-origin (direct) and sandboxed (proxied) frames are intentionally
    // unreadable — embed failures are detected server-side instead.
    setSourceStatus('live')
  }, [iframeSrc, embedIssue])

  const handleOpenVaultTab = useCallback((tab: VaultTab) => {
    setVaultInitialTab(tab)
    setVaultOpen(true)
  }, [])

  const openVault = useCallback(() => setVaultOpen(true), [])
  const closeVault = useCallback(() => setVaultOpen(false), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const openExternal = useCallback((url: string) => {
    if (isPublicHttpUrl(url) && url !== 'about:blank') {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const allLangs = useMemo(
    () =>
      Array.from(
        new Set(
          [...repos.manga, ...repos.anime, ...repos.alternative]
            .map((s) => s.lang)
            .filter(Boolean),
        ),
      ).sort() as string[],
    [repos],
  )

  if (authMode === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#060d0e' }}>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: 4, color: '#4a9090' }}>
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
    <MotionConfig reducedMotion="user">
      <div className="h-screen flex flex-col overflow-hidden">
        <Navbar
          onOpenVault={openVault}
          onOpenVaultTab={handleOpenVaultTab}
          frameActive={!!frameUrl}
          onHome={handleHome}
          sourceName={sourceName}
          sourceStatus={sourceStatus}
          frameUrl={frameUrl}
          rawUrl={rawUrl}
          authMode={authMode}
          perryId={perryId}
          onOpenSettings={openSettings}
        />

        <main className="flex-1 overflow-hidden relative">
          {frameUrl ? (
            <>
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title={sourceName ? `${sourceName} — embedded source` : 'Embedded source'}
                onLoad={handleFrameLoad}
                className={`w-full h-full ${embedIssue || iframeSrc === 'about:blank' ? 'pointer-events-none opacity-0' : ''}`}
                // Proxied frames get an opaque origin (no allow-same-origin) so
                // third-party scripts can never touch app storage or APIs.
                // Direct frames keep same-origin so the target site's own
                // storage keeps working.
                sandbox={
                  isDirect
                    ? 'allow-scripts allow-same-origin allow-forms allow-popups'
                    : 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox'
                }
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              {embedIssue ? (
                <div className="absolute inset-0 grid place-items-center p-6">
                  <div
                    role="alert"
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
                      onClick={() => {
                        const urlToOpen = isPublicHttpUrl(rawUrl) ? rawUrl : frameUrl
                        openExternal(urlToOpen)
                      }}
                      className="px-4 py-2 rounded transition-colors hover:bg-[rgba(0,201,201,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
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
              onOpenVault={openVault}
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
          onClose={closeVault}
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
          onClose={closeSettings}
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
    </MotionConfig>
  )
}
