#!/usr/bin/env node
import { chromium } from 'playwright'

const REPO_URLS = {
  manga: [
    'https://raw.githubusercontent.com/Kurozuka97/Anime-Repo/refs/heads/main/Manga.json',
    'https://raw.githubusercontent.com/m2k3a/mangayomi-extensions/refs/heads/main/index.json',
  ],
  anime: [
    'https://raw.githubusercontent.com/Kurozuka97/Anime-Repo/refs/heads/main/Anime.json',
    'https://raw.githubusercontent.com/m2k3a/mangayomi-extensions/refs/heads/main/anime_index.json',
  ],
  alternative: [
    'https://raw.githubusercontent.com/Kurozuka97/Anime-Repo/refs/heads/main/Alternative.json',
    'https://raw.githubusercontent.com/m2k3a/mangayomi-extensions/refs/heads/main/novel_index.json',
  ],
}

const MARKERS = [
  ['cloudflare', /cloudflare|cf-ray|just a moment|checking your browser/i],
  ['captcha', /captcha|are you human|verify you are human/i],
  ['login', /login|sign in|log in/i],
  ['ddos_guard', /ddos-guard/i],
]

const EMBED_ROUTE_MISMATCH_LEADING_PATTERNS = [/^404(?:\s|$)/i]

const EMBED_ROUTE_MISMATCH_BODY_PATTERNS = [
  /page not found\.?(?:\s+the page you are trying to get doesn't exist\.?)?/i,
  /the page you are trying to get doesn't exist\.?/i,
  /internal server error\.?/i,
]

function parseArgs(argv) {
  const parsed = {
    baseUrl: 'http://127.0.0.1:3001',
    tab: 'all',
    concurrency: 6,
    timeoutMs: 20_000,
    output: '/tmp/perryhub-source-audit.json',
  }

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base-url' && argv[i + 1]) {
      parsed.baseUrl = argv[++i]
    } else if (argv[i] === '--tab' && argv[i + 1]) {
      parsed.tab = argv[++i]
    } else if (argv[i] === '--concurrency' && argv[i + 1]) {
      parsed.concurrency = parseInt(argv[++i], 10)
    } else if (argv[i] === '--timeout' && argv[i + 1]) {
      parsed.timeoutMs = parseInt(argv[++i], 10)
    } else if (argv[i] === '--output' && argv[i + 1]) {
      parsed.output = argv[++i]
    }
  }

  return parsed
}

function summarize(results) {
  return {
    total: results.length,
    ok: results.filter((r) => r.status === 200 && !r.marker && !r.embedIssue).length,
    markers: Object.entries(
      results.reduce((acc, r) => {
        if (r.marker) {
          acc[r.marker] = (acc[r.marker] || 0) + 1
        }
        return acc
      }, {}),
    ).map(([name, count]) => ({ name, count })),
    errors: results
      .filter((r) => r.status !== 200 && typeof r.status === 'number')
      .reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1
        return acc
      }, {}),
    sampleFailures: results
      .filter(
        (row) =>
          (typeof row.status === 'number' && row.status !== 200) ||
          row.marker ||
          row.status === 'FETCH_FAILED',
      )
      .slice(0, 20),
    sampleEmbedUnsupported: results
      .filter((row) => row.proxyErrorCode === 'UPSTREAM_EMBED_UNSUPPORTED')
      .slice(0, 20),
  }
}

async function loadSources(tab) {
  const tabs = tab === 'all' ? Object.keys(REPO_URLS) : [tab]
  const sources = []

  for (const t of tabs) {
    const urls = REPO_URLS[t] || []
    for (const url of urls) {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      for (const item of data) {
        const baseUrl =
          item.sources?.[0]?.baseUrl || item.baseUrl
        if (baseUrl) {
          sources.push({ url: baseUrl, name: item.name, tab: t })
        }
      }
    }
  }

  return sources
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const browser = await chromium.launch({ headless: true })
  const sources = await loadSources(options.tab)
  const results = []
  let index = 0

  async function worker() {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(options.baseUrl, { waitUntil: 'domcontentloaded' })

    while (index < sources.length) {
      const current = sources[index++]
      try {
        const response = await page.goto(
          `${options.baseUrl}/api/proxy?url=${encodeURIComponent(current.url)}`,
          {
            waitUntil: 'domcontentloaded',
            timeout: options.timeoutMs,
          },
        )

        if (response?.status() === 200) {
          try {
            await page.waitForLoadState('networkidle', {
              timeout: Math.min(options.timeoutMs, 5_000),
            })
          } catch {
            // Many sources keep long-lived requests open. The DOM snapshot below is still useful.
          }
        }

        const row = await page.evaluate(
          ({ source, markers, leadingEmbedPatterns, bodyEmbedPatterns }) => {
            const bodyText = document.body?.innerText?.replace(/\s+/g, ' ').trim() || ''
            const title = document.title.replace(/\s+/g, ' ').trim()
            const leadingText = bodyText.slice(0, 160)
            const bodySample = bodyText.slice(0, 600)

            const marker =
              markers.find(([, pattern]) => new RegExp(pattern, 'i').test(bodyText))?.[0] || null

            const embedIssue =
              leadingEmbedPatterns.some((pattern) => new RegExp(pattern, 'i').test(leadingText)) ||
              bodyEmbedPatterns.some((pattern) => new RegExp(pattern, 'i').test(bodySample))

            return {
              ...source,
              finalBrowserUrl: window.location.href,
              title,
              bodySample: bodyText.slice(0, 600),
              marker,
              embedIssue,
            }
          },
          {
            source: current,
            markers: MARKERS.map(([name, pattern]) => [name, pattern.source]),
            leadingEmbedPatterns: EMBED_ROUTE_MISMATCH_LEADING_PATTERNS.map(
              (pattern) => pattern.source,
            ),
            bodyEmbedPatterns: EMBED_ROUTE_MISMATCH_BODY_PATTERNS.map((pattern) => pattern.source),
          },
        )

        results.push({
          ...row,
          status: response?.status() ?? 'NAVIGATION_FAILED',
          proxyStatus:
            row.embedIssue && response?.status() === 200
              ? 'embed-unsupported'
              : response?.headers()['x-proxy-status'] || 'unknown',
          proxyErrorCode:
            row.embedIssue && response?.status() === 200
              ? 'UPSTREAM_EMBED_UNSUPPORTED'
              : response?.headers()['x-proxy-error-code'] || null,
        })

        await page.goto('about:blank', { waitUntil: 'domcontentloaded' })
      } catch (error) {
        results.push({
          ...current,
          status: 'NAVIGATION_FAILED',
          proxyStatus: 'harness-failed',
          proxyErrorCode: String(error?.message || error),
          marker: null,
          embedIssue: false,
        })
      }
    }

    await page.close()
  }

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()))
  await browser.close()

  const summary = summarize(results)
  console.log(JSON.stringify(summary, null, 2))

  if (options.output) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(options.output, JSON.stringify({ summary, results }, null, 2))
    console.log(`Full report written to ${options.output}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
