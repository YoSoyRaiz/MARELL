import type { Metadata } from 'next'
import { Inter, IBM_Plex_Sans, Varela_Round } from 'next/font/google'
import './globals.css'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'

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
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${ibmPlex.variable} ${varelaRound.variable}`}
    >
      <body suppressHydrationWarning>
        <ConfirmProvider>{children}</ConfirmProvider>
      </body>
    </html>
  )
}
