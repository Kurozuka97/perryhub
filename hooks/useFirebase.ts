'use client'
import { useEffect, useState, useCallback } from 'react'
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth'
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore'
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

// Simple hash — bukan cryptographic, cukup untuk project ni
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'perryhub-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export type AuthMode = 'loading' | 'auth' | 'guest' | 'user'

export function useFirebase() {
  const [user, setUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<'connecting' | 'online' | 'error'>('connecting')
  const [authMode, setAuthMode] = useState<AuthMode>('loading')
  const [perryId, setPerryId] = useState<string | null>(null)

  // Check localStorage kalau dah login before
  useEffect(() => {
    const savedId = localStorage.getItem('perry-hub-id')
    const savedMode = localStorage.getItem('perry-hub-mode')
    if (savedId) {
      // Auto login as user
      signInAnonymously(auth).catch(() => setStatus('error'))
      setPerryId(savedId)
      setAuthMode('user')
    } else if (savedMode === 'guest') {
      // Auto restore guest session
      signInAnonymously(auth).catch(() => setStatus('error'))
      setAuthMode('guest')
    } else {
      setAuthMode('auth')
    }
  }, [])

  useEffect(() => {
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

  // Load settings based on authMode
  useEffect(() => {
    if (!user) return

    let docPath: string

    if (authMode === 'user' && perryId) {
      // Settings ikut Perry ID
      docPath = `artifacts/${APP_ID}/perryusers/${perryId}/settings/profile`
    } else if (authMode === 'guest') {
      // Settings ikut anonymous UID
      docPath = `artifacts/${APP_ID}/users/${user.uid}/settings/profile`
    } else {
      return
    }

    const ref = doc(db, docPath)
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() as UserSettings })
      } else {
        setDoc(ref, DEFAULT_SETTINGS, { merge: true })
      }
    }, () => setStatus('error'))

    return () => unsub()
  }, [user, authMode, perryId])

  const getSettingsRef = useCallback(() => {
    if (!user) return null
    if (authMode === 'user' && perryId) {
      return doc(db, `artifacts/${APP_ID}/perryusers/${perryId}/settings/profile`)
    }
    return doc(db, `artifacts/${APP_ID}/users/${user.uid}/settings/profile`)
  }, [user, authMode, perryId])

  const saveSettings = useCallback(async (updates: Partial<UserSettings>) => {
    const ref = getSettingsRef()
    if (!ref) return
    await setDoc(ref, { ...updates, updatedAt: new Date().toISOString() }, { merge: true })
  }, [getSettingsRef])

  // Register — create new Perry ID
  const register = useCallback(async (id: string, password: string): Promise<boolean> => {
    try {
      const accountRef = doc(db, `artifacts/${APP_ID}/perryaccounts/${id}`)
      const existing = await getDoc(accountRef)
      if (existing.exists()) return false // ID taken

      const hashed = await hashPassword(password)
      await setDoc(accountRef, { passwordHash: hashed, createdAt: new Date().toISOString() })

      // Sign in anonymously to get Firebase user
      await signInAnonymously(auth)

      localStorage.setItem('perry-hub-id', id)
      setPerryId(id)
      setAuthMode('user')
      return true
    } catch {
      return false
    }
  }, [])

  // Login — verify ID + password
  const login = useCallback(async (id: string, password: string): Promise<boolean> => {
    try {
      const accountRef = doc(db, `artifacts/${APP_ID}/perryaccounts/${id}`)
      const snap = await getDoc(accountRef)
      if (!snap.exists()) return false

      const hashed = await hashPassword(password)
      if (snap.data().passwordHash !== hashed) return false

      await signInAnonymously(auth)

      localStorage.setItem('perry-hub-id', id)
      setPerryId(id)
      setAuthMode('user')
      return true
    } catch {
      return false
    }
  }, [])

  // Guest
  const continueAsGuest = useCallback(async () => {
    await signInAnonymously(auth)
    localStorage.setItem('perry-hub-mode', 'guest')
    setAuthMode('guest')
  }, [])

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('perry-hub-id')
    localStorage.removeItem('perry-hub-mode')
    setPerryId(null)
    setAuthMode('auth')
    setSettings(DEFAULT_SETTINGS)
  }, [])

  // Toggle bookmark
  const toggleBookmark = useCallback(async (source: Source) => {
    const url = source.sources?.[0]?.baseUrl || source.baseUrl || '#'
    const name = source.name.replace(/Tachiyomi: |Aniyomi: /g, '')
    const existing = settings.bookmarks || []
    const isBookmarked = existing.some(b => b.url === url)

    const updated: BookmarkedSource[] = isBookmarked
      ? existing.filter(b => b.url !== url)
      : [...existing, {
          url, name,
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

  return {
    user, settings, saveSettings, status,
    authMode, perryId,
    register, login, continueAsGuest, logout,
    toggleBookmark, isBookmarked, addRecent,
  }
}
