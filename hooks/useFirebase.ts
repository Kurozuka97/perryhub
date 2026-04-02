'use client'
import { useEffect, useState, useCallback } from 'react'
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth'
import { doc, setDoc, onSnapshot } from 'firebase/firestore'
import { auth, db, APP_ID } from '@/lib/firebase'
import { UserSettings, BookmarkedSource, RecentSource, Source } from '@/lib/types'

const DEFAULT_SETTINGS: UserSettings = {
  showNSFW: false,
  prefLang: 'all',
  dnsProvider: 'none',
  lastSelectedUrl: '',
  lastSelectedName: '',
  bookmarks: [],
  recents: [],
}

const MAX_RECENTS = 10

export function useFirebase() {
  const [user, setUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<'connecting' | 'online' | 'error'>('connecting')

  useEffect(() => {
    signInAnonymously(auth).catch(() => setStatus('error'))
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u)
        setStatus('online')
      } else {
        setStatus('error')
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'profile')
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() as UserSettings })
      } else {
        setDoc(ref, DEFAULT_SETTINGS, { merge: true })
      }
    }, () => setStatus('error'))
    return () => unsub()
  }, [user])

  const saveSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!user) return
    const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'profile')
    await setDoc(ref, { ...updates, updatedAt: new Date().toISOString() }, { merge: true })
  }, [user])

  // Toggle bookmark
  const toggleBookmark = useCallback(async (source: Source) => {
    const url = source.sources?.[0]?.baseUrl || source.baseUrl || '#'
    const name = source.name.replace(/Tachiyomi: |Aniyomi: /g, '')
    const existing = settings.bookmarks || []
    const isBookmarked = existing.some(b => b.url === url)

    const updated: BookmarkedSource[] = isBookmarked
      ? existing.filter(b => b.url !== url)
      : [...existing, {
          url,
          name,
          lang: source.lang,
          nsfw: source.nsfw,
          pkg: source.pkg,
          addedAt: new Date().toISOString(),
        }]

    await saveSettings({ bookmarks: updated })
  }, [settings.bookmarks, saveSettings])

  const isBookmarked = useCallback((url: string) => {
    return (settings.bookmarks || []).some(b => b.url === url)
  }, [settings.bookmarks])

  // Add to recents
  const addRecent = useCallback(async (source: { url: string; name: string; lang: string; nsfw: number; pkg?: string }) => {
    const existing = settings.recents || []
    const filtered = existing.filter(r => r.url !== source.url)
    const updated: RecentSource[] = [
      { ...source, visitedAt: new Date().toISOString() },
      ...filtered,
    ].slice(0, MAX_RECENTS)

    await saveSettings({ recents: updated })
  }, [settings.recents, saveSettings])

  return { user, settings, saveSettings, status, toggleBookmark, isBookmarked, addRecent }
}
