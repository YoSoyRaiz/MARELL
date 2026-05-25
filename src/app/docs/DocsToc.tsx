'use client'

import { useEffect, useState } from 'react'

interface TocItem {
  id: string
  label: string
  level: 2 | 3
}

/**
 * Right-rail "On this page" table of contents. Reads h2/h3 headings
 * from the article element after mount and highlights the section in
 * view via IntersectionObserver. Hidden on mobile/tablet — purely a
 * desktop convenience.
 */
export function DocsToc() {
  const [items, setItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const article = document.querySelector('article[data-doc]')
    if (!article) return
    const headings = article.querySelectorAll<HTMLHeadingElement>('h2, h3')
    const next: TocItem[] = []
    headings.forEach((h) => {
      if (!h.id) {
        h.id = h.textContent
          ?.trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') ?? ''
      }
      if (!h.id) return
      next.push({
        id: h.id,
        label: h.textContent?.trim() ?? '',
        level: h.tagName === 'H2' ? 2 : 3,
      })
    })
    setItems(next)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -70% 0px' },
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [])

  if (items.length === 0) return null

  return (
    <div className="text-meta">
      <div className="text-tiny font-semibold uppercase tracking-[0.18em] text-[var(--muted2)] mb-3">
        En esta página
      </div>
      <ul className="space-y-1.5 border-l border-[var(--border)]">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'pl-4' : 'pl-3'}>
            <a
              href={`#${item.id}`}
              className={`block py-0.5 leading-snug transition-colors ${
                activeId === item.id
                  ? 'text-[var(--brand-2)] font-medium'
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
