import assert from 'node:assert/strict'
import test from 'node:test'

import { detectEmbeddedProxyIssue } from '../lib/embed-detection.ts'

test('detectEmbeddedProxyIssue flags embedded route mismatches', () => {
  const issue = detectEmbeddedProxyIssue(
    'Phoenix Scans',
    'Page not found. Il Phoenix Scans nasce dall\'unione di Eagles e Phantom Team.',
  )

  assert.equal(
    issue,
    'Source loaded, but its frontend rejected the embedded proxy URL. Use Open in Tab.',
  )
})

test('detectEmbeddedProxyIssue flags embedded route mismatches after nav chrome', () => {
  const issue = detectEmbeddedProxyIssue(
    'Phoenix Scans',
    'Phoenix Scans Ultime uscite Consigliati Tutti i manga Forum Notte Page not found. The page you are trying to get doesn\'t exist.',
  )

  assert.equal(
    issue,
    'Source loaded, but its frontend rejected the embedded proxy URL. Use Open in Tab.',
  )
})

test('detectEmbeddedProxyIssue ignores healthy embedded pages', () => {
  const issue = detectEmbeddedProxyIssue('Phoenix Scans', 'Ultime uscite Oshi no Ko Spy x Family')

  assert.equal(issue, null)
})

test('detectEmbeddedProxyIssue flags pages that refuse embedding', () => {
  const openExternally = detectEmbeddedProxyIssue(
    'Stream here',
    'Please open in an external browser to continue watching.',
  )
  assert.equal(openExternally, 'Source requires an external browser. Use Open in Tab.')

  const webVersion = detectEmbeddedProxyIssue(
    'Reader',
    'The web version is not available on this device.',
  )
  assert.equal(webVersion, 'Source requires an external browser. Use Open in Tab.')

  const browserOnly = detectEmbeddedProxyIssue(
    'Manga Hub',
    'This feature is not available in this browser.',
  )
  assert.equal(browserOnly, 'Source requires an external browser. Use Open in Tab.')

  const appWall = detectEmbeddedProxyIssue(
    'AnimeX',
    'Download our mobile app to continue reading.',
  )
  assert.equal(appWall, 'Source requires an external browser. Use Open in Tab.')
})

test('detectEmbeddedProxyIssue ignores normal app-store calls to action', () => {
  const issue = detectEmbeddedProxyIssue(
    'Phoenix Scans',
    'Get the latest releases. Download our app from the store. Ultime uscite Oshi no Ko.',
  )

  assert.equal(issue, null)
})
