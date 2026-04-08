# useIPTV

Fetches and merges multiple M3U playlists in parallel.

## Adding a Source

Open `hooks/useIPTV.ts` and add to the `SOURCES` array:

```typescript
{
  id: 'your-unique-id',
  label: 'Your Source Name',
  url: 'https://example.com/playlist.m3u',
}
```

URL must be a direct `.m3u` / `.m3u8` link with CORS enabled. GitHub raw links work out of the box.

## Default Sources

| Label | Notes |
|-------|-------|
| IPTV-Org (Global) | 8000+ channels worldwide |
| Free-TV (HD Only) | Quality controlled, HD only |
| Pluto TV | Free ad-supported, movies & entertainment |****
