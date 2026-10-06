import assert from 'node:assert/strict'
import test from 'node:test'

import { parseIPv4, parseIPv6, isPrivateAddress, isPublicHttpUrl } from '../lib/net.ts'

test('parseIPv4 accepts dotted-quad, abbreviated, hex, octal and integer forms', () => {
  assert.equal(parseIPv4('1.2.3.4'), 0x01020304)
  assert.equal(parseIPv4('127.1'), 0x7f000001)
  assert.equal(parseIPv4('1.2.3'), 0x01020003)
  assert.equal(parseIPv4('2130706433'), 0x7f000001)
  assert.equal(parseIPv4('0x7f000001'), 0x7f000001)
  assert.equal(parseIPv4('0177.0.0.1'), 0x7f000001)
  assert.equal(parseIPv4('0x7f.0x0.0x0.0x1'), 0x7f000001)
})

test('parseIPv4 rejects malformed and out-of-range input', () => {
  assert.equal(parseIPv4(''), null)
  assert.equal(parseIPv4('abc'), null)
  assert.equal(parseIPv4('256.1.1.1'), null)
  assert.equal(parseIPv4('1.2.3.4.5'), null)
  assert.equal(parseIPv4('1.2.3.40000000000000000000'), null)
  assert.equal(parseIPv4('10.0.0.'), null)
  assert.equal(parseIPv4('example.com'), null)
})

test('parseIPv6 parses full, compressed and IPv4-embedded forms', () => {
  assert.deepEqual(parseIPv6('2001:db8:0:0:0:0:0:1'), [
    0x2001, 0x0db8, 0, 0, 0, 0, 0, 0x0001,
  ])
  assert.deepEqual(parseIPv6('::1'), [0, 0, 0, 0, 0, 0, 0, 1])
  assert.deepEqual(parseIPv6('::'), [0, 0, 0, 0, 0, 0, 0, 0])
  assert.deepEqual(parseIPv6('[fe80::1%eth0]'), [0xfe80, 0, 0, 0, 0, 0, 0, 1])
  assert.deepEqual(parseIPv6('::ffff:127.0.0.1'), [0, 0, 0, 0, 0, 0xffff, 0x7f00, 0x0001])
  assert.equal(parseIPv6('2001:db8::1::2'), null)
  assert.equal(parseIPv6('2001:db8:::1'), null)
  assert.equal(parseIPv6('12345::1'), null)
  assert.equal(parseIPv6('not-an-address'), null)
})

test('isPrivateAddress flags loopback/private/link-local literals in every notation', () => {
  assert.equal(isPrivateAddress('127.0.0.1'), true)
  assert.equal(isPrivateAddress('127.1'), true)
  assert.equal(isPrivateAddress('0x7f000001'), true)
  assert.equal(isPrivateAddress('0177.0.0.1'), true)
  assert.equal(isPrivateAddress('2130706433'), true)
  assert.equal(isPrivateAddress('10.1.2.3'), true)
  assert.equal(isPrivateAddress('172.16.0.1'), true)
  assert.equal(isPrivateAddress('172.32.0.1'), false)
  assert.equal(isPrivateAddress('192.168.1.1'), true)
  assert.equal(isPrivateAddress('100.64.0.1'), true)
  assert.equal(isPrivateAddress('100.128.0.1'), false)
  assert.equal(isPrivateAddress('169.254.169.254'), true)
  assert.equal(isPrivateAddress('0.0.0.0'), true)
  assert.equal(isPrivateAddress('224.0.0.1'), true)
  assert.equal(isPrivateAddress('240.0.0.1'), true)
  assert.equal(isPrivateAddress('8.8.8.8'), false)
  assert.equal(isPrivateAddress('1.1.1.1'), false)
})

test('isPrivateAddress flags private hostnames and special-use suffixes', () => {
  assert.equal(isPrivateAddress(''), true)
  assert.equal(isPrivateAddress('localhost'), true)
  assert.equal(isPrivateAddress('api.localhost'), true)
  assert.equal(isPrivateAddress('printer.local'), true)
  assert.equal(isPrivateAddress('db.internal'), true)
  assert.equal(isPrivateAddress('intranet.intranet'), true)
  assert.equal(isPrivateAddress('host.lan'), true)
  assert.equal(isPrivateAddress('1.0.0.127.in-addr.arpa'), true)
  assert.equal(isPrivateAddress('metadata.google.internal'), true)
  assert.equal(isPrivateAddress('example.com'), false)
  assert.equal(isPrivateAddress('localhost.example.com'), false)
})

test('isPrivateAddress flags private IPv6 ranges, mapped and 6to4 forms', () => {
  assert.equal(isPrivateAddress('::1'), true)
  assert.equal(isPrivateAddress('[::1]'), true)
  assert.equal(isPrivateAddress('fe80::1'), true)
  assert.equal(isPrivateAddress('fc00::1'), true)
  assert.equal(isPrivateAddress('fd12:3456::1'), true)
  assert.equal(isPrivateAddress('ff02::1'), true)
  assert.equal(isPrivateAddress('fec0::1'), true)
  assert.equal(isPrivateAddress('::ffff:127.0.0.1'), true)
  assert.equal(isPrivateAddress('::ffff:10.0.0.1'), true)
  assert.equal(isPrivateAddress('::ffff:8.8.8.8'), false)
  assert.equal(isPrivateAddress('2002:7f00:1::1'), true)
  assert.equal(isPrivateAddress('2002:0808:0808::1'), false)
  assert.equal(isPrivateAddress('2001:db8::1'), false)
  assert.equal(isPrivateAddress('gggg::1'), true)
})

test('isPublicHttpUrl accepts only absolute http(s) urls on public hosts', () => {
  assert.equal(isPublicHttpUrl('https://example.com/watch?v=1'), true)
  assert.equal(isPublicHttpUrl('http://example.org:8080/'), true)

  assert.equal(isPublicHttpUrl('http://127.0.0.1:3000/'), false)
  assert.equal(isPublicHttpUrl('http://localhost:3000/'), false)
  assert.equal(isPublicHttpUrl('http://[::1]/'), false)
  assert.equal(isPublicHttpUrl('https://169.254.169.254/latest/meta-data/'), false)
  assert.equal(isPublicHttpUrl('ftp://example.com/file'), false)
  assert.equal(isPublicHttpUrl('javascript:alert(1)'), false)
  assert.equal(isPublicHttpUrl('file:///etc/passwd'), false)
  assert.equal(isPublicHttpUrl('//example.com/x'), false)
  assert.equal(isPublicHttpUrl('not a url'), false)
  assert.equal(isPublicHttpUrl(''), false)
})
