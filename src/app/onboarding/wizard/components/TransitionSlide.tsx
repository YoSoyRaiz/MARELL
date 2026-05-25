'use client'

import type { ReactNode } from 'react'
import { WizardHeading } from './WizardHeading'

interface TransitionSlideProps {
  icon?: ReactNode
  title: ReactNode
  subtitle: ReactNode
}

export function TransitionSlide({ icon, title, subtitle }: TransitionSlideProps) {
  return (
    <div className="space-y-7 pt-4">
      {icon && (
        <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center text-[#0B0B0C] [&>svg]:w-7 [&>svg]:h-7">
          {icon}
        </div>
      )}
      <WizardHeading descriptionMaxWidth="lg" description={subtitle}>
        {title}
      </WizardHeading>
    </div>
  )
}
