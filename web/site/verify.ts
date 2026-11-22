import { launchBrowser } from './browser.ts'
import { SITE } from './config.ts'
import { ALL_TREASURES, calc } from './odds.ts'
import { PAGES, pageUrl } from './pages.ts'

const base = (process.argv[2] ?? 'http://127.0.0.1:4181').replace(/\/$/, '')
const expectApp = process.argv.includes('--app')
const local = new URL(base).hostname === '127.0.0.1'
const failures: string[] = []
const warnings: string[] = []
const fail = (at: string, message: string) => failures.push(`${at}  ${message}`)
const warn = (at: string, message: string) => warnings.push(`${at}  ${message}`)
const check = (ok: boolean, at: string, message: string) => { if (!ok) fail(at, message) }

const bypass = process.env.VERCEL_PROTECTION_BYPASS
const bypassHeaders: Record<string, string> = bypass ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' } : {}

const ANALYTICS = '/_vercel/insights/script.js'
const stripOrigin = (url: string) => url.replace(base, '')

async function get(path: string) {
  const response = await fetch(base + path, { redirect: 'manual', headers: bypassHeaders })
  return { status: response.status, type: response.headers.get('content-type') ?? '', body: await response.text(), headers: response.headers }
}

const browser = await launchBrowser()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: bypassHeaders })
await context.addInitScript('window.__name = window.__name || (fn => fn)')

