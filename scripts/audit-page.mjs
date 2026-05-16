#!/usr/bin/env node
/**
 * Generic page audit — captures dark/light screenshots of any public
 * route. Used when audit-landing.mjs (landing-specific) isn't enough.
 *
 *   node scripts/audit-page.mjs <url> <slug> [width=1440] [outDir=./.audit]
 *
 * Slug becomes the file prefix:
 *   .audit/<slug>-dark-fullpage.png
 *   .audit/<slug>-light-fullpage.png
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const url = process.argv[2]
const slug = process.argv[3]
const width = Number(process.argv[4] ?? 1440)
const outDir = resolve(process.argv[5] ?? './.audit')
if (!url || !slug) {
  console.error('Usage: audit-page.mjs <url> <slug> [width] [outDir]')
  process.exit(1)
}
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
try {
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: theme,
      deviceScaleFactor: 2,
    })
    const page = await ctx.newPage()
    await page.addInitScript((t) => {
      try {
        localStorage.setItem('marell:theme', t)
      } catch {}
    }, theme)
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    await page.screenshot({
      path: `${outDir}/${slug}-${theme}-fullpage.png`,
      fullPage: true,
    })
    await ctx.close()
    console.log(`✓ ${slug} ${theme} → ${outDir}/${slug}-${theme}-fullpage.png`)
  }
} finally {
  await browser.close()
}
