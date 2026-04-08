'use client'
import { useState, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import HomeScreen from '@/components/HomeScreen'
import VaultModal from '@/components/VaultModal'
import { useFirebase } from '@/hooks/useFirebase'
import { useRepos } from '@/hooks/useRepos'
import { Source } from '@/lib/types'

type SourceStatus = 'idle' | 'loading' | 'live' | 'error'

export default function Home() {
  const { user, settings, saveSettings, status, toggleBookmark, isBookmarked, addRecent } = useFirebase()
  const { repos, loading } = useRepos()

  const [vaultOpen, setVaultOpen] = useState(false)
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
    const matched = allSources.find(s => {
      const u = s.sources?.[0]?.baseUrl || s.baseUrl || ''
      return u === url
    })
    await addRecent({
      url,
      name,
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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar
        onOpenVault={() => setVaultOpen(true)}
        frameActive={!!frameUrl}
        onHome={handleHome}
        sourceName={sourceName}
        sourceStatus={sourceStatus}
        frameUrl={frameUrl}
      />

      <main className="flex-1 overflow-hidden relative">
        {frameUrl ? (
          <iframe
            src={`/api/proxy?url=${encodeURIComponent(frameUrl)}`}
            className="w-full h-full"
            sandbox="allow-scripts allow-forms allow-same-origin"
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
        repos={repos}
        loading={loading}
        settings={settings}
        onSave={saveSettings}
        onSelect={handleSelect}
        onBookmark={handleBookmark}
        isBookmarked={isBookmarked}
        uid={user?.uid || ''}
        status={status}
      />
    </div>
  )
}