async function checkPage(slug: string) {
  const path = pageUrl(slug)
  const spec = PAGES.find(page => page.slug === slug)!
  const page = await context.newPage()
  const problems: string[] = []
  page.on('console', message => { if (message.type() === 'error' && !message.location().url.includes(ANALYTICS)) problems.push(`console error: ${message.text()} (${message.location().url})`) })
  page.on('pageerror', error => problems.push(`page error: ${error.message}`))
  page.on('response', response => {
    const url = stripOrigin(response.url())
    if (response.status() < 400) return
    if (url.startsWith(ANALYTICS)) return local ? undefined : warn(path, `${ANALYTICS} returned ${response.status()}. Enable Web Analytics for the Vercel project.`)
    problems.push(`${response.status()} for ${url}`)
  })
  await page.addInitScript(() => {
    ;(window as unknown as { __cls: number }).__cls = 0
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  const response = await page.goto(base + path, { waitUntil: 'networkidle' })
  check(response?.status() === 200, path, `status ${response?.status()}`)
  const facts = await page.evaluate(() => {
    const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(node => JSON.parse(node.textContent ?? ''))
    const meta = (selector: string) => document.querySelector(selector)?.getAttribute('content') ?? null
    return {
      h1: document.querySelectorAll('h1').length,
      canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? null,
      title: document.title,
      description: meta('meta[name=description]'),
      ogImage: meta('meta[property="og:image"]'),
      ogTitle: meta('meta[property="og:title"]'),
      twitterCard: meta('meta[name="twitter:card"]'),
      types: ld.flatMap(block => (block['@graph'] ?? [block]).map((node: { '@type': string }) => node['@type'])),
      details: document.querySelectorAll('details.qa').length,
      analytics: !!document.querySelector(`script[src="${'/_vercel/insights/script.js'}"]`),
      disclaimer: document.body.innerText.includes('Not affiliated with or endorsed by Epic Games.'),
      updated: document.querySelector('time')?.getAttribute('datetime') ?? null,
      links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href') ?? ''),
      cls: (window as unknown as { __cls: number }).__cls,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  })
  check(facts.h1 === 1, path, `${facts.h1} h1 elements`)
  check(facts.canonical === SITE.origin + path, path, `canonical is ${facts.canonical}`)
  check(facts.title === spec.title && facts.title.length <= 60, path, `title is "${facts.title}"`)
  check(facts.description === spec.description && (facts.description?.length ?? 999) <= 155, path, 'description differs or is too long')
  check(facts.ogImage === SITE.origin + SITE.ogImage.path && facts.ogTitle === spec.title && facts.twitterCard === 'summary_large_image', path, 'open graph or twitter tags are wrong')
  const need = new Set<string>(slug === '' ? ['WebSite', 'Organization', 'WebApplication'] : ['BreadcrumbList'])
  if (spec.type === 'guide') need.add('Article')
  if (spec.faq.length > 0) need.add('FAQPage')
  for (const type of need) check(facts.types.includes(type), path, `JSON-LD has no ${type}`)
  check(facts.details === spec.faq.length, path, `${facts.details} details for ${spec.faq.length} questions`)
  check(facts.analytics, path, 'analytics script tag is missing')
  check(facts.disclaimer, path, 'Epic disclaimer is missing')
  check(facts.updated === spec.updated, path, `updated stamp is ${facts.updated}`)
  check(facts.cls < 0.01, path, `layout shift ${facts.cls}`)
  check(facts.overflow <= 0, path, `page overflows horizontally by ${facts.overflow}px`)
  for (const problem of problems) fail(path, problem)

  await page.setViewportSize({ width: 375, height: 800 })
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(mobileOverflow <= 0, path, `overflows horizontally by ${mobileOverflow}px at 375px wide`)
  await page.setViewportSize({ width: 1280, height: 900 })

  if (spec.script) await checkCalculator(page, path)
  await page.close()
  return facts.links
}

async function checkCalculator(page: import('playwright').Page, path: string) {
  const raw = await get(path)
  const served = raw.body.match(/id="calc-out"[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? ''
  const rendered = await page.evaluate(() => document.getElementById('calc-out')?.innerHTML ?? '')
  check(served === rendered, path, 'the calculator rows differ between the served HTML and the browser')
  await page.fill('#normal', '100000')
  await page.fill('#hours', '5000')
  const rows = await page.$$eval('#calc-out tr', trs => trs.map(tr => [...tr.children].map(cell => cell.textContent ?? '')))
  check(rows.length === ALL_TREASURES.length, path, `calculator shows ${rows.length} rows`)
  ALL_TREASURES.forEach((entry, at) => {
    const expected = calc.formatPercent(calc.chanceAtLeastOne(entry.oneIn, entry.hoursBoost ?? 1, 100000, 5000))
    check(rows[at]?.[2] === expected, path, `${entry.name} shows ${rows[at]?.[2]}, expected ${expected}`)
  })
  await page.fill('#normal', '')
  const empty = await page.$$eval('#calc-out td:last-child', cells => cells.map(cell => cell.textContent))
  check(empty.every((text, at) => text === calc.formatPercent(calc.chanceAtLeastOne(ALL_TREASURES[at]!.oneIn, ALL_TREASURES[at]!.hoursBoost ?? 1, 0, 5000))), path, 'an empty field is not read as zero')
}

const allLinks = new Set<string>()
for (const spec of PAGES) for (const link of await checkPage(spec.slug)) allLinks.add(link)

for (const link of allLinks) {
  const path = link.split('#')[0]!
  if (!path.startsWith('/') || path === '') continue
  const result = await get(path)
  const isApp = path.startsWith('/app')
  if (isApp && !expectApp) {
    if (result.status !== 200) warn(link, `the app route returns ${result.status} until the app build lands under /app/`)
    continue
  }
  check(result.status === 200, link, `internal link returns ${result.status}`)
}

const sitemap = await get('/sitemap.xml')
check(sitemap.status === 200 && sitemap.type.includes('xml'), '/sitemap.xml', `status ${sitemap.status}, type ${sitemap.type}`)
const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]!)
check(locs.length === PAGES.length, '/sitemap.xml', `${locs.length} urls for ${PAGES.length} pages`)
for (const loc of locs) {
  check(loc.startsWith(SITE.origin), '/sitemap.xml', `${loc} is not on ${SITE.origin}`)
  const result = await get(loc.replace(SITE.origin, ''))
  check(result.status === 200, loc, `sitemap url returns ${result.status}`)
}
check(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap.body), '/sitemap.xml', 'no lastmod')

const robots = await get('/robots.txt')
check(robots.status === 200 && /^Allow: \/$/m.test(robots.body) && robots.body.includes(`Sitemap: ${SITE.origin}/sitemap.xml`), '/robots.txt', 'robots.txt is missing Allow or Sitemap')

for (const asset of [SITE.ogImage.path, SITE.logoPath, '/favicon.svg']) {
  const result = await get(asset)
  check(result.status === 200, asset, `status ${result.status}`)
}

const missing = await get('/this-page-does-not-exist-xyz')
check(missing.status === 404 && missing.body.includes('That page does not exist'), '/this-page-does-not-exist-xyz', `status ${missing.status}, not the 404 page`)
const missingAsset = await get('/site-assets/nope.css')
check(missingAsset.status === 404, '/site-assets/nope.css', `status ${missingAsset.status}`)

if (expectApp) {
  const app = await get('/app/')
  check(app.status === 200 && app.body.includes('id="root"'), '/app/', 'the app shell is not served')
  const deep = await get('/app/demo')
  check(deep.status === 200 && deep.body.includes('id="root"'), '/app/demo', 'the app route does not fall back to the shell')
}

await browser.close()
for (const line of warnings) console.log(`warn  ${line}`)
for (const line of failures) console.log(`FAIL  ${line}`)
console.log(`${base}: ${PAGES.length} pages, ${allLinks.size} unique links, ${locs.length} sitemap urls. ${failures.length} failures, ${warnings.length} warnings.`)
process.exit(failures.length === 0 ? 0 : 1)
