import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITE } from './config.ts'
import { FONTS, fontFaceCss, fontPath } from './fonts.ts'
import { MAP_SOURCES, mapSource } from './map-hero.ts'
import { PAGES, pageUrl } from './pages.ts'
import { renderNotFound, renderPage, renderRobots, renderSitemap, type Assets } from './template.ts'
import { validateOutput, validateRegistry } from './validate.ts'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '..', process.env.SITE_OUT ?? 'dist-hosted')

const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex').slice(0, 10)

const minify = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim()

async function publishAsset(name: string, ext: string, data: string | Buffer) {
  const file = `${name}.${hash(data)}.${ext}`
  await writeFile(join(out, 'site-assets', file), data)
  return `/site-assets/${file}`
}

async function buildAssets(): Promise<Assets> {
  await rm(join(out, 'site-assets'), { recursive: true, force: true })
  await mkdir(join(out, 'site-assets'), { recursive: true })
  const urls = new Map<string, string>()
  for (const face of FONTS) urls.set(face.file, await publishAsset(face.file.replace(/\.woff2$/, ''), 'woff2', await readFile(fontPath(face))))
  const source = await readFile(join(here, 'site.css'), 'utf8')
  const css = await publishAsset('site', 'css', minify(`${fontFaceCss(face => urls.get(face.file)!)}\n${source}`))
  const toc = await publishAsset('toc', 'js', await readFile(join(here, 'toc.js'), 'utf8'))
  const map = {
    small: await publishAsset('island-1024', 'webp', await readFile(mapSource(MAP_SOURCES.small))),
    large: await publishAsset('island-2048', 'webp', await readFile(mapSource(MAP_SOURCES.large))),
  }
  return { css, preload: FONTS.filter(face => face.preload).map(face => urls.get(face.file)!), toc, map }
}

async function writePage(slug: string, html: string) {
  const dir = join(out, slug)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'index.html'), html)
}

async function main() {
  const registryErrors = validateRegistry(PAGES)
  if (registryErrors.length > 0) throw new Error(`The page registry is invalid.\n${registryErrors.map(line => `  ${line}`).join('\n')}`)

  await mkdir(out, { recursive: true })
  const rootIndex = join(out, 'index.html')
  if (existsSync(rootIndex) && (await readFile(rootIndex, 'utf8')).includes('id="root"')) {
    console.warn('dist-hosted/index.html is the React app shell. The hosted app build should emit under dist-hosted/app/. Replacing it with the home page.')
  }

  const assets = await buildAssets()
  for (const page of PAGES) await writePage(page.slug, renderPage(page, assets))
  await writeFile(join(out, '404.html'), renderNotFound(assets))
  await writeFile(join(out, 'sitemap.xml'), renderSitemap())
  await writeFile(join(out, 'robots.txt'), renderRobots())
  await writeFile(join(out, `${SITE.indexNowKey}.txt`), SITE.indexNowKey)
  await writeFile(join(out, SITE.googleVerificationFile), `google-site-verification: ${SITE.googleVerificationFile}`)
  for (const [from, to] of [['og.png', 'og.png'], ['logo.png', 'logo.png'], ['favicon.svg', 'favicon.svg']] as const) {
    await copyFile(join(here, 'assets', from), join(out, to))
  }

  const outputErrors = await validateOutput(out, PAGES)
  if (outputErrors.length > 0) throw new Error(`The built site is invalid.\n${outputErrors.map(line => `  ${line}`).join('\n')}`)

  console.log(`site: ${PAGES.length} pages, sitemap, robots, 404 -> ${out}`)
  for (const page of PAGES) console.log(`  ${pageUrl(page.slug).padEnd(28)} ${page.title.length}c title, ${page.description.length}c description`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
