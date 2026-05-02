export interface DocsLink {
  href: string
  label: string
}

export interface DocsSection {
  title: string
  links: DocsLink[]
}

// Single source of truth for the docs sidebar. Add entries here when
// new pages land in src/app/docs/*. Order in the file == order in the
// rendered nav.
export const DOCS_NAV: DocsSection[] = [
  {
    title: 'Introducción',
    links: [
      { href: '/docs', label: 'Bienvenida' },
      { href: '/docs/conceptos', label: 'Conceptos básicos' },
      { href: '/docs/empezar', label: 'Cómo empezar' },
    ],
  },
  {
    title: 'Tu dinero',
    links: [
      { href: '/docs/plan', label: 'Plan mensual' },
      { href: '/docs/cuentas', label: 'Cuentas' },
      { href: '/docs/movimientos', label: 'Movimientos' },
      { href: '/docs/recibos-ocr', label: 'Lectura automática de recibos' },
    ],
  },
  {
    title: 'Hacia tus metas',
    links: [
      { href: '/docs/metas', label: 'Metas' },
      { href: '/docs/programadas', label: 'Transacciones programadas' },
      { href: '/docs/analisis', label: 'Análisis y reportes' },
    ],
  },
  {
    title: 'En equipo',
    links: [
      { href: '/docs/familia', label: 'Familia' },
      { href: '/docs/calculos-rd', label: 'Cálculos RD' },
    ],
  },
  {
    title: 'Referencia',
    links: [
      { href: '/docs/atajos', label: 'Atajos de teclado' },
      { href: '/docs/faq', label: 'Preguntas frecuentes' },
    ],
  },
]

export const DOCS_FLAT: DocsLink[] = DOCS_NAV.flatMap((s) => s.links)
