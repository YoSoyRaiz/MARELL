#!/usr/bin/env node
/**
 * Visual-audit helper for the MARELL landing.
 *
 *   node scripts/audit-landing.mjs [url] [outDir]
 *
 * Defaults: url=https://www.marell.app, outDir=./.audit
 *
 * Produces three screenshots per theme (full page + above-fold + hero
 * mockup) so you can compare contrast / layout side by side without
 * eyeballing a live browser.
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const url = process.argv[2] ?? 'https://www.marell.app/'
const outDir = resolve(process.argv[3] ?? './.audit')
await mkdir(outDir, { recursive: true })

const viewport = { width: 1440, height: 900 }
const themes = /** @type {const} */ (['dark', 'light'])

const browser = await chromium.launch()
try {
  for (const theme of themes) {
    const ctx = await browser.newContext({
      viewport,
      colorScheme: theme,
      deviceScaleFactor: 2,
    })
    const page = await ctx.newPage()

    // Seed the theme via localStorage before the in-page script runs,
    // so the data-theme attr matches without waiting for system pref.
    // Key must match STORAGE_KEY in ThemeProvider.tsx.
    await page.addInitScript((t) => {
      try {
        localStorage.setItem('marell:theme', t)
      } catch {}
    }, theme)

    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)

    await page.screenshot({
      path: `${outDir}/${theme}-fullpage.png`,
      fullPage: true,
    })
    await page.screenshot({
      path: `${outDir}/${theme}-above-fold.png`,
      fullPage: false,
    })

    // Hero device frame — locate by the dashboard alt text.
    const hero = page.locator('img[alt*="Dashboard de MARELL"]').first()
    if (await hero.count()) {
      await hero.screenshot({ path: `${outDir}/${theme}-hero.png` })
    }

    await ctx.close()
    console.log(`✓ ${theme} → ${outDir}/${theme}-*.png`)
  }
} finally {
  await browser.close()
}
