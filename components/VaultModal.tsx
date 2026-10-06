'use client'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Tab,
  Source,
  UserSettings,
  BookmarkedSource,
  VaultTab,
  VAULT_TABS,
  TAB_META,
} from '@/lib/types'
import SourceCard from './SourceCard'
import IPTVTab from './IPTVTab'
import { useDialog } from '@/hooks/useDialog'
import { getValidSourceUrl } from '@/lib/source-utils'

interface Props {
  open: boolean
  onClose: () => void
  initialTab?: VaultTab
  repos: Record<Tab, Source[]>
  loading: boolean
  settings: UserSettings
  onSave: (updates: Partial<UserSettings>) => void
  onSelect: (url: string, name: string) => void
  onBookmark: (source: Source) => void
  isBookmarked: (url: string) => boolean
  uid: string
  status: 'connecting' | 'online' | 'error'
  perryId: string | null
  authMode: 'loading' | 'auth' | 'guest' | 'user'
  onLogout: () => void
}

type SortOption = 'default' | 'name' | 'lang' | 'version'

interface SourceWithTab extends Source {
  _tab: Tab
}

const PAGE_SIZE = 150
const SEARCH_DEBOUNCE_MS = 150

const mono = 'JetBrains Mono, monospace'

function fuzzyMatch(str: string, query: string): boolean {
  if (!query) return true
  const s = str.toLowerCase()
  const q = query.toLowerCase()
  let si = 0
  for (let qi = 0; qi < q.length; qi++) {
    const idx = s.indexOf(q[qi], si)
    if (idx === -1) return false
    si = idx + 1
  }
  return true
}

function bookmarkToSource(b: BookmarkedSource): Source {
  return { name: b.name, lang: b.lang, nsfw: b.nsfw, pkg: b.pkg, baseUrl: b.url }
}

