'use client'
import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tab, Source, UserSettings, BookmarkedSource } from '@/lib/types'
import SourceCard from './SourceCard'
import IPTVTab from './IPTVTab'

interface Props {
  open: boolean
  onClose: () => void
  initialTab?: ActiveTab
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

type ActiveTab = Tab | 'bookmarks' | 'iptv'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'manga', label: 'Manga' },
  { id: 'anime', label: 'Anime' },
  { id: 'alternative', label: 'Alt' },
  { id: 'iptv', label: 'IPTV' },
  { id: 'bookmarks', label: 'Bookmarks' },
]

type SortOption = 'default' | 'name' | 'lang' | 'version'

interface SourceWithTab extends Source {
  _tab: Tab
}

const TAB_COLOURS: Record<Tab, string> = {
  manga: '#ff8c42',
  anime: '#00c9c9',
  alternative: '#a78bfa',
}

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

export default function VaultModal({ open, onClose, initialTab, repos, loading, settings, onSave, onSelect, onBookmark, isBookmarked, uid, status, perryId, authMode, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab ?? 'manga')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('default')

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

  const isSearching = search.trim().length > 0

  const langs = useMemo(() => {
    if (activeTab === 'bookmarks' || activeTab === 'iptv') return []
    const data = repos[activeTab as Tab] || []
    return Array.from(new Set(data.map(s => s.lang).filter(Boolean))).sort()
  }, [repos, activeTab])

  const crossTabResults = useMemo((): SourceWithTab[] => {
    if (!isSearching) return []
    const allTabs: Tab[] = ['manga', 'anime', 'alternative']
    return allTabs.flatMap(tab =>
      (repos[tab] || [])
        .filter(s => {
          const matchSearch = fuzzyMatch(s.name, search)
          const matchNSFW = settings.showNSFW || !s.nsfw
          return matchSearch && matchNSFW
        })
        .map(s => ({ ...s, _tab: tab }))
    )
  }, [repos, search, isSearching, settings.showNSFW])

  const filtered = useMemo(() => {
    if (isSearching || activeTab === 'iptv') return []
    let data: Source[] = activeTab === 'bookmarks'
      ? (settings.bookmarks || []).map(bookmarkToSource)
      : repos[activeTab as Tab] || []

    let result = data.filter(s => {
      const matchSearch = fuzzyMatch(s.name, search)
      const matchLang = activeTab === 'bookmarks' || settings.prefLang === 'all' || s.lang === settings.prefLang
      const matchNSFW = settings.showNSFW || !s.nsfw
      return matchSearch && matchLang && matchNSFW
    })

    if (sort === 'name') result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'lang') result = [...result].sort((a, b) => (a.lang || '').localeCompare(b.lang || ''))
    else if (sort === 'version') result = [...result].sort((a, b) => (b.version || '0').localeCompare(a.version || '0'))

    return result
  }, [repos, activeTab, search, sort, settings.prefLang, settings.showNSFW, settings.bookmarks, isSearching])

  const counts: Record<ActiveTab, number | undefined> = {
    manga: repos.manga.length,
    anime: repos.anime.length,
    alternative: repos.alternative.length,
    bookmarks: (settings.bookmarks || []).length,
    iptv: undefined,
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex flex-col"
          style={{ background: '#060d0e' }}
        >
          {/* Header */}
          <div className="shrink-0 px-4 md:px-8 pt-5 md:pt-8 pb-0">
            <div className="flex items-center justify-between mb-4 md:mb-8">
              <div>
                <p className="hidden md:block" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#6ababa', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8 }}>
                  Archive Access
                </p>
                <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(22px, 6vw, 32px)', letterSpacing: 3, color: '#e8f5f5' }}>
                  THE VAULT
                </h1>
              </div>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-3 py-2 rounded transition-colors"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#7ecece', border: '1px solid rgba(255,255,255,0.06)', background: 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.color = '#e8f5f5'}
                onMouseLeave={e => e.currentTarget.style.color = '#4a8888'}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Close
              </button>
            </div>

            {/* Tabs — scrollable on mobile */}
            {!isSearching && (
              <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid rgba(0,201,201,0.06)', scrollbarWidth: 'none' }}>
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative shrink-0 px-4 md:px-5 py-3 transition-colors"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: activeTab === tab.id ? '#00c9c9' : '#4a8888' }}
                  >
                    {tab.label}
                    {counts[tab.id] !== undefined && (
                      <span className="hidden md:inline" style={{ marginLeft: 6, fontSize: 8, opacity: 0.4 }}>{counts[tab.id]}</span>
                    )}
                    {activeTab === tab.id && (
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
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4a9090" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={isSearching ? 'Searching all sources...' : 'Search archives...'}
                    className="flex-1 bg-transparent outline-none uppercase"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#e8f5f5' }}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#6ababa' }}>
                      Clear
                    </button>
                  )}
                </div>

                {/* Filters row */}
                {!isSearching && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={sort}
                      onChange={e => setSort(e.target.value as SortOption)}
                      className="rounded outline-none cursor-pointer uppercase"
                      style={{ background: 'transparent', border: '1px solid rgba(0,201,201,0.1)', padding: '5px 8px', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#7ecece' }}
                    >
                      <option value="default">Default</option>
                      <option value="name">A–Z</option>
                      <option value="lang">Lang</option>
                      <option value="version">Version</option>
                    </select>

                    {activeTab !== 'bookmarks' && (
                      <select
                        value={settings.prefLang}
                        onChange={e => onSave({ prefLang: e.target.value })}
                        className="rounded outline-none cursor-pointer uppercase"
                        style={{ background: 'transparent', border: '1px solid rgba(0,201,201,0.1)', padding: '5px 8px', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#7ecece' }}
                      >
                        <option value="all">All</option>
                        {langs.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                      </select>
                    )}

                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#6ababa', flexShrink: 0, marginLeft: 'auto' }}>
                      {filtered.length} sources
                    </span>
                  </div>
                )}

                {isSearching && (
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#6ababa', flexShrink: 0 }}>
                    {crossTabResults.length} results
                  </span>
                )}
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6">
                {isSearching ? (
                  crossTabResults.length === 0 ? (
                    <div className="flex items-center justify-center h-48">
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6ababa', textTransform: 'uppercase', letterSpacing: 2 }}>
                        No results
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                      {crossTabResults.map((source, i) => {
                        const url = source.sources?.[0]?.baseUrl || source.baseUrl || '#'
                        return (
                          <div key={`${source.name}-${i}`} className="relative">
                            <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 7, textTransform: 'uppercase', letterSpacing: 1, color: '#060d0e', background: TAB_COLOURS[source._tab] }}>
                              {source._tab}
                            </div>
                            <SourceCard
                              source={source}
                              index={i}
                              onSelect={(url, name) => { onSelect(url, name); onClose() }}
                              onBookmark={onBookmark}
                              bookmarked={isBookmarked(url)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : loading && activeTab !== 'bookmarks' ? (
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="h-24 rounded animate-pulse" style={{ background: '#0a1a1b' }} />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6ababa', textTransform: 'uppercase', letterSpacing: 2 }}>
                      {activeTab === 'bookmarks' ? 'No bookmarks yet' : 'No results'}
                    </p>
                    {activeTab === 'bookmarks' && (
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a9090', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>
                        Click the bookmark icon on any source card
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                    {filtered.map((source, i) => {
                      const url = source.sources?.[0]?.baseUrl || source.baseUrl || '#'
                      return (
                        <SourceCard
                          key={`${source.name}-${i}`}
                          source={source}
                          index={i}
                          onSelect={(url, name) => { onSelect(url, name); onClose() }}
                          onBookmark={onBookmark}
                          bookmarked={isBookmarked(url)}
                        />
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 px-4 md:px-8 py-3 flex justify-between items-center" style={{ borderTop: '1px solid rgba(0,201,201,0.05)' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#6ababa', textTransform: 'uppercase', letterSpacing: 1 }}>
                  M:{counts.manga} · A:{counts.anime} · Alt:{counts.alternative} · ★:{counts.bookmarks}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#6ababa', opacity: 0.5 }}>
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
