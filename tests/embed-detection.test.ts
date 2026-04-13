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
