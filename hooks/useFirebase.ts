'use client'
import { useEffect, useState, useCallback } from 'react'
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth'
import { doc, setDoc, onSnapshot, getDoc, runTransaction } from 'firebase/firestore'
import { auth, db, APP_ID } from '@/lib/firebase'
import { UserSettings, BookmarkedSource, RecentSource, Source } from '@/lib/types'
import { getValidSourceUrl, cleanSourceName } from '@/lib/source-utils'

const DEFAULT_SETTINGS: UserSettings = {
  showNSFW: false,
  prefLang: 'all',
  dnsProvider: 'none',
  bookmarks: [],
  recents: [],
}

const MAX_RECENTS = 10

// --- Password hashing -------------------------------------------------
// Per-account random salt + PBKDF2-SHA256. Legacy accounts (static-salt
// SHA-256) are upgraded in place on their next successful login.

const PBKDF2_ITERATIONS = 150_000
const LEGACY_STATIC_SALT = 'perryhub-salt'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

async function hashPassword(
  password: string,
  saltHex: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return bytesToHex(new Uint8Array(bits))
}

async function legacyHash(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + LEGACY_STATIC_SALT)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(digest))
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// --- Login attempt throttling -----------------------------------------

const MAX_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_TRACKED_IDS = 1000
const attemptLog = new Map<string, { count: number; windowStart: number }>()

function isLockedOut(id: string): boolean {
  const entry = attemptLog.get(id)
  if (!entry) return false
  if (Date.now() - entry.windowStart > ATTEMPT_WINDOW_MS) {
    attemptLog.delete(id)
    return false
  }
  return entry.count >= MAX_ATTEMPTS
}

function recordFailure(id: string): void {
  const now = Date.now()
  const entry = attemptLog.get(id)
  if (!entry || now - entry.windowStart > ATTEMPT_WINDOW_MS) {
    if (attemptLog.size >= MAX_TRACKED_IDS) {
      const oldest = attemptLog.keys().next().value
      if (oldest !== undefined) attemptLog.delete(oldest)
    }
    attemptLog.set(id, { count: 1, windowStart: now })
  } else {
    entry.count += 1
  }
}

function clearFailures(id: string): void {
  attemptLog.delete(id)
}

export type AuthMode = 'loading' | 'auth' | 'guest' | 'user'

interface AccountDoc {
  passwordHash?: string
  salt?: string
  algorithm?: string
  iterations?: number
  sessionToken?: string
  sessionExpiry?: string
  createdAt?: string
}

