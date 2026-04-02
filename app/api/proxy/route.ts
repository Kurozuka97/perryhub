import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('No URL', { status: 400 })

  try {
    const response = await fetch(decodeURIComponent(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    const html = await response.text()
    const baseTag = `<base href="${decodeURIComponent(url)}">`
    const patched = html.replace(/<head>/i, `<head>${baseTag}`)

    return new NextResponse(patched, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'X-Proxy-Status': 'ok',
      },
    })
  } catch (e) {
    return new NextResponse('Proxy error', { status: 500 })
  }
}
