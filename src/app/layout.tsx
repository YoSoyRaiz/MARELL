import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MARELL — Clarity in every dollar',
  description:
    'MARELL es la app de finanzas personales para República Dominicana. Toma el control de tu dinero, paga deudas y alcanza tus metas.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
