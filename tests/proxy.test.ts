import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ProxyRequestError,
  injectProxyDocument,
  fetchProxyPayload,
  injectBaseTag,
  mapProxyError,
  parseProxyTarget,
  normalizeProxyBrowserUrl,
  renderProxyErrorPage,
  toProxyRequestUrl,
  isPrivateAddress,
} from '../lib/server/proxy.ts'

test('parseProxyTarget accepts public http and https urls', () => {
  assert.equal(parseProxyTarget('https://iana.org').hostname, 'iana.org')
  assert.equal(parseProxyTarget('http://example.com').protocol, 'http:')
})

test('parseProxyTarget rejects missing, malformed and unsupported urls', () => {
  assert.throws(() => parseProxyTarget(''), ProxyRequestError)
  assert.throws(() => parseProxyTarget('not-a-url'), ProxyRequestError)
  assert.throws(() => parseProxyTarget('ftp://example.com'), /Unsupported protocol/)
})

test('parseProxyTarget blocks localhost and private hosts', () => {
  assert.throws(() => parseProxyTarget('http://localhost:3000'), /Private hosts/)
  assert.throws(() => parseProxyTarget('http://127.0.0.1:8080'), /Private hosts/)
  assert.throws(() => parseProxyTarget('http://192.168.1.10'), /Private hosts/)
})

test('isPrivateAddress detects IPv6 and IPv4-mapped IPv6 private addresses', () => {
  assert.equal(isPrivateAddress('::1'), true)
  assert.equal(isPrivateAddress('[::1]'), true)
  assert.equal(isPrivateAddress('fc00::1'), true)
  assert.equal(isPrivateAddress('fe80::1'), true)
  assert.equal(isPrivateAddress('::ffff:127.0.0.1'), true)
  assert.equal(isPrivateAddress('::ffff:192.168.1.1'), true)
  assert.equal(isPrivateAddress('2001:db8::1'), false)
  assert.equal(isPrivateAddress('example.com'), false)
})

test('injectBaseTag adds a base tag only once', () => {
  const target = new URL('https://reader.example/path')
  const html = '<html><head><title>x</title></head><body>ok</body></html>'
  const patched = injectBaseTag(html, target)

  assert.match(patched, /<head><base href="https:\/\/reader\.example\/path">/)
  assert.equal(injectBaseTag(patched, target), patched)
})

test('injectProxyDocument adds a proxy runtime only once', () => {
  const target = new URL('https://reader.example/path')
  const html = '<html><head><title>x</title></head><body>ok</body></html>'
  const patched = injectProxyDocument(html, target)

  assert.match(
    patched,
    /<head><base href="https:\/\/reader\.example\/path"><script data-perry-proxy-runtime=/,
  )
  assert.match(patched, /\/api\/proxy\?url=/)
  assert.equal((patched.match(/data-perry-proxy-runtime=/g) || []).length, 1)
  assert.equal(injectProxyDocument(patched, target), patched)
})

test('fetchProxyPayload patches html responses and preserves status', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response('<html><head></head><body>Hello</body></html>', {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })

  const result = await fetchProxyPayload('https://reader.example', fetchMock)

  assert.equal(result.status, 201)
  assert.equal(result.contentType, 'text/html; charset=utf-8')
  assert.match(result.body, /<base href="https:\/\/reader\.example\/">/)
  assert.match(result.body, /data-perry-proxy-runtime=/)
})

test('fetchProxyPayload uses the final upstream url after redirects for the injected runtime', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response('<html><head></head><body>Hello</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })

  Object.defineProperty(fetchMock, 'name', { value: 'fetchMock' })

  const result = await fetchProxyPayload(
    'https://wp.comicskingdom.com/',
    async () => {
      const response = await fetchMock('https://wp.comicskingdom.com/' as unknown as RequestInfo)
      Object.defineProperty(response, 'url', {
        value: 'https://comicskingdom.com/',
      })
      return response
    },
  )

  assert.match(result.body, /<base href="https:\/\/comicskingdom\.com\/">/)
  assert.doesNotMatch(result.body, /<base href="https:\/\/wp\.comicskingdom\.com\/">/)
  assert.equal(result.upstreamUrl, 'https://comicskingdom.com/')
})

test('fetchProxyPayload leaves non-html responses untouched', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response('plain text', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })

  const result = await fetchProxyPayload('https://reader.example/feed.txt', fetchMock)

  assert.equal(result.body, 'plain text')
  assert.equal(result.contentType, 'text/plain; charset=utf-8')
})

test('fetchProxyPayload rejects hosts outside the allowed list', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response('ok', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })

  await assert.rejects(
    () =>
      fetchProxyPayload('https://blocked.example', fetchMock, {
        allowedHosts: new Set(['allowed.example']),
      }),
    /Host is not in the allowed source list/,
  )
})

