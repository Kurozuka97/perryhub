/** @type {import('next').NextConfig} */

// Content-Security-Policy for the app shell itself. Proxied third-party
// documents get their own sandbox CSP from /api/proxy and are unaffected.
const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' is required by Next.js hydration and our inline styles;
  // third-party HTML never executes in the app origin (see /api/proxy sandbox).
  "script-src 'self' 'unsafe-inline' https://umami-chi-murex.vercel.app",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  [
    "connect-src 'self'",
    'https://raw.githubusercontent.com',
    'https://*.githubusercontent.com',
    'https://*.github.io',
    'https://apis.google.com',
    'https://*.googleapis.com',
    'https://*.firebaseio.com',
    'https://fonts.googleapis.com',
    'https://umami-chi-murex.vercel.app',
    'https://apsattv.com',
    'https://i.mjh.nz',
    'https:',
  ].join(' '),
  'media-src ' + "'self' blob: https:",
  'frame-src http: https:',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
    ],
  },
  async headers() {
    return [
      {
        // The app shell only — /api/proxy serves third-party documents and
        // sets its own sandbox CSP; combining both would break upstream pages.
        source: '/((?!api/).*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
