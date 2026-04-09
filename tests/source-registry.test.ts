import assert from 'node:assert/strict'
import test from 'node:test'

import {
  expandAllowedHostVariants,
  getAllowedProxyHosts,
  registerAllowedProxyHost,
} from '../lib/server/source-registry.ts'

test('expandAllowedHostVariants includes apex aliases for common same-site subdomains', () => {
  assert.deepEqual(
    [...expandAllowedHostVariants('wp.comicskingdom.com')].sort(),
    ['comicskingdom.com', 'wp.comicskingdom.com', 'www.comicskingdom.com'],
  )
})

test('expandAllowedHostVariants includes www alias for apex hosts', () => {
  assert.deepEqual(
    [...expandAllowedHostVariants('phoenixscans.com')].sort(),
    ['phoenixscans.com', 'www.phoenixscans.com'],
  )
})

test('getAllowedProxyHosts caches normalized variants and accepts registered redirect hosts', async () => {
  // Clear cache for this test
  const fetchMock: typeof fetch = async () =>
    new Response(
      JSON.stringify([
        {
          sources: [{ baseUrl: 'https://wp.comicskingdom.com' }],
        },
      ]),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    )

  const hosts = await getAllowedProxyHosts(fetchMock)
  assert.equal(hosts.has('wp.comicskingdom.com'), true)
  assert.equal(hosts.has('comicskingdom.com'), true)

  registerAllowedProxyHost('reader.example.com')
  assert.equal(hosts.has('reader.example.com'), true)
})