test('mapProxyError classifies tls and timeout failures', () => {
  const dnsError = mapProxyError({
    cause: { code: 'ENOTFOUND', hostname: 'animepahe.si' },
  })
  assert.equal(dnsError.status, 502)
  assert.equal(dnsError.code, 'UPSTREAM_DNS_ERROR')

  const connectionError = mapProxyError({
    cause: { code: 'ECONNREFUSED' },
  })
  assert.equal(connectionError.status, 502)
  assert.equal(connectionError.code, 'UPSTREAM_CONNECTION_ERROR')

  const tlsError = mapProxyError({
    cause: { code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' },
  })
  assert.equal(tlsError.status, 502)
  assert.equal(tlsError.code, 'UPSTREAM_TLS_ERROR')

  const abort = new DOMException('timed out', 'AbortError')
  const timeoutError = mapProxyError(abort)
  assert.equal(timeoutError.status, 504)
  assert.equal(timeoutError.code, 'UPSTREAM_TIMEOUT')
})

test('fetchProxyPayload rejects browser-verification and missing upstream pages', async () => {
  const challengeFetchMock: typeof fetch = async () =>
    new Response('<html><body>Just a moment... Cloudflare</body></html>', {
      status: 403,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })

  await assert.rejects(
    () => fetchProxyPayload('https://blocked.example', challengeFetchMock),
    /Source blocked automated access/,
  )

  const missingFetchMock: typeof fetch = async () =>
    new Response('not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })

  await assert.rejects(
    () => fetchProxyPayload('https://missing.example', missingFetchMock),
    /Source endpoint is no longer available/,
  )
})

test('renderProxyErrorPage returns iframe-safe html', () => {
  const html = renderProxyErrorPage({
    title: 'Proxy unavailable',
    message: 'Upstream TLS handshake failed',
    status: 502,
    code: 'UPSTREAM_TLS_ERROR',
  })

  assert.match(html, /<!DOCTYPE html>/)
  assert.match(html, /Proxy unavailable/)
  assert.match(html, /UPSTREAM_TLS_ERROR/)
  assert.match(html, /Upstream TLS handshake failed/)
})

test('toProxyRequestUrl always produces an absolute proxy url on the deployment origin', () => {
  assert.equal(
    toProxyRequestUrl(
      new URL('https://comic-growl.com/api/auth/session'),
      'https://skill-deploy.example.vercel.app',
    ),
    'https://skill-deploy.example.vercel.app/api/proxy?url=https%3A%2F%2Fcomic-growl.com%2Fapi%2Fauth%2Fsession',
  )
})

test('normalizeProxyBrowserUrl maps preview-origin app routes back to the upstream host', () => {
  const currentUrl = new URL('https://comic-growl.com/')
  const browserUrl = new URL(
    'https://skill-deploy.example.vercel.app/auth/signin?from=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fcomic-growl.com%252F',
  )

  const normalized = normalizeProxyBrowserUrl(
    browserUrl,
    currentUrl,
    'https://skill-deploy.example.vercel.app',
  )

  assert.equal(
    normalized.toString(),
    'https://comic-growl.com/auth/signin?from=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fcomic-growl.com%252F',
  )
})

test('normalizeProxyBrowserUrl unwraps already proxied urls back to their upstream target', () => {
  const currentUrl = new URL('https://comic-growl.com/')
  const browserUrl = new URL(
    'https://skill-deploy.example.vercel.app/api/proxy?url=https%3A%2F%2Fcomic-growl.com%2Fepisodes%2F123',
  )

  const normalized = normalizeProxyBrowserUrl(
    browserUrl,
    currentUrl,
    'https://skill-deploy.example.vercel.app',
  )

  assert.equal(normalized.toString(), 'https://comic-growl.com/episodes/123')
})

test('fetchProxyPayload blocks redirect to non-allowlisted host', async () => {
  const fetchMock: typeof fetch = async (input) => {
    const resp = new Response('<html><body>evil</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
    Object.defineProperty(resp, 'url', {
      value: 'https://evil.example.com/',
    })
    return resp
  }

  await assert.rejects(
    () =>
      fetchProxyPayload('https://allowed.example/', fetchMock, {
        allowedHosts: new Set(['allowed.example']),
      }),
    /not in the allowed source list/,
  )
})

test('fetchProxyPayload blocks redirect to private host', async () => {
  const fetchMock: typeof fetch = async (input) => {
    const resp = new Response('<html><body>metadata</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
    Object.defineProperty(resp, 'url', {
      value: 'http://169.254.169.254/latest/meta-data/',
    })
    return resp
  }

  // allowed.example is in the allowlist, but the redirect target 169.254.169.254 is private
  await assert.rejects(
    () =>
      fetchProxyPayload('https://allowed.example/', fetchMock, {
        allowedHosts: new Set(['allowed.example', '169.254.169.254']),
      }),
    /private\/reserved host/,
  )
})

test('fetchProxyPayload injects proxy document for XHTML content-type', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response('<html><head></head><body>XHTML</body></html>', {
      status: 200,
      headers: { 'content-type': 'application/xhtml+xml; charset=utf-8' },
    })

  const result = await fetchProxyPayload('https://reader.example/page.xhtml', fetchMock)

  assert.match(result.body, /<base href="https:\/\/reader\.example\/page\.xhtml">/)
  assert.match(result.body, /data-perry-proxy-runtime=/)
})
