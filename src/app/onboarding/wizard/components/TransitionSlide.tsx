'use client'

import type { ReactNode } from 'react'

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
      <h1 className="text-[36px] sm:text-[44px] leading-[1.05] font-bold tracking-tight">
        {title}
      </h1>
      <p className="text-[var(--text2)] text-[18px] leading-relaxed max-w-lg">{subtitle}</p>
    </div>
  )
}
