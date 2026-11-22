import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SITE } from './config.ts'
import { pageUrl, type Page } from './pages.ts'

const TITLE_MAX = 60
const DESCRIPTION_MAX = 155
const RESERVED_IDS = new Set(['main', 'faq-list', 'faq-h', 'related-h', 'cta-h'])
const BANNED_PROSE = /[—–‘’“”]/
const EXTERNAL_PREFIXES = ['/app/', '/_vercel/']

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))

const pageText = (page: Page) =>
  [page.title, page.description, page.h1, page.lede, ...page.sections.flatMap(s => [s.heading, s.html]), ...page.faq.flatMap(f => [f.q, f.a])].join('\n')

export function validateRegistry(pages: readonly Page[]): string[] {
  const errors: string[] = []
  const slugs = new Set(pages.map(page => page.slug))
  if (slugs.size !== pages.length) errors.push('Two pages share a slug.')
  if (!slugs.has('')) errors.push('There is no home page (slug "").')
  for (const page of pages) {
    const at = `/${page.slug}`
    if (!/^[a-z0-9-]*$/.test(page.slug)) errors.push(`${at}: slug must be lowercase letters, digits and hyphens.`)
    if (page.title.length > TITLE_MAX) errors.push(`${at}: title is ${page.title.length} characters, the limit is ${TITLE_MAX}.`)
    if (page.description.length > DESCRIPTION_MAX) errors.push(`${at}: description is ${page.description.length} characters, the limit is ${DESCRIPTION_MAX}.`)
    if (!page.h1.trim()) errors.push(`${at}: h1 is empty.`)
    if (!isIsoDate(page.published) || !isIsoDate(page.updated)) errors.push(`${at}: published and updated must be ISO dates.`)
    else if (page.updated < page.published) errors.push(`${at}: updated is before published.`)
    for (const slug of [...page.breadcrumbs, ...page.related]) if (!slugs.has(slug)) errors.push(`${at}: unknown slug "${slug}" in breadcrumbs or related.`)
    if (page.related.includes(page.slug)) errors.push(`${at}: related lists the page itself.`)
    if (new Set(page.related).size !== page.related.length) errors.push(`${at}: related has duplicates.`)
    if (page.related.length < 3) errors.push(`${at}: needs at least 3 related pages.`)
    const ids = page.sections.map(section => section.id)
    if (new Set(ids).size !== ids.length) errors.push(`${at}: section ids repeat.`)
    for (const id of ids) if (RESERVED_IDS.has(id)) errors.push(`${at}: section id "${id}" is reserved.`)
    if (page.faq.some(entry => !entry.q.trim() || !entry.a.trim())) errors.push(`${at}: a FAQ entry is empty.`)
    if (page.type === 'faq' && page.faq.length < 12) errors.push(`${at}: the FAQ page needs at least 12 questions.`)
    if (BANNED_PROSE.test(pageText(page))) errors.push(`${at}: prose contains a long dash or a curly quote.`)
    if (page.script && page.type === 'home') errors.push(`${at}: only the odds page may carry a script.`)
  }
  return errors
}

const attrs = (html: string, name: string) => [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, 'g'))].map(match => match[1]!)

export async function validateOutput(outDir: string, pages: readonly Page[]): Promise<string[]> {
  const errors: string[] = []
  const known = new Set(pages.map(page => pageUrl(page.slug)))
  for (const page of pages) {
    const file = join(outDir, page.slug, 'index.html')
    const at = pageUrl(page.slug)
    if (!existsSync(file)) {
      errors.push(`${at}: ${file} was not written.`)
      continue
    }
    const html = await readFile(file, 'utf8')
    const count = (html.match(/<h1[\s>]/g) ?? []).length
    if (count !== 1) errors.push(`${at}: found ${count} h1 elements.`)
    const canonical = attrs(html.match(/<link rel="canonical"[^>]*>/)?.[0] ?? '', 'href')[0]
    if (canonical !== `${SITE.origin}${at}`) errors.push(`${at}: canonical is ${canonical}.`)
    for (const [, body] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(body!)
      } catch {
        errors.push(`${at}: a JSON-LD block does not parse.`)
      }
    }
    const ids = attrs(html, 'id')
    const dupes = ids.filter((id, index) => ids.indexOf(id) !== index)
    if (dupes.length > 0) errors.push(`${at}: repeated ids ${[...new Set(dupes)].join(', ')}.`)
    for (const href of attrs(html, 'href')) {
      if (href.startsWith('#')) {
        if (!ids.includes(href.slice(1))) errors.push(`${at}: anchor ${href} has no target.`)
      } else if (href.startsWith('/') && !EXTERNAL_PREFIXES.some(prefix => href.startsWith(prefix))) {
        const path = href.split('#')[0]!
        const onDisk = existsSync(join(outDir, path)) && !path.endsWith('/')
        if (!known.has(path) && !onDisk) errors.push(`${at}: link ${href} points at nothing.`)
      }
    }
    const scripts = (html.match(/<script(?![^>]*(?:ld\+json|application\/json|src=))[^>]*>/g) ?? []).length
    const allowed = 1 + (page.script ? 1 : 0)
    if (scripts !== allowed) errors.push(`${at}: found ${scripts} inline scripts, expected ${allowed}.`)
    if (!html.includes(SITE.disclaimer)) errors.push(`${at}: the disclaimer is missing from the footer.`)
    if (page.faq.length > 0 && (html.match(/<details>/g) ?? []).length !== page.faq.length) errors.push(`${at}: FAQ count differs from the details elements.`)
  }
  for (const required of ['sitemap.xml', 'robots.txt', '404.html', 'og.png', 'logo.png', 'favicon.svg']) {
    if (!existsSync(join(outDir, required))) errors.push(`${required} was not written.`)
  }
  return errors
}
