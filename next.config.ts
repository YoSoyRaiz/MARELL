import type { NextConfig } from 'next'

// Tight Content-Security-Policy. We allow `unsafe-inline` on scripts
// because Next 16's hydration injects inline runtime (a nonce-based
// CSP would require middleware). Everything else is locked to the
// app's own domain plus the third parties we genuinely call:
//   - *.supabase.co for the API and Realtime
//   - api-m.paypal.com / api-m.sandbox.paypal.com for billing
//   - www.bancentral.gov.do + open.er-api.com for the FX rate cron
//   - data: img-src so SVG icon literals work
const cspParts = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api-m.paypal.com https://api-m.sandbox.paypal.com https://www.bancentral.gov.do https://open.er-api.com",
  "frame-ancestors 'none'",
  "form-action 'self' https://www.paypal.com https://pagos.azul.com.do",
  "base-uri 'self'",
  "object-src 'none'",
]

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Content-Security-Policy', value: cspParts.join('; ') },
  // Cross-Origin-Opener-Policy lets the SSO popup flow work while still
  // isolating the origin from window.opener attacks.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
