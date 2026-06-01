import { LandingHeader } from '@/components/landing/Header'
import { LandingHero } from '@/components/landing/Hero'
import { LandingHowItWorks } from '@/components/landing/HowItWorks'
import { LandingProblem } from '@/components/landing/Problem'
import { LandingAccounts } from '@/components/landing/Accounts'
import { LandingPricing } from '@/components/landing/Pricing'
import { LandingDownload } from '@/components/landing/Download'
import { LandingCtaBanner } from '@/components/landing/CtaBanner'
import { LandingFooter } from '@/components/landing/Footer'

/** Subtle gradient rule used between major sections — gives the page
 *  rhythm without a hard line. Theme-aware via the `landing-divider-h`
 *  utility in globals.css. */
function SectionRule() {
  return (
    <div className="mx-auto max-w-7xl px-6" aria-hidden>
      <div className="h-px w-full landing-divider-h" />
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <LandingHeader />
      <LandingHero />
      <SectionRule />
      <LandingHowItWorks />
      <SectionRule />
      <LandingProblem />
      <SectionRule />
      <LandingAccounts />
      <SectionRule />
      <LandingPricing />
      <SectionRule />
      <LandingDownload />
      <SectionRule />
      <LandingCtaBanner />
      <LandingFooter />
    </main>
  )
}
