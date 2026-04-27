import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex justify-center mb-10">
          <Link href="/" aria-label="MARELL" className="inline-flex">
            <Logo variant="horizontal" height={42} priority />
          </Link>
        </div>
        {children}
      </div>
    </main>
  )
}
