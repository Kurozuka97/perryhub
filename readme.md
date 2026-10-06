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

## Development

```bash
npm install
npm run dev        # local dev server
npm run verify     # typecheck + lint + tests + build (CI parity)
```

| Script | Purpose |
|--------|---------|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` (warnings are allowed; `<img>` warnings are intentional to avoid image-optimizer costs) |
| `npm test` | Node's built-in test runner (`tests/*.test.ts`) |
| `npm run build` | Production build |

CI runs the same checks on every push (`.github/workflows/ci.yml`).

---

## Proxy & Security

All embedded content is served through `GET /api/proxy` (`lib/server/proxy.ts`), which enforces:

- **SSRF protection** — private/loopback/link-local/reserved addresses are blocked in every notation (IPv4 abbreviations, hex/octal, IPv6, IPv4-mapped, 6to4), both before the request and after every redirect; optional DoH resolution (`dnsProvider`) must return public addresses; a `dnsLookup` hook re-verifies each hop.
- **Redirect budget** — manual redirect following with a hop cap and per-hop re-validation.
- **Response limits** — 8MB body cap and upstream request timeout.
- **Sandboxing** — proxied HTML is delivered with a `sandbox` CSP (no `allow-same-origin`), so upstream scripts can never read Perry Hub state. Non-HTML responses get a strict `sandbox` header.
- **Document allowlist** — HTML/XHTML/SVG/XML bodies are only served for hosts discovered in our source registries; playlists and JSON pass through so stream health checks keep working.
- **Rate limiting** — per-IP request budget on the proxy route.

Client-side, `lib/net.ts` reuses the same address validation for “Open in Tab” and source URL hygiene.

> `?check=1` requests a headers-only health probe (no body download) — used by source/channel status checks.

---

## Accounts (optional)

Perry Hub works as a guest. Creating a Perry Hub ID syncs bookmarks and settings via Firebase:

- Passwords are stored as **PBKDF2-SHA256** (150k iterations) with a per-account random salt; legacy static-salt hashes are upgraded on next login.
- Sessions use a random token that must match the account document and expire; login attempts are throttled.
- `firestore.rules` locks `perryaccounts/{id}` and user settings docs to their owners.

---

## Notes

- All repo/playlist fetches use `Promise.allSettled` — partial failures do not block the UI
- IPTV channels are deduplicated by stream URL across all sources
- Repo sources are merged per tab and deduplicated by `baseUrl`
- Source health checks only run for cards scrolled into view
- `scripts/audit-sources.mjs` (optional) crawls every source through the proxy and writes a JSON report; requires `npm i -D playwright && npx playwright install chromium`
