import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

// Tight Content-Security-Policy. We allow `unsafe-inline` on scripts
// because Next 16's hydration injects inline runtime (a nonce-based
// CSP would require middleware — TODO post-launch, auditoría A6).
// Everything else is locked to la app's own domain plus los terceros
// que genuinamente llamamos:
//   - Supabase project específico (resolvedo en build time desde
//     NEXT_PUBLIC_SUPABASE_URL). Antes era *.supabase.co — wildcard
//     dejaba que un XSS exfiltrara data a cualquier proyecto Supabase.
//     (Auditoría 2026-05-24, M1.)
//   - api-m.paypal.com / api-m.sandbox.paypal.com for billing
//   - www.bancentral.gov.do + open.er-api.com for the FX rate cron
//   - data: + blob: img-src so SVG literals + camera capture work
//   - worker-src so the service worker can register

// Resolver el host de Supabase desde env. Fallback al wildcard solo
// si el env no está seteado (dev local sin .env.local).
const supabaseHost = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) return '*.supabase.co'
    return new URL(url).host
  } catch {
    return '*.supabase.co'
  }
})()
const supabaseHttps = `https://${supabaseHost}`
const supabaseWss = `wss://${supabaseHost}`

const cspParts = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHttps} ${supabaseWss} https://api-m.paypal.com https://api-m.sandbox.paypal.com https://www.bancentral.gov.do https://open.er-api.com`,
  "media-src 'self' blob:",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  // Defense in depth: cero iframes + cero plugins. Pareja con
  // X-Frame-Options DENY arriba.
  "frame-src 'none'",
  "child-src 'none'",
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
    // Defense in depth: bloqueamos APIs sensibles que la app no usa.
    // Si en el futuro añadimos una, agregar aquí explícitamente.
    // (Auditoría 2026-05-24, B2.)
    value:
      'camera=(self), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=()',
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
