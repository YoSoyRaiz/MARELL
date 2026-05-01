import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

// Tight Content-Security-Policy. We allow `unsafe-inline` on scripts
// because Next 16's hydration injects inline runtime (a nonce-based
// CSP would require middleware). Everything else is locked to the
// app's own domain plus the third parties we genuinely call:
//   - *.supabase.co for the API, Realtime, and Storage (signed URLs)
//   - api-m.paypal.com / api-m.sandbox.paypal.com for billing
//   - www.bancentral.gov.do + open.er-api.com for the FX rate cron
//   - data: + blob: img-src so SVG literals + camera capture work
//   - worker-src so the service worker can register
const cspParts = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api-m.paypal.com https://api-m.sandbox.paypal.com https://www.bancentral.gov.do https://open.er-api.com",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self' https://www.paypal.com https://pagos.azul.com.do",
  "base-uri 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
]

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Camera is allowed for the receipt-capture flow; mic + geo stay
  // disabled. interest-cohort blocks Google's FLoC.
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Content-Security-Policy', value: cspParts.join('; ') },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
]

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
  // Disable the SW in development so HMR isn't intercepted.
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Keep service worker scoped to the root and never cached by
        // the CDN — we want updates to roll out immediately.
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },
}

export default withSerwist(nextConfig)
