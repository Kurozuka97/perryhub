import { NextRequest, NextResponse } from 'next/server'

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 30 // max 30 requests per minute per IP

const rateMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) return false

  entry.count++
  return true
}

export async function GET(req: NextRequest) {
  // Rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(ip)) {
    return new NextResponse('Too many requests', { status: 429 })
  }

  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) return new NextResponse('No URL', { status: 400 })

  // Validate URL
  let parsed: URL
  try {
    parsed = new URL(decodeURIComponent(raw))
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  // HTTPS only
  if (parsed.protocol !== 'https:') {
    return new NextResponse('Only HTTPS allowed', { status: 403 })
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    const html = await response.text()
    const baseTag = `<base href="${parsed.toString()}">`
    const patched = html.replace(/<head>/i, `<head>${baseTag}`)

    return new NextResponse(patched, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'X-Proxy-Status': 'ok',
      },
    })
  } catch {
    return new NextResponse('Proxy error', { status: 500 })
  }
}
