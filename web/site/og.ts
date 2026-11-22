import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { launchBrowser } from './browser.ts'
import { SITE } from './config.ts'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const fontData = async (pkg: string, file: string) =>
  `data:font/woff2;base64,${(await readFile(join(dirname(require.resolve(`${pkg}/package.json`)), 'files', file))).toString('base64')}`

const css = await readFile(join(here, 'site.css'), 'utf8')
const tokens = css.slice(0, css.indexOf('/* Fonts'))
const host = new URL(SITE.origin).host

const page = `<!doctype html><meta charset="utf-8"><style>
${tokens}
@font-face { font-family: 'Anybody Variable'; font-weight: 100 900; font-stretch: 50% 150%; src: url(${await fontData('@fontsource-variable/anybody', 'anybody-latin-wdth-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Schibsted Grotesk Variable'; font-weight: 400 900; src: url(${await fontData('@fontsource-variable/schibsted-grotesk', 'schibsted-grotesk-latin-wght-normal.woff2')}) format('woff2'); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; padding: 64px 72px; display: flex; flex-direction: column; justify-content: space-between; background: radial-gradient(70% 90% at 12% 0, var(--c-glow), transparent), var(--c-bg); color: var(--c-text); font-family: var(--font-body); }
.top { display: flex; justify-content: space-between; align-items: center; font-size: 30px; color: var(--c-text-soft); }
.brand { display: flex; align-items: center; gap: 16px; color: var(--c-text); font-family: var(--font-display); font-weight: var(--display-weight); font-variation-settings: 'wdth' var(--display-width); font-size: 44px; }
h1 { font-family: var(--font-display); font-weight: var(--display-weight); font-variation-settings: 'wdth' var(--display-width); font-size: 132px; line-height: var(--display-leading); letter-spacing: var(--display-tracking); max-width: 1000px; }
h1 em { font-style: normal; color: var(--c-accent); }
.foot { font-size: 32px; color: var(--c-text-soft); }
</style>
<div class="top"><div class="brand"><svg width="56" height="56" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${tokensColor('--mark-bg')}"/><path d="M7 13h18v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" fill="${tokensColor('--mark-body')}"/><path d="M7 13a9 6 0 0 1 18 0" fill="${tokensColor('--mark-lid')}"/><rect x="14" y="15" width="4" height="5" rx="1" fill="${tokensColor('--mark-bg')}"/></svg>${SITE.name}</div><span>${host}</span></div>
<h1>Every chest, every match, <em>replayed on the map</em></h1>
<div class="foot">No download. Nothing uploaded. Your own Pirate token odds.</div>`

function tokensColor(name: string) {
  return new RegExp(`${name}:\\s*([^;]+);`).exec(tokens)![1]!.trim()
}

const browser = await launchBrowser()
const tab = await browser.newPage({ viewport: { width: SITE.ogImage.width, height: SITE.ogImage.height } })
await tab.setContent(page)
await tab.evaluate(() => document.fonts.ready)
await writeFile(join(here, 'assets', 'og.png'), await tab.screenshot({ type: 'png' }))
await browser.close()

await sharp(join(here, 'assets', 'favicon.svg'), { density: 1200 }).resize(512, 512).png().toFile(join(here, 'assets', 'logo.png'))
console.log('wrote site/assets/og.png and site/assets/logo.png')
