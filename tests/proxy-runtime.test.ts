import assert from 'node:assert/strict'
import test from 'node:test'

import { buildProxyRuntimeScript } from '../lib/server/proxy-runtime.ts'
import { injectProxyDocument } from '../lib/server/proxy.ts'

const target = new URL('https://reader.example/comic/1')

test('proxy runtime contains storage shims for opaque origins', () => {
  const script = buildProxyRuntimeScript(target)

  assert.match(script, /function perryStorage\(\)/)
  assert.match(script, /defineProperty\(window,"localStorage"/)
  assert.match(script, /defineProperty\(window,"sessionStorage"/)
  assert.match(script, /defineProperty\(document,"cookie"/)
  assert.match(script, /document\.cookie="__p=1"/)
})

test('proxy runtime intercepts user clicks and GET form submissions in capture phase', () => {
  const script = buildProxyRuntimeScript(target)

  assert.match(script, /addEventListener\("click"/)
  assert.match(script, /addEventListener\("submit"/)
  assert.match(script, /preventDefault\(\);location\.href=toProxyUrl/)
  assert.match(script, /if\(method!=="get"\)return/)
  assert.match(script, /e\.defaultPrevented\|\|e\.button!==0/)
})

test('proxy runtime flags websocket handshake failures for the scanner', () => {
  const script = buildProxyRuntimeScript(target)

  assert.match(script, /window\.WebSocket=Wrapped/)
  assert.match(script, /__PERRY_WS_FAILED__/)
  assert.match(script, /addEventListener\("error"/)
})

test('proxy runtime scans for refusals and reports them to the parent frame', () => {
  const script = buildProxyRuntimeScript(target)

  assert.match(script, /open in \(an\? \|the \|our \|your \)\?/)
  assert.match(script, /postMessage\(\{source:"perry-proxy",type:type\}/)
  assert.match(script, /__PERRY_REPORTED__/)
  assert.match(script, /"embed-refused"/)
  assert.match(script, /"connection-failed"/)
  assert.match(script, /MutationObserver/)
  assert.match(script, /REFUSAL\[i\]\.test\(sample\)/)
  assert.match(script, /if\(window\.__PERRY_WS_FAILED__\)/)
})

test('proxy runtime stays idempotent and keeps url rewrites', () => {
  const script = buildProxyRuntimeScript(target)

  assert.match(script, /if\(window\.__PERRY_PROXY_RUNTIME__\)return/)
  assert.match(script, /window\.fetch=function/)
  assert.match(script, /XMLHttpRequest\.prototype\.open/)
  assert.match(script, /history\.pushState=/)
  assert.match(script, /HTMLAnchorElement\.prototype\.click=/)
})

test('proxy runtime escapes interpolated values against script breakout', () => {
  const nasty = new URL('https://reader.example/a?x=%3C/script%3E%3Cscript%3Ealert(1)%3C/script%3E')
  const script = buildProxyRuntimeScript(nasty)

  assert.ok(!script.slice(1, -8).includes('</script>'), 'no early script close inside payload')
  const injected = injectProxyDocument('<html><head></head><body></body></html>', nasty)
  assert.equal((injected.match(/data-perry-proxy-runtime=/g) || []).length, 1)
})