export default function VaultModal({
  open,
  onClose,
  initialTab,
  repos,
  loading,
  settings,
  onSave,
  onSelect,
  onBookmark,
  isBookmarked,
  uid,
  status,
  perryId,
  authMode,
  onLogout,
}: Props) {
  const [activeTab, setActiveTab] = useState<VaultTab>(initialTab ?? 'manga')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('default')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const dialogRef = useRef<HTMLDivElement>(null)

  useDialog(open, onClose, dialogRef)

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

  // Debounced search keeps typing responsive over 1k+ sources.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const prefLang = settings.prefLang
  const showNSFW = settings.showNSFW
  const bookmarks = useMemo(() => settings.bookmarks || [], [settings.bookmarks])

  // Reset pagination whenever the result set changes shape.
  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [activeTab, search, sort, prefLang, showNSFW])

  const isSearching = search.length > 0

  const langs = useMemo(() => {
    if (activeTab === 'bookmarks' || activeTab === 'iptv') return []
    const data = repos[activeTab as Tab] || []
    return Array.from(new Set(data.map((s) => s.lang).filter(Boolean))).sort()
  }, [repos, activeTab])

  const crossTabResults = useMemo((): SourceWithTab[] => {
    if (!isSearching) return []
    const allTabs: Tab[] = ['manga', 'anime', 'alternative']
    return allTabs.flatMap((tab) =>
      (repos[tab] || [])
        .filter((s) => {
          const matchSearch = fuzzyMatch(s.name, search)
          const matchNSFW = showNSFW || !s.nsfw
          return matchSearch && matchNSFW
        })
        .map((s) => ({ ...s, _tab: tab })),
    )
  }, [repos, search, isSearching, showNSFW])

  const filtered = useMemo(() => {
    if (isSearching || activeTab === 'iptv') return []

    const data: Source[] = activeTab === 'bookmarks'
      ? bookmarks.map(bookmarkToSource)
      : repos[activeTab as Tab] || []

    let result = data.filter((s) => {
      const matchSearch = fuzzyMatch(s.name, search)
      const matchLang = activeTab === 'bookmarks' || prefLang === 'all' || s.lang === prefLang
      const matchNSFW = showNSFW || !s.nsfw
      return matchSearch && matchLang && matchNSFW
    })

    if (sort === 'name') result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'lang')
      result = [...result].sort((a, b) => (a.lang || '').localeCompare(b.lang || ''))
    else if (sort === 'version')
      result = [...result].sort((a, b) => (b.version || '0').localeCompare(a.version || '0'))

    return result
  }, [repos, activeTab, search, sort, bookmarks, isSearching, prefLang, showNSFW])

  const counts: Record<VaultTab, number | undefined> = {
    manga: repos.manga.length,
    anime: repos.anime.length,
    alternative: repos.alternative.length,
    bookmarks: bookmarks.length,
    iptv: undefined,
  }

  const handleSelect = useCallback(
    (url: string, name: string) => {
      onSelect(url, name)
      onClose()
    },
    [onSelect, onClose],
  )

  const shown = filtered.slice(0, limit)
  const shownCrossTab = crossTabResults.slice(0, limit)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="The Vault — source browser"
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex flex-col outline-none"
          style={{ background: '#060d0e' }}
        >
          {/* Header */}
          <div className="shrink-0 px-4 md:px-8 pt-5 md:pt-8 pb-0">
            <div className="flex items-center justify-between mb-4 md:mb-8">
              <div>
                <p className="hidden md:block" style={{ fontFamily: mono, fontSize: 10, color: '#6ababa', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8 }}>
                  Archive Access
                </p>
                <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(22px, 6vw, 32px)', letterSpacing: 3, color: '#e8f5f5' }}>
                  THE VAULT
                </h1>
              </div>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-3 py-2 rounded transition-colors hover:text-[#e8f5f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
                style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#7ecece', border: '1px solid rgba(255,255,255,0.06)', background: 'transparent' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Close
              </button>
            </div>

            {/* Tabs — scrollable on mobile */}
            {!isSearching && (
              <div
                role="tablist"
                aria-label="Vault sections"
                className="flex overflow-x-auto"
                style={{ borderBottom: '1px solid rgba(0,201,201,0.06)', scrollbarWidth: 'none' }}
              >
                {VAULT_TABS.map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={activeTab === tab}
                    id={`vault-tab-${tab}`}
                    onClick={() => setActiveTab(tab)}
                    className="relative shrink-0 px-4 md:px-5 py-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
                    style={{ fontFamily: mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: activeTab === tab ? '#00c9c9' : '#5a9999' }}
                  >
                    {TAB_META[tab].label}
                    {counts[tab] !== undefined && (
                      <span className="hidden md:inline" style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>{counts[tab]}</span>
                    )}
                    {activeTab === tab && (
                      <motion.div layoutId="vault-tab-line" className="absolute bottom-0 left-0 right-0" style={{ height: 2, background: '#00c9c9' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeTab === 'iptv' && !isSearching ? (
            <IPTVTab />
          ) : (
            <>
              {/* Search + Sort — stacked on mobile */}
              <div className="shrink-0 px-4 md:px-8 py-3 md:py-4 flex flex-col md:flex-row gap-2 md:gap-3" style={{ borderBottom: '1px solid rgba(0,201,201,0.05)' }}>
                {/* Search bar */}
                <div className="flex-1 flex items-center gap-3 pb-2" style={{ borderBottom: '1px solid rgba(0,201,201,0.1)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4a9090" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    aria-label="Search archives"
                    placeholder={isSearching ? 'Searching all sources...' : 'Search archives...'}
                    className="flex-1 bg-transparent outline-none uppercase"
                    style={{ fontFamily: mono, fontSize: 11, color: '#e8f5f5' }}
                  />
                  {searchInput && (
                    <button
                      onClick={() => setSearchInput('')}
                      className="hover:text-[#e8f5f5] transition-colors"
                      style={{ fontFamily: mono, fontSize: 10, color: '#6ababa' }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Filters row */}
                {!isSearching && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortOption)}
                      aria-label="Sort sources"
                      className="rounded outline-none cursor-pointer uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
                      style={{ background: 'transparent', border: '1px solid rgba(0,201,201,0.1)', padding: '5px 8px', fontSize: 11, fontFamily: mono, color: '#7ecece' }}
                    >
                      <option value="default">Default</option>
                      <option value="name">A–Z</option>
                      <option value="lang">Lang</option>
                      <option value="version">Version</option>
                    </select>

                    {activeTab !== 'bookmarks' && (
                      <select
                        value={prefLang}
                        onChange={(e) => onSave({ prefLang: e.target.value })}
                        aria-label="Filter by language"
                        className="rounded outline-none cursor-pointer uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
                        style={{ background: 'transparent', border: '1px solid rgba(0,201,201,0.1)', padding: '5px 8px', fontSize: 11, fontFamily: mono, color: '#7ecece' }}
                      >
                        <option value="all">All</option>
                        {langs.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                      </select>
                    )}

                    <span aria-live="polite" style={{ fontFamily: mono, fontSize: 10, color: '#6ababa', flexShrink: 0, marginLeft: 'auto' }}>
                      {filtered.length} sources
                    </span>
                  </div>
                )}

                {isSearching && (
                  <span aria-live="polite" style={{ fontFamily: mono, fontSize: 10, color: '#6ababa', flexShrink: 0 }}>
                    {crossTabResults.length} results
                  </span>
                )}
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6">
                {isSearching ? (
                  shownCrossTab.length === 0 ? (
                    <div className="flex items-center justify-center h-48">
                      <p style={{ fontFamily: mono, fontSize: 11, color: '#6ababa', textTransform: 'uppercase', letterSpacing: 2 }}>
                        No results
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                        {shownCrossTab.map((source, i) => {
                          const url = getValidSourceUrl(source) || '#'
                          return (
                            <div key={`${source._tab}:${url}`} className="relative">
                              <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded" style={{ fontFamily: mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: '#060d0e', background: TAB_META[source._tab].color }}>
                                {TAB_META[source._tab].shortLabel}
                              </div>
                              <SourceCard
                                source={source}
                                index={i}
                                tab={source._tab}
                                onSelect={handleSelect}
                                onBookmark={onBookmark}
                                bookmarked={isBookmarked(url)}
                              />
                            </div>
                          )
                        })}
                      </div>
                      {crossTabResults.length > limit && (
                        <LoadMoreButton remaining={crossTabResults.length - limit} onClick={() => setLimit((l) => l + PAGE_SIZE)} />
                      )}
                    </>
                  )
                ) : loading && activeTab !== 'bookmarks' ? (
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="h-24 rounded animate-pulse" style={{ background: '#0a1a1b' }} />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <p style={{ fontFamily: mono, fontSize: 11, color: '#6ababa', textTransform: 'uppercase', letterSpacing: 2 }}>
                      {activeTab === 'bookmarks' ? 'No bookmarks yet' : 'No results'}
                    </p>
                    {activeTab === 'bookmarks' && (
                      <p style={{ fontFamily: mono, fontSize: 10, color: '#4a9090', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>
                        Click the bookmark icon on any source card
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                      {shown.map((source, i) => {
                        const url = getValidSourceUrl(source) || '#'
                        return (
                          <SourceCard
                            key={url}
                            source={source}
                            index={i}
                            tab={activeTab}
                            onSelect={handleSelect}
                            onBookmark={onBookmark}
                            bookmarked={isBookmarked(url)}
                          />
                        )
                      })}
                    </div>
                    {filtered.length > limit && (
                      <LoadMoreButton remaining={filtered.length - limit} onClick={() => setLimit((l) => l + PAGE_SIZE)} />
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 px-4 md:px-8 py-3 flex justify-between items-center" style={{ borderTop: '1px solid rgba(0,201,201,0.05)' }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: '#6ababa', textTransform: 'uppercase', letterSpacing: 1 }}>
                  M:{counts.manga} · A:{counts.anime} · Alt:{counts.alternative} · ★:{counts.bookmarks}
                </span>
                <span style={{ fontFamily: mono, fontSize: 10, color: '#5a9999' }}>
                  {uid ? `${uid.substring(0, 8)}…` : '—'}
                </span>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function LoadMoreButton({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 mt-6 rounded transition-colors hover:text-[#00c9c9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
      style={{ fontFamily: mono, fontSize: 10, color: '#5a9999', border: '1px solid rgba(0,201,201,0.1)', letterSpacing: 1, textTransform: 'uppercase' }}
    >
      Load More — {remaining} remaining
    </button>
  )
}
