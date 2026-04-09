'use client'
import { useState, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import HomeScreen from '@/components/HomeScreen'
import VaultModal from '@/components/VaultModal'
import AuthScreen from '@/components/AuthScreen'
import { useFirebase } from '@/hooks/useFirebase'
import { useRepos } from '@/hooks/useRepos'
import { Source } from '@/lib/types'

type SourceStatus = 'idle' | 'loading' | 'live' | 'error'
type VaultTab = 'manga' | 'anime' | 'alternative' | 'iptv' | 'bookmarks'

export default function Home() {
  const {
    user, settings, saveSettings, status,
    authMode, perryId,
    register, login, continueAsGuest, logout,
    toggleBookmark, isBookmarked, addRecent,
  } = useFirebase()
  const { repos, loading } = useRepos()

  const [vaultOpen, setVaultOpen] = useState(false)
  const [vaultInitialTab, setVaultInitialTab] = useState<VaultTab>('manga')
  const [frameUrl, setFrameUrl] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>('idle')

  const handleSelect = useCallback(async (url: string, name: string) => {
    if (!url || url === '#') return
    setFrameUrl(url)
    setSourceName(name)
    setSourceStatus('loading')
    saveSettings({ lastSelectedUrl: url, lastSelectedName: name })

    const allSources = [...repos.manga, ...repos.anime, ...repos.alternative]
    const matched = allSources.find(s => (s.sources?.[0]?.baseUrl || s.baseUrl || '') === url)
    await addRecent({
      url, name,
      lang: matched?.lang || '',
      nsfw: matched?.nsfw || 0,
      pkg: matched?.pkg,
    })

    try {
      await fetch(url, { mode: 'no-cors' })
      setSourceStatus('live')
    } catch {
      setSourceStatus('error')
    }
  }, [saveSettings, addRecent, repos])

  const handleHome = useCallback(() => {
    setFrameUrl('')
    setSourceName('')
    setSourceStatus('idle')
    saveSettings({ lastSelectedUrl: '', lastSelectedName: '' })
  }, [saveSettings])

  const handleBookmark = useCallback((source: Source) => {
    toggleBookmark(source)
  }, [toggleBookmark])

  const handleOpenVaultTab = useCallback((tab: VaultTab) => {
    setVaultInitialTab(tab)
    setVaultOpen(true)
  }, [])

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
        onOpenSettings={() => setVaultOpen(true)}
      />

      <main className="flex-1 overflow-hidden relative">
        {frameUrl ? (
          <iframe
            src={`/api/proxy?url=${encodeURIComponent(frameUrl)}`}
            className="w-full h-full"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <HomeScreen
            onOpenVault={() => setVaultOpen(true)}
            mangaSources={repos.manga}
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
    </div>
  )
}
