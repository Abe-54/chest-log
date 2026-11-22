import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { launchBrowser } from './browser.ts'
import { SITE } from './config.ts'
import { fontFaceCss, fontPath } from './fonts.ts'
import { islandArt, logoMark } from './template.ts'

const here = dirname(fileURLToPath(import.meta.url))
const css = await readFile(join(here, 'site.css'), 'utf8')
const fonts = new Map<string, string>()
for (const file of ['barlow-condensed-latin-900-italic.woff2', 'barlow-latin-500-normal.woff2', 'barlow-latin-700-normal.woff2']) {
  fonts.set(file, `data:font/woff2;base64,${(await readFile(join(here, 'assets', 'fonts', file))).toString('base64')}`)
}
const host = new URL(SITE.origin).host

const page = `<!doctype html><meta charset="utf-8"><style>
${fontFaceCss(face => fonts.get(face.file) ?? fontPath(face)).replaceAll('font-display:optional', 'font-display:block')}
${css}
body { display: block; width: ${SITE.ogImage.width}px; height: ${SITE.ogImage.height}px; min-height: 0; overflow: hidden; background: radial-gradient(640px 520px at 900px 330px, var(--c-storm-glow), transparent 70%), linear-gradient(160deg, var(--c-ink) 0, var(--c-band) 100%); }
.og { position: relative; height: 100%; padding: 48px 64px; }
.og .top { display: flex; justify-content: space-between; align-items: center; }
.og .brand { font-size: 40px; }
.og .host { color: var(--c-mist); font: 600 24px / 1 var(--font-body); }
.og h1 { position: relative; z-index: 1; margin-top: 40px; font-size: 94px; line-height: 80px; letter-spacing: -0.01em; text-shadow: var(--shadow-numeral); }
.og h1 span { color: var(--c-gold); }
.og .og-foot { position: absolute; left: 64px; bottom: 48px; margin: 0; color: var(--c-prose); font: 500 25px / 1.3 var(--font-body); max-width: 560px; }
.og .og-foot strong { color: var(--c-bone); font-weight: 700; }
.og .hero-art { top: 86px; right: 28px; width: 520px; }
.og .loot { padding: 12px 16px 14px; }
.og .loot strong { font-size: 48px; line-height: 44px; }
</style>
<div class="og"><div class="top"><span class="brand">${logoMark}<span>${SITE.name}</span></span><span class="host">${host}</span></div>
<h1>Every chest,<br>every match,<br><span>replayed on<br>the map.</span></h1>
<p class="og-foot"><strong>No download. Nothing uploaded.</strong> Your own Pirate token odds.</p>
${islandArt()}</div>`

const browser = await launchBrowser()
const tab = await browser.newPage({ viewport: { width: SITE.ogImage.width, height: SITE.ogImage.height } })
await tab.setContent(page)
await tab.evaluate(async () => {
  await Promise.all(['italic 900 100px "Barlow Condensed"', '500 26px Barlow', '700 26px Barlow'].map(font => document.fonts.load(font)))
  await document.fonts.ready
})
await writeFile(join(here, 'assets', 'og.png'), await tab.screenshot({ type: 'png' }))
await browser.close()

await sharp(join(here, 'assets', 'favicon.svg'), { density: 1200 }).resize(512, 512).png().toFile(join(here, 'assets', 'logo.png'))
console.log('wrote site/assets/og.png and site/assets/logo.png')
