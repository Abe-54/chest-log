import assert from 'node:assert/strict'
import { test } from 'node:test'
import { structuredData } from './jsonld.ts'
import { ALL_TREASURES, calc, treasure } from './odds.ts'
import { PAGES, type Page } from './pages.ts'
import { renderSitemap } from './template.ts'
import { plainText } from './html.ts'
import { validateRegistry } from './validate.ts'

const psa = treasure('pirate-shop-access')

test('the per-chest figures match the list on Epic help article a14361627', () => {
  assert.deepEqual(
    ALL_TREASURES.map(entry => [entry.name, entry.oneIn]),
    [
      ['Weekly Gold Outfit', 1_562_500],
      ['Pirate Shop Access', 137_500],
      ['Weekly Vehicle & Decal', 7_813],
      ['Weekly Pickaxe or Backbling', 568],
      ['Weekly Jam Track', 391],
      ['Weekly Loading Screen', 272],
      ['Gizmo (any)', 127],
    ],
  )
  assert.deepEqual(
    ALL_TREASURES.filter(entry => entry.hoursBoost).map(entry => [entry.name, entry.hoursBoost]),
    [['Weekly Gold Outfit', 7.5], ['Pirate Shop Access', 1.5], ['Weekly Vehicle & Decal', 10]],
  )
})

test('chance of at least one follows 1 - (1 - p)^N', () => {
  const direct = (oneIn: number, chests: number) => 1 - (1 - 1 / oneIn) ** chests
  for (const [oneIn, chests] of [[137_500, 10_000], [7_813, 1_000], [127, 300], [1_562_500, 250_000]] as const) {
    assert.ok(Math.abs(calc.chanceAtLeastOne(oneIn, 1, chests, 0) - direct(oneIn, chests)) < 1e-9)
  }
  assert.equal(calc.chanceAtLeastOne(psa.oneIn, 1, 0, 0), 0)
})

test('Treasure Hours chests use the boosted chance and normal chests do not', () => {
  const boosted = calc.chanceAtLeastOne(psa.oneIn, 1.5, 0, 5_000)
  assert.ok(Math.abs(boosted - calc.chanceAtLeastOne(psa.oneIn / 1.5, 1, 5_000, 0)) < 1e-12)
  const mixed = calc.chanceAtLeastOne(psa.oneIn, 1.5, 4_000, 6_000)
  const both = 1 - (1 - calc.chanceAtLeastOne(psa.oneIn, 1, 4_000, 0)) * (1 - calc.chanceAtLeastOne(psa.oneIn, 1.5, 0, 6_000))
  assert.ok(Math.abs(mixed - both) < 1e-12)
})

test('chestsFor is the smallest chest count that reaches the target', () => {
  for (const target of [0.5, 0.9]) {
    const needed = calc.chestsFor(target, psa.oneIn, 1)
    assert.ok(calc.chanceAtLeastOne(psa.oneIn, 1, needed, 0) >= target)
    assert.ok(calc.chanceAtLeastOne(psa.oneIn, 1, needed - 1, 0) < target)
  }
})

test('percent formatting keeps tiny and near-certain chances readable', () => {
  assert.equal(calc.formatPercent(0), '0%')
  assert.equal(calc.formatPercent(1), '99.99%+')
  assert.equal(calc.formatPercent(1 / 137_500), '0.00073%')
  assert.equal(calc.formatPercent(0.0701), '7.01%')
  assert.equal(calc.formatPercent(0.517), '51.7%')
})

test('the page registry passes every rule in validate.ts', () => {
  assert.deepEqual(validateRegistry(PAGES), [])
})

test('validate.ts rejects the mistakes it exists to catch', () => {
  const base = PAGES.find(page => page.slug === 'privacy')!
  const broken = (change: Partial<Page>) => validateRegistry([PAGES[0]!, { ...base, ...change }])
  assert.match(broken({ title: 'x'.repeat(61) }).join(), /title is 61/)
  assert.match(broken({ description: 'x'.repeat(156) }).join(), /description is 156/)
  assert.match(broken({ related: ['nope', 'faq', 'privacy'] }).join(), /unknown slug/)
  assert.match(broken({ lede: '<p>A long dash \u2014 here</p>' }).join(), /long dash/)
})

test('structured data carries the types each page promises', () => {
  const types = (slug: string) => structuredData(PAGES.find(page => page.slug === slug)!)['@graph'].map(node => (node as { '@type': string })['@type'])
  assert.deepEqual(types('').sort(), ['FAQPage', 'Organization', 'WebApplication', 'WebPage', 'WebSite'])
  assert.deepEqual(types('treasure-hunters-odds').sort(), ['Article', 'BreadcrumbList', 'FAQPage'])
  assert.deepEqual(types('faq').sort(), ['BreadcrumbList', 'FAQPage'])
  assert.deepEqual(types('privacy').sort(), ['BreadcrumbList', 'WebPage'])
  const app = structuredData(PAGES[0]!)['@graph'].find(node => (node as { '@type': string })['@type'] === 'WebApplication') as { offers: { price: string } }
  assert.equal(app.offers.price, '0')
  const article = structuredData(PAGES.find(page => page.slug === 'treasure-hours')!)['@graph'].find(node => (node as { '@type': string })['@type'] === 'Article') as { dateModified: string }
  assert.equal(article.dateModified, '2026-11-22')
})

test('FAQ answers become plain text without stray spaces before punctuation', () => {
  assert.equal(plainText('See <a href="/x">the page</a>, then <code>C:\\a<wbr>b</code>.'), 'See the page, then C:\\ab.')
})

test('the sitemap lists every page once with a lastmod', () => {
  const xml = renderSitemap()
  assert.equal((xml.match(/<url>/g) ?? []).length, PAGES.length)
  assert.equal((xml.match(/<lastmod>2026-11-22<\/lastmod>/g) ?? []).length, PAGES.length)
})
