export type Tab = 'manga' | 'anime' | 'alternative'

export interface Source {
  name: string
  lang: string
  nsfw: number
  pkg?: string
  version?: string
  sources?: Array<{ baseUrl: string }>
  baseUrl?: string
}

export interface BookmarkedSource {
  url: string
  name: string
  lang: string
  nsfw: number
  pkg?: string
  addedAt: string
}

export interface RecentSource {
  url: string
  name: string
  lang: string
  nsfw: number
  pkg?: string
  visitedAt: string
}

export interface UserSettings {
  showNSFW: boolean
  prefLang: string
  dnsProvider: string
  lastSelectedUrl: string
  lastSelectedName: string
  bookmarks: BookmarkedSource[]
  recents: RecentSource[]
  updatedAt?: string
}

export const DNS_OPTIONS = [
  { label: 'Direct', value: 'none' },
  { label: 'Google', value: 'https://dns.google/resolve' },
  { label: 'Cloudflare', value: 'https://cloudflare-dns.com/dns-query' },
  { label: 'Quad9', value: 'https://dns.quad9.net/dns-query' },
  { label: 'Mullvad', value: 'https://doh.mullvad.net/dns-query' },
  { label: 'AdGuard', value: 'https://dns.adguard-dns.com/dns-query' },
  { label: 'NextDNS', value: 'https://dns.nextdns.io' },
  { label: 'Control D', value: 'https://doh.controld.com/freedns' },
  { label: 'OpenDNS', value: 'https://doh.opendns.com/dns-query' },
  { label: 'AliDNS', value: 'https://dns.alidns.com/resolve' },
]

export const REPO_URLS: Record<Tab, string[]> = {
  manga: [
    'https://raw.githubusercontent.com/Kurozuka97/Anime-Repo/refs/heads/main/Manga.json',
  ],
  anime: [
    'https://raw.githubusercontent.com/Kurozuka97/Anime-Repo/refs/heads/main/Anime.json',
    'https://raw.githubusercontent.com/m2k3a/mangayomi-extensions/refs/heads/main/anime_index.json',
  ],
  alternative: [
    'https://raw.githubusercontent.com/Kurozuka97/Anime-Repo/refs/heads/main/Alternative.json',
  ],
}

export interface Channel {
  name: string
  url: string
  logo?: string
  group?: string
  country?: string
  language?: string
  source?: string
}
