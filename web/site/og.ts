import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { launchBrowser } from './browser.ts'
import { SITE } from './config.ts'
import { fontFaceCss, fontPath } from './fonts.ts'
import { MAP_SOURCES, mapHero, mapSource } from './map-hero.ts'
import { logoMark } from './template.ts'

const here = dirname(fileURLToPath(import.meta.url))
const css = await readFile(join(here, 'site.css'), 'utf8')
const fonts = new Map<string, string>()
for (const file of ['barlow-condensed-latin-800-normal.woff2', 'barlow-latin-500-normal.woff2', 'barlow-latin-700-normal.woff2']) {
  fonts.set(file, `data:font/woff2;base64,${(await readFile(join(here, 'assets', 'fonts', file))).toString('base64')}`)
}
const island = `data:image/webp;base64,${(await readFile(mapSource(MAP_SOURCES.large))).toString('base64')}`
const host = new URL(SITE.origin).host

const page = `<!doctype html><meta charset="utf-8"><style>
${fontFaceCss(face => fonts.get(face.file) ?? fontPath(face)).replaceAll('font-display:optional', 'font-display:block')}
${css}
body { display: block; width: ${SITE.ogImage.width}px; height: ${SITE.ogImage.height}px; min-height: 0; overflow: hidden; }
.og { position: relative; height: 100%; padding: 48px 64px; }
.og .top { position: relative; z-index: 1; display: flex; align-items: center; gap: 24px; }
.og .brand { font-size: 38px; }
.og .host { color: var(--c-mist); font: 600 22px / 1 var(--font-body); }
.og h1 { position: relative; z-index: 1; max-width: 560px; margin-top: 64px; font-size: 92px; line-height: 0.92; }
.og .og-foot { position: absolute; z-index: 1; left: 64px; bottom: 48px; margin: 0; color: var(--c-prose); font: 500 25px / 1.3 var(--font-body); max-width: 520px; }
.og .hero-map { top: 50%; right: -120px; width: 760px; translate: 0 -50%; }
.og .hero-map *, .og .hero-map *::before { animation: none !important; }
</style>
<div class="og"><div class="top"><span class="brand">${logoMark}<span>${SITE.name}</span></span><span class="host">${host}</span></div>
<h1>Count every Fortnite chest from your replays</h1>
<p class="og-foot">Free, in your browser, and nothing is uploaded.</p>
${mapHero({ small: island, large: island })}</div>`

const browser = await launchBrowser()
const tab = await browser.newPage({ viewport: { width: SITE.ogImage.width, height: SITE.ogImage.height } })
await tab.setContent(page)
await tab.waitForFunction(() => [...document.images].every(image => image.complete))
await tab.evaluate(async () => {
  await Promise.all(['800 100px "Barlow Condensed"', '500 26px Barlow', '700 26px Barlow'].map(font => document.fonts.load(font)))
  await document.fonts.ready
})
await writeFile(join(here, 'assets', 'og.png'), await tab.screenshot({ type: 'png' }))
await browser.close()

await sharp(join(here, 'assets', 'favicon.svg'), { density: 1200 }).resize(512, 512).png().toFile(join(here, 'assets', 'logo.png'))
console.log('wrote site/assets/og.png and site/assets/logo.png')
