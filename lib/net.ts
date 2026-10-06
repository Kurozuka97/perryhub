/**
 * Shared network validation — used by both the client (source URL hygiene)
 * and the server (proxy SSRF protection). Must stay dependency-free and
 * free of server-only imports so it is safe to ship to the browser.
 */

// --- IPv4 parsing (accepts abbreviated / hex / octal / decimal forms) ---

const IPV4_PRIVATE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8        "this network"
  [0x0a000000, 0x0affffff], // 10.0.0.0/8       private
  [0x64400000, 0x647fffff], // 100.64.0.0/10    carrier-grade NAT
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8      loopback
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16   link-local (cloud metadata)
  [0xac100000, 0xac1fffff], // 172.16.0.0/12    private
  [0xc0000000, 0xc00000ff], // 192.0.0.0/24     IETF protocol assignments
  [0xc0000200, 0xc00002ff], // 192.0.2.0/24     TEST-NET-1
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16   private
  [0xc6120000, 0xc613ffff], // 198.18.0.0/15    benchmarking
  [0xc6336400, 0xc63364ff], // 198.51.100.0/24  TEST-NET-2
  [0xcb007100, 0xcb0071ff], // 203.0.113.0/24   TEST-NET-3
  [0xe0000000, 0xefffffff], // 224.0.0.0/4      multicast
  [0xf0000000, 0xffffffff], // 240.0.0.0/4      reserved + broadcast
]

function parseIPv4Part(part: string): number | null {
  if (part.length === 0) return null
  if (/^0[xX][0-9a-fA-F]+$/.test(part)) {
    const value = Number.parseInt(part.slice(2), 16)
    return Number.isSafeInteger(value) ? value : null
  }
  if (/^0[0-7]+$/.test(part)) {
    const value = Number.parseInt(part.slice(1), 8)
    return Number.isSafeInteger(value) ? value : null
  }
  if (/^[0-9]+$/.test(part)) {
    const value = Number.parseInt(part, 10)
    return Number.isSafeInteger(value) ? value : null
  }
  return null
}

/** Parses IPv4 in all browser-accepted forms (1.2.3.4, 1.2.3, 1.2, 1,
 *  0x7f.1, 0177.0.0.1, 2130706433). Returns the 32-bit value or null. */
export function parseIPv4(host: string): number | null {
  if (!/^[0-9a-fA-FxX.]+$/.test(host) || !/[0-9]/.test(host)) return null
  const parts = host.split('.')
  if (parts.length === 0 || parts.length > 4) return null

  const values: number[] = []
  for (const part of parts) {
    const value = parseIPv4Part(part)
    if (value === null) return null
    values.push(value)
  }

  // Every part except the last must fit in one octet.
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] < 0 || values[i] > 255) return null
  }

  let result = values[values.length - 1]
  if (result < 0 || result > 0xffffffff) return null

  for (let i = values.length - 2; i >= 0; i--) {
    if (values[i] > 255) return null
    result += values[i] * 2 ** (8 * (3 - i))
  }

  return result <= 0xffffffff ? result : null
}

function isPrivateIPv4Value(value: number): boolean {
  return IPV4_PRIVATE_RANGES.some(([start, end]) => value >= start && value <= end)
}

// --- IPv6 parsing ---

/** Parses IPv6 (with optional zone id and embedded IPv4) into 8 groups. */
export function parseIPv6(host: string): number[] | null {
  let input = host.replace(/^\[|\]$/g, '')
  const zoneIndex = input.indexOf('%')
  if (zoneIndex !== -1) input = input.slice(0, zoneIndex)
  if (!input.includes(':')) return null

  let head = input
  let embeddedV4: number | null = null

  const lastColon = input.lastIndexOf(':')
  const tail = input.slice(lastColon + 1)
  if (tail.includes('.')) {
    embeddedV4 = parseIPv4(tail)
    if (embeddedV4 === null) return null
    head = input.slice(0, lastColon + 1)
    // Represent embedded IPv4 as two hextets appended to the tail.
    input =
      head +
      ((embeddedV4 >>> 16) & 0xffff).toString(16) +
      ':' +
      (embeddedV4 & 0xffff).toString(16)
  }

  const doubleColonCount = (input.match(/::/g) || []).length
  if (doubleColonCount > 1) return null

  let groups: number[] | null = null
  if (doubleColonCount === 1) {
    const [leftRaw = '', rightRaw = ''] = input.split('::')
    const left = (leftRaw ? leftRaw.split(':') : []).map(parseHexGroup)
    const right = (rightRaw ? rightRaw.split(':') : []).map(parseHexGroup)
    if (left.length + right.length > 7) return null
    if (left.some((g) => g === null) || right.some((g) => g === null)) return null
    groups = [
      ...(left as number[]),
      ...new Array(8 - left.length - right.length).fill(0),
      ...(right as number[]),
    ]
  } else {
    const parts = input.split(':')
    if (parts.length !== 8) return null
    const parsed = parts.map(parseHexGroup)
    if (parsed.some((g) => g === null)) return null
    groups = parsed as number[]
  }

  if (groups.length !== 8 || groups.some((g) => g < 0 || g > 0xffff)) return null
  return groups
}

function parseHexGroup(group: string): number | null {
  if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null
  return Number.parseInt(group, 16)
}

function isPrivateIPv6Groups(groups: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups

  // Unspecified / loopback.
  const allZero = groups.every((g) => g === 0)
  if (allZero) return true
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 1) {
    return true
  }

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d).
  const isV4Mapped = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff
  const isV4Compatible = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0
  if (isV4Mapped || isV4Compatible) {
    const v4 = ((g6 << 16) | g7) >>> 0
    if (isPrivateIPv4Value(v4)) return true
    if (!isV4Mapped) return false
  }

  // 6to4 (2002::/16) embeds an IPv4 address in groups 1-2.
  if (g0 === 0x2002) {
    return isPrivateIPv4Value(((g1 << 16) | g2) >>> 0)
  }

  // Link-local fe80::/10.
  if ((g0 & 0xffc0) === 0xfe80) return true
  // Unique-local fc00::/7.
  if ((g0 & 0xfe00) === 0xfc00) return true
  // Multicast ff00::/8.
  if ((g0 & 0xff00) === 0xff00) return true
  // Deprecated site-local fec0::/10.
  if ((g0 & 0xffc0) === 0xfec0) return true

  return false
}

// --- Hostname checks ---

const PRIVATE_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
])

const PRIVATE_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.intranet',
  '.lan',
  '.home.arpa',
  '.in-addr.arpa',
  '.ip6.arpa',
]

/** True when a hostname (or IP literal) refers to a private/reserved target. */
export function isPrivateAddress(hostname: string): boolean {
  if (!hostname) return true

  let host = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (!host) return true

  const ipv4 = parseIPv4(host)
  if (ipv4 !== null) {
    return isPrivateIPv4Value(ipv4)
  }

  if (host.includes(':')) {
    const groups = parseIPv6(host)
    if (groups) return isPrivateIPv6Groups(groups)
    // Unparseable IPv6-ish input — fail closed.
    return true
  }

  if (PRIVATE_HOSTNAMES.has(host)) return true
  return PRIVATE_HOSTNAME_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/** True for absolute http(s) URLs pointing at public hosts. */
export function isPublicHttpUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return !isPrivateAddress(url.hostname)
  } catch {
    return false
  }
}
