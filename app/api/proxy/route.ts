import { NextRequest, NextResponse } from 'next/server'
import { getAllowedProxyHosts, registerAllowedProxyHost } from '@/lib/server/source-registry'
import {
  ProxyRequestError,
  fetchProxyPayload,
  renderProxyErrorPage,
} from '@/lib/server/proxy'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')

  try {
    const allowedHosts = await getAllowedProxyHosts()
    const payload = await fetchProxyPayload(url || '', fetch, { allowedHosts })
    registerAllowedProxyHost(new URL(payload.upstreamUrl).hostname)

    return new NextResponse(payload.body, {
      status: payload.status,
      headers: {
        'Content-Type': payload.contentType,
        'Cache-Control': 'no-store',
        'X-Proxy-Status': payload.status >= 400 ? 'upstream-error' : 'ok',
        'X-Proxy-Upstream': payload.upstreamUrl,
      },
    })
  } catch (error) {
    const proxyError =
      error instanceof ProxyRequestError
        ? error
        : new ProxyRequestError(502, 'UPSTREAM_FETCH_FAILED', 'Proxy error')

    return new NextResponse(
      renderProxyErrorPage({
        title: 'Proxy unavailable',
        message: proxyError.message,
        status: proxyError.status,
        code: proxyError.code,
      }),
      {
        status: proxyError.status,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/html; charset=utf-8',
          'X-Proxy-Status': 'error',
          'X-Proxy-Error-Code': proxyError.code,
        },
        statusText: proxyError.code,
      },
    )
  }
}
