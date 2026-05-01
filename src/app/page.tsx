import { LandingHeader } from '@/components/landing/Header'
import { LandingHero } from '@/components/landing/Hero'
import { LandingHowItWorks } from '@/components/landing/HowItWorks'
import { LandingProblem } from '@/components/landing/Problem'
import { LandingAccounts } from '@/components/landing/Accounts'
import { LandingDownload } from '@/components/landing/Download'
import { LandingCtaBanner } from '@/components/landing/CtaBanner'
import { LandingFooter } from '@/components/landing/Footer'

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <LandingHeader />
      <LandingHero />
      <LandingHowItWorks />
      <LandingProblem />
      <LandingAccounts />
      <LandingDownload />
      <LandingCtaBanner />
      <LandingFooter />
    </main>
  )
}
