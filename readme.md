# Perry Hub — Guide

---

## IPTV

`hooks/useIPTV.ts` fetches and merges multiple M3U playlists in parallel. If one source fails, the rest continue loading. Duplicate channels are removed automatically by stream URL.

### Default Sources

| ID | Label | Notes |
|----|-------|-------|
| `iptv-org` | IPTV-Org (Global) | 8000+ channels worldwide |
| `free-tv` | Free-TV (HD Only) | Quality controlled, verified HD streams |
| `pluto-tv` | Pluto TV | Free ad-supported movies & entertainment |

### Adding a Source

Open `hooks/useIPTV.ts` and append to the `SOURCES` array:

```typescript
{
  id: 'your-unique-id',   // unique, no spaces
  label: 'Source Name',   // shown in UI
  url: 'https://example.com/playlist.m3u',
}
```

> URL must point directly to a `.m3u` or `.m3u8` file with CORS headers enabled.  
> GitHub raw links and GitHub Pages are supported out of the box.

---

## Repo Sources

`lib/types.ts` defines source URLs for each content tab under `REPO_URLS`. All URLs per tab are fetched in parallel and merged automatically. If a URL fails, the rest still load.

### Default Sources

| Tab | URL |
|-----|-----|
| `manga` | `Kurozuka97/Anime-Repo` → `Manga.json` |
| `anime` | `Kurozuka97/Anime-Repo` → `Anime.json` |
| `alternative` | `Kurozuka97/Anime-Repo` → `Alternative.json` |

### Adding a Source

Open `lib/types.ts` and append a URL to the relevant tab array:

```typescript
export const REPO_URLS: Record<Tab, string[]> = {
  manga: [
    'https://raw.githubusercontent.com/Kurozuka97/Anime-Repo/refs/heads/main/Manga.json',
    'https://example.com/manga-extra.json', // ← new source
  ],
  anime: [
    'https://raw.githubusercontent.com/Kurozuka97/Anime-Repo/refs/heads/main/Anime.json',
  ],
  alternative: [
    'https://raw.githubusercontent.com/Kurozuka97/Anime-Repo/refs/heads/main/Alternative.json',
  ],
}
```

> URL must return a valid JSON array of `Source` objects.

---

## Notes

- All fetches use `Promise.allSettled` — partial failures do not block the UI
- IPTV channels are deduplicated by stream URL across all sources
- Repo sources are merged per tab — duplicates are not currently filtered
