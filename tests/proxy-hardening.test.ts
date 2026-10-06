import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ProxyRequestError,
  fetchProxyPayload,
  renderProxyErrorPage,
  PROXY_CSP_DOCUMENT,
  PROXY_CSP_STRICT,
} from '../lib/server/proxy.ts'

function htmlResponse(body = '<html><head></head><body>ok</body></html>', status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

test('fetchProxyPayload rejects oversized bodies declared via content-length', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response('small', {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-length': String(64 * 1024 * 1024),
      },
    })

  await assert.rejects(
    () => fetchProxyPayload('https://huge.example/blob', fetchMock),
    (error: unknown) =>
      error instanceof ProxyRequestError && error.code === 'UPSTREAM_RESPONSE_TOO_LARGE',
  )
})

test('fetchProxyPayload aborts streamed bodies past the 8MB cap', async () => {
  const oneMb = new Uint8Array(1024 * 1024)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < 9; i++) controller.enqueue(oneMb)
      controller.close()
    },
  })

  const fetchMock: typeof fetch = async () =>
    new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })

  await assert.rejects(
    () => fetchProxyPayload('https://huge.example/stream', fetchMock),
    (error: unknown) =>
      error instanceof ProxyRequestError && error.code === 'UPSTREAM_RESPONSE_TOO_LARGE',
  )
})

test('checkOnly skips the body download entirely', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response('unreachable-sized-body', {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-length': String(64 * 1024 * 1024),
      },
    })

  const result = await fetchProxyPayload('https://probe.example/playlist.m3u8', fetchMock, {
    checkOnly: true,
  })

  assert.equal(result.status, 200)
  assert.equal(result.body, '')
})

test('documentAllowlist blocks html for unknown hosts but lets playlists through', async () => {
  const htmlFetch: typeof fetch = async () => htmlResponse()
  await assert.rejects(
    () =>
      fetchProxyPayload('https://unknown.example/', htmlFetch, {
        documentAllowlist: new Set(['known.example']),
      }),
    /not in the allowed source list/,
  )

  const playlistFetch: typeof fetch = async () =>
    new Response('#EXTM3U\n', {
      status: 200,
      headers: { 'content-type': 'application/vnd.apple.mpegurl' },
    })
  const result = await fetchProxyPayload('https://stream.example/live.m3u8', playlistFetch, {
    documentAllowlist: new Set(['known.example']),
  })
  assert.equal(result.body, '#EXTM3U\n')
})

test('html responses carry the sandboxed document CSP, others get strict sandbox', async () => {
  const htmlResult = await fetchProxyPayload('https://reader.example/', async () => htmlResponse())
  assert.equal(htmlResult.csp, PROXY_CSP_DOCUMENT)
  assert.match(htmlResult.csp, /sandbox allow-scripts/)

  const textResult = await fetchProxyPayload(
    'https://reader.example/feed.json',
    async () =>
      new Response('{"a":1}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  )
  assert.equal(textResult.csp, PROXY_CSP_STRICT)
  assert.equal(textResult.csp, 'sandbox')
})

test('renderProxyErrorPage escapes html in every dynamic field', () => {
  const html = renderProxyErrorPage({
    title: '<script>alert(1)</script>',
    message: 'Upstream said <img src=x onerror=alert(2)>',
    status: 502,
    code: 'UPSTREAM_TLS_ERROR"><svg onload=alert(3)>',
  })

  assert.doesNotMatch(html, /<script>/)
  assert.doesNotMatch(html, /<img src=x/)
  assert.doesNotMatch(html, /<svg onload/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&lt;img src=x/)
})

test('fetchProxyPayload rejects dns providers outside the DoH allowlist', async () => {
  const fetchMock: typeof fetch = async () => htmlResponse()

  await assert.rejects(
    () =>
      fetchProxyPayload('https://reader.example/', fetchMock, {
        dnsProvider: 'https://evil.example/dns-query',
      }),
    (error: unknown) =>
      error instanceof ProxyRequestError && error.code === 'INVALID_DNS_PROVIDER',
  )
})

test('dnsLookup hook blocks hostnames that resolve to private addresses', async () => {
  const fetchMock: typeof fetch = async () => htmlResponse()
  let fetchCalled = false
  const countingFetch: typeof fetch = async (...args) => {
    fetchCalled = true
    return fetchMock(...args)
  }

  await assert.rejects(
    () =>
      fetchProxyPayload('https://sneaky.example/', countingFetch, {
        dnsLookup: async () => ['10.0.0.5'],
      }),
    (error: unknown) =>
      error instanceof ProxyRequestError && error.code === 'PRIVATE_HOST_BLOCKED',
  )
  assert.equal(fetchCalled, false)
})

test('dnsLookup hook allows public resolutions and fetches proceed', async () => {
  const fetchMock: typeof fetch = async () => htmlResponse('<html><body>ok</body></html>')

  const result = await fetchProxyPayload('https://reader.example/', fetchMock, {
    dnsLookup: async () => ['93.184.216.34'],
  })

  assert.equal(result.status, 200)
  assert.match(result.body, /data-perry-proxy-runtime=/)
})

test('dnsLookup failures map to UPSTREAM_DNS_ERROR', async () => {
  const fetchMock: typeof fetch = async () => htmlResponse()

  await assert.rejects(
    () =>
      fetchProxyPayload('https://gone.example/', fetchMock, {
        dnsLookup: async () => {
          const error = new Error('getaddrinfo ENOTFOUND gone.example')
          ;(error as NodeJS.ErrnoException).code = 'ENOTFOUND'
          throw error
        },
      }),
    (error: unknown) =>
      error instanceof ProxyRequestError && error.code === 'UPSTREAM_DNS_ERROR',
  )
})
