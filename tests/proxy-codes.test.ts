import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BROWSER_REQUIRED_CODES,
  DEAD_CODES,
  DIRECT_FALLBACK_CODES,
} from '../lib/proxy-codes.ts'

const BROWSER_FALLBACK_CODES = [
  'UPSTREAM_TLS_ERROR',
  'UPSTREAM_CONNECTION_ERROR',
  'UPSTREAM_FETCH_FAILED',
]

test('handshake failure codes direct-fallback and leave the dead set', () => {
  for (const code of BROWSER_FALLBACK_CODES) {
    assert.ok(BROWSER_REQUIRED_CODES.has(code), `${code} is browser-required`)
    assert.ok(DIRECT_FALLBACK_CODES.has(code), `${code} direct-fallbacks`)
    assert.ok(!DEAD_CODES.has(code), `${code} is not dead`)
  }
})

test('genuinely unreachable codes stay dead and never direct-fallback', () => {
  for (const code of ['UPSTREAM_NOT_FOUND', 'UPSTREAM_DNS_ERROR', 'UPSTREAM_REDIRECT_LOOP']) {
    assert.ok(DEAD_CODES.has(code), `${code} is dead`)
    assert.ok(!DIRECT_FALLBACK_CODES.has(code), `${code} does not direct-fallback`)
  }
})

test('browser-required codes are always direct fallbacks', () => {
  for (const code of BROWSER_REQUIRED_CODES) {
    assert.ok(DIRECT_FALLBACK_CODES.has(code), `${code} direct-fallbacks`)
  }
})