export function useFirebase() {
  const [user, setUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<'connecting' | 'online' | 'error'>('connecting')
  const [authMode, setAuthMode] = useState<AuthMode>('loading')
  const [perryId, setPerryId] = useState<string | null>(null)

  // Restore a previous session — the stored ID is only trusted when its
  // session token still matches the account document (and hasn't expired).
  useEffect(() => {
    const savedId = localStorage.getItem('perry-hub-id')
    const savedSession = localStorage.getItem('perry-hub-session')
    const savedMode = localStorage.getItem('perry-hub-mode')
    let cancelled = false

    async function restore() {
      if (savedId && savedSession) {
        try {
          const snap = await getDoc(doc(db, `artifacts/${APP_ID}/perryaccounts/${savedId}`))
          const data = snap.data() as AccountDoc | undefined
          const unexpired = data?.sessionExpiry
            ? new Date(data.sessionExpiry).getTime() > Date.now()
            : false
          const verified = snap.exists() && safeEqual(data?.sessionToken || '', savedSession) && unexpired

          if (verified) {
            if (!cancelled) {
              signInAnonymously(auth).catch(() => setStatus('error'))
              setPerryId(savedId)
              setAuthMode('user')
            }
            return
          }
        } catch {
          // Offline / transient failure — keep the session rather than
          // logging the user out on a flaky connection.
          if (!cancelled) {
            signInAnonymously(auth).catch(() => setStatus('error'))
            setPerryId(savedId)
            setAuthMode('user')
          }
          return
        }
      }

      localStorage.removeItem('perry-hub-id')
      localStorage.removeItem('perry-hub-session')
      if (cancelled) return

      if (savedMode === 'guest') {
        signInAnonymously(auth).catch(() => setStatus('error'))
        setAuthMode('guest')
      } else {
        setAuthMode('auth')
      }
    }

    restore()
    return () => {
      cancelled = true
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
      docPath = `artifacts/${APP_ID}/perryusers/${perryId}/settings/profile`
    } else if (authMode === 'guest') {
      docPath = `artifacts/${APP_ID}/users/${user.uid}/settings/profile`
    } else {
      return
    }

    const ref = doc(db, docPath)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<UserSettings>) })
        } else {
          setDoc(ref, DEFAULT_SETTINGS, { merge: true })
        }
      },
      () => setStatus('error'),
    )

    return () => unsub()
  }, [user, authMode, perryId])

  const getSettingsRef = useCallback(() => {
    if (!user) return null
    if (authMode === 'user' && perryId) {
      return doc(db, `artifacts/${APP_ID}/perryusers/${perryId}/settings/profile`)
    }
    return doc(db, `artifacts/${APP_ID}/users/${user.uid}/settings/profile`)
  }, [user, authMode, perryId])

  const saveSettings = useCallback(
    async (updates: Partial<UserSettings>) => {
      const ref = getSettingsRef()
      if (!ref) return
      await setDoc(ref, { ...updates, updatedAt: new Date().toISOString() }, { merge: true })
    },
    [getSettingsRef],
  )

  const persistSession = useCallback((id: string, sessionToken: string, sessionExpiry: string) => {
    localStorage.setItem('perry-hub-id', id)
    localStorage.setItem('perry-hub-session', sessionToken)
    setPerryId(id)
    setAuthMode('user')
    void sessionExpiry
  }, [])

  // Register — create a new Perry ID (transactional: no create races)
  const register = useCallback(async (id: string, password: string): Promise<boolean> => {
    if (isLockedOut(id)) return false
    try {
      const accountRef = doc(db, `artifacts/${APP_ID}/perryaccounts/${id}`)
      const salt = randomHex(16)
      const passwordHash = await hashPassword(password, salt)
      const sessionToken = randomHex(32)
      const now = new Date()
      const sessionExpiry = new Date(now.getTime() + SESSION_TTL_MS).toISOString()

      await signInAnonymously(auth)

      let taken = false
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(accountRef)
        if (snap.exists()) {
          taken = true
          return
        }
        tx.set(accountRef, {
          passwordHash,
          salt,
          algorithm: 'PBKDF2-SHA256',
          iterations: PBKDF2_ITERATIONS,
          sessionToken,
          sessionExpiry,
          createdAt: now.toISOString(),
        })
      })

      if (taken) {
        recordFailure(id)
        return false
      }

      clearFailures(id)
      persistSession(id, sessionToken, sessionExpiry)
      return true
    } catch (e) {
      console.error('Register error:', e)
      recordFailure(id)
      return false
    }
  }, [persistSession])

  // Login — verify ID + password, rotate the session token
  const login = useCallback(
    async (id: string, password: string): Promise<boolean> => {
      if (isLockedOut(id)) return false
      try {
        const accountRef = doc(db, `artifacts/${APP_ID}/perryaccounts/${id}`)
        const snap = await getDoc(accountRef)
        if (!snap.exists()) {
          recordFailure(id)
          return false
        }

        const data = snap.data() as AccountDoc
        let valid = false
        let upgraded: Partial<AccountDoc> | undefined

        if (data.algorithm === 'PBKDF2-SHA256' && data.salt) {
          const hashed = await hashPassword(password, data.salt, data.iterations)
          valid = !!data.passwordHash && safeEqual(hashed, data.passwordHash)
        } else if (data.passwordHash) {
          // Legacy static-salt SHA-256 verifier — upgrade it now that we
          // have the plaintext password.
          valid = safeEqual(await legacyHash(password), data.passwordHash)
          if (valid) {
            const salt = randomHex(16)
            upgraded = {
              salt,
              algorithm: 'PBKDF2-SHA256',
              iterations: PBKDF2_ITERATIONS,
              passwordHash: await hashPassword(password, salt),
            }
          }
        }

        if (!valid) {
          recordFailure(id)
          return false
        }

        await signInAnonymously(auth)

        const sessionToken = randomHex(32)
        const now = new Date()
        const sessionExpiry = new Date(now.getTime() + SESSION_TTL_MS).toISOString()
        await setDoc(
          accountRef,
          {
            ...upgraded,
            sessionToken,
            sessionExpiry,
            lastLoginAt: now.toISOString(),
          },
          { merge: true },
        )

        clearFailures(id)
        persistSession(id, sessionToken, sessionExpiry)
        return true
      } catch (e) {
        console.error('Login error:', e)
        recordFailure(id)
        return false
      }
    },
    [persistSession],
  )

  // Guest
  const continueAsGuest = useCallback(async () => {
    await signInAnonymously(auth)
    localStorage.setItem('perry-hub-mode', 'guest')
    setAuthMode('guest')
  }, [])

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem('perry-hub-id')
    localStorage.removeItem('perry-hub-session')
    localStorage.removeItem('perry-hub-mode')
    setPerryId(null)
    setAuthMode('auth')
    setSettings(DEFAULT_SETTINGS)
  }, [])

  // Toggle bookmark
  const toggleBookmark = useCallback(
    async (source: Source) => {
      const url = getValidSourceUrl(source) || '#'
      const name = cleanSourceName(source.name)
      const existing = settings.bookmarks || []
      const isBookmarked = existing.some((b) => b.url === url)

      const updated: BookmarkedSource[] = isBookmarked
        ? existing.filter((b) => b.url !== url)
        : [
            ...existing,
            {
              url,
              name,
              lang: source.lang,
              nsfw: source.nsfw,
              pkg: source.pkg,
              addedAt: new Date().toISOString(),
            },
          ]

      await saveSettings({ bookmarks: updated })
    },
    [settings.bookmarks, saveSettings],
  )

  const isBookmarked = useCallback(
    (url: string) => {
      return (settings.bookmarks || []).some((b) => b.url === url)
    },
    [settings.bookmarks],
  )

  // Add to recents
  const addRecent = useCallback(
    async (source: { url: string; name: string; lang: string; nsfw: number; pkg?: string }) => {
      const existing = settings.recents || []
      const filtered = existing.filter((r) => r.url !== source.url)
      const updated: RecentSource[] = [
        { ...source, visitedAt: new Date().toISOString() },
        ...filtered,
      ].slice(0, MAX_RECENTS)

      await saveSettings({ recents: updated })
    },
    [settings.recents, saveSettings],
  )

  return {
    user,
    settings,
    saveSettings,
    status,
    authMode,
    perryId,
    register,
    login,
    continueAsGuest,
    logout,
    toggleBookmark,
    isBookmarked,
    addRecent,
  }
}
