import Image from 'next/image'

type Variant = 'horizontal' | 'icon' | 'main'

const ASSETS: Record<Variant, { src: string; w: number; h: number; alt: string }> = {
  horizontal: { src: '/brand/logo-horizontal.svg', w: 1907.88, h: 493.99, alt: 'MARELL' },
  icon:       { src: '/brand/icon.svg',            w: 930.05,  h: 633.22, alt: 'MARELL' },
  main:       { src: '/brand/logo-main.svg',       w: 1322.46, h: 861.5,  alt: 'MARELL' },
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
  const width = Math.round((asset.w / asset.h) * height)

  return (
    <Image
      src={asset.src}
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
