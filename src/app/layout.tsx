import type { Metadata, Viewport } from 'next'
import { Inter, IBM_Plex_Sans, Varela_Round } from 'next/font/google'
import './globals.css'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { ThemeProvider, THEME_INIT_SCRIPT } from '@/components/ui/ThemeProvider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const ibmPlex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex',
  display: 'swap',
})

const varelaRound = Varela_Round({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-varela',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MARELL — Clarity in every dollar',
  description:
    'Control total de tu dinero, sin complicaciones. MARELL te ayuda a asignar, rastrear y optimizar cada peso para que alcances tus metas más rápido.',
  manifest: '/manifest.webmanifest',
  applicationName: 'MARELL',
  appleWebApp: {
    capable: true,
    title: 'MARELL',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/brand/icon.svg',
    apple: '/brand/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#0B0B0C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${ibmPlex.variable} ${varelaRound.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Set data-theme before paint so light-mode users don't see
            a dark flash on first load. The script reads localStorage
            and falls back to OS preference. */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
