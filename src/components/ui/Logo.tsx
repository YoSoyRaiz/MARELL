'use client'

import Image from 'next/image'
import { useTheme } from './ThemeProvider'

type Variant = 'horizontal' | 'icon' | 'main'

interface VariantAsset {
  /** Default asset (used in dark mode and as fallback). */
  src: string
  /** Optional light-mode override — has darker text strokes so the
   *  "MARELL" wordmark stays readable on paper white. The icon
   *  variant doesn't need a light version (no white text). */
  srcLight?: string
  w: number
  h: number
  alt: string
}

const ASSETS: Record<Variant, VariantAsset> = {
  horizontal: {
    src: '/brand/logo-horizontal.svg',
    srcLight: '/brand/logo-horizontal-light.svg',
    w: 1907.88,
    h: 493.99,
    alt: 'MARELL',
  },
  icon: {
    src: '/brand/icon.svg',
    w: 930.05,
    h: 633.22,
    alt: 'MARELL',
  },
  main: {
    src: '/brand/logo-main.svg',
    srcLight: '/brand/logo-main-light.svg',
    w: 1322.46,
    h: 861.5,
    alt: 'MARELL',
  },
}

export function Logo({
  variant = 'horizontal',
  height = 32,
  className = '',
  priority = false,
}: {
  variant?: Variant
  height?: number
  className?: string
  priority?: boolean
}) {
  const asset = ASSETS[variant]
  const { resolved } = useTheme()
  const src =
    resolved === 'light' && asset.srcLight ? asset.srcLight : asset.src
  const width = Math.round((asset.w / asset.h) * height)

  return (
    <Image
      src={src}
      alt={asset.alt}
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={className}
      style={{ width: 'auto', height: `${height}px` }}
    />
  )
}
