import { SITE } from './config.ts'
import { esc, longDate } from './html.ts'
import { structuredData } from './jsonld.ts'
import { PAGES, pageBySlug, pageUrl, type Page } from './pages.ts'

export type Assets = { css: string; fonts: { display: string; body: string } }

const abs = (path: string) => `${SITE.origin}${path}`

const json = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c')

const brandMark = `<svg class="mark" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false"><rect class="m-bg" width="32" height="32" rx="8"/><path class="m-body" d="M7 13h18v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path class="m-lid" d="M7 13a9 6 0 0 1 18 0"/><rect class="m-bg" x="14" y="15" width="4" height="5" rx="1"/></svg>`

const NAV: readonly string[] = ['treasure-hunters-odds', 'fortnite-replay-files', 'faq']
const FOOTER_PAGES: readonly string[] = ['treasure-hunters-odds', 'fortnite-replay-files', 'treasure-hours', 'auto-track', 'faq', 'privacy']

const navLink = (slug: string) => `<a href="${pageUrl(slug)}">${esc(pageBySlug(slug)!.label)}</a>`

const analytics = `<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script><script defer src="/_vercel/insights/script.js"></script>`

const head = (page: Page, assets: Assets) => {
  const url = abs(pageUrl(page.slug))
  const image = abs(SITE.ogImage.path)
  const article = page.type === 'guide'
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#0f1720">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${assets.fonts.display}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${assets.fonts.body}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${assets.css}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:type" content="${article ? 'article' : 'website'}">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="${SITE.ogImage.width}">
<meta property="og:image:height" content="${SITE.ogImage.height}">
<meta property="og:image:alt" content="${esc(SITE.ogImage.alt)}">${article ? `
<meta property="article:published_time" content="${page.published}">
<meta property="article:modified_time" content="${page.updated}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${image}">
<meta name="twitter:image:alt" content="${esc(SITE.ogImage.alt)}">
<script type="application/ld+json">${json(structuredData(page))}</script>`
}

const header = () => `<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap bar">
<a class="brand" href="/">${brandMark}<span>${SITE.name}</span></a>
<nav class="main-nav" aria-label="Main">${NAV.map(navLink).join('')}</nav>
<a class="btn btn-small" href="${SITE.app.track}">Open the app</a>
</div></header>`

const crumbs = (page: Page) => {
  if (page.type === 'home') return ''
  const trail = [
    `<li><a href="/">Home</a></li>`,
    ...page.breadcrumbs.map(slug => `<li><a href="${pageUrl(slug)}">${esc(pageBySlug(slug)!.label)}</a></li>`),
    `<li aria-current="page">${esc(page.label)}</li>`,
  ]
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${trail.join('')}</ol></nav>`
}

const ctaButtons = (page: Page) =>
  page.ctas && page.ctas.length > 0
    ? `<p class="cta-row">${page.ctas.map(cta => `<a class="btn${cta.kind === 'secondary' ? ' btn-ghost' : ''}" href="${esc(cta.href)}">${esc(cta.label)}</a>`).join('')}</p>`
    : ''

const hero = (page: Page) => `<div class="hero">
${crumbs(page)}<h1>${esc(page.h1)}</h1>
<div class="lede">${page.lede}</div>
${ctaButtons(page)}<p class="stamp">Updated <time datetime="${page.updated}">${longDate(page.updated)}</time></p>
</div>`

const sections = (page: Page) =>
  page.sections
    .map(section => `<section class="block" id="${section.id}" aria-labelledby="${section.id}-h"><h2 id="${section.id}-h">${esc(section.heading)}</h2>${section.html}</section>`)
    .join('\n')

const faqBlock = (page: Page) =>
  page.faq.length === 0
    ? ''
    : `<section class="block faq" id="faq-list" aria-labelledby="faq-h"><h2 id="faq-h">${page.type === 'faq' ? 'Questions and answers' : 'Frequently asked questions'}</h2>${page.faq
        .map(entry => `<details><summary>${esc(entry.q)}</summary><div class="answer"><p>${entry.a}</p></div></details>`)
        .join('')}</section>`

const related = (page: Page) =>
  page.related.length === 0
    ? ''
    : `<section class="block related" aria-labelledby="related-h"><h2 id="related-h">Keep reading</h2><ul class="cards">${page.related
        .map(slug => {
          const target = pageBySlug(slug)!
          return `<li><a href="${pageUrl(slug)}"><strong>${esc(target.label)}</strong><span>${esc(target.description)}</span></a></li>`
        })
        .join('')}</ul></section>`

const ctaBand = () => `<section class="cta-band" aria-labelledby="cta-h"><h2 id="cta-h">Count your own chests</h2><p>Free, runs in your browser and nothing is uploaded.</p><p class="cta-row"><a class="btn" href="${SITE.app.track}">Start tracking</a><a class="btn btn-ghost" href="${SITE.app.demo}">Try the demo</a></p></section>`

const footer = () => `<footer class="site-footer"><div class="wrap">
<div class="foot-grid">
<div><p class="foot-brand">${brandMark}<span>${SITE.name}</span></p><p class="foot-note">A free Fortnite chest counter that reads your replay files in your browser.</p></div>
<nav aria-label="Pages"><h2>Guides</h2><ul>${FOOTER_PAGES.map(slug => `<li>${navLink(slug)}</li>`).join('')}</ul></nav>
<nav aria-label="App"><h2>The app</h2><ul><li><a href="${SITE.app.track}">Start tracking</a></li><li><a href="${SITE.app.demo}">Demo</a></li><li><a href="${SITE.repo}" rel="noopener">Source on GitHub</a></li></ul></nav>
</div>
<p class="disclaimer">${SITE.disclaimer}</p>
</div></footer>`

export const renderPage = (page: Page, assets: Assets) => `<!doctype html>
<html lang="en">
<head>
${head(page, assets)}
</head>
<body class="page-${page.type}">
${header()}
<main id="main"><article class="wrap content">
${hero(page)}
${sections(page)}
${faqBlock(page)}
</article>
<div class="wrap">${related(page)}${ctaBand()}</div>
</main>
${footer()}${page.script ? `\n<script>${page.script}</script>` : ''}
${analytics}
</body>
</html>
`

export const renderNotFound = (assets: Assets) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Page not found | ${SITE.name}</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0f1720">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${assets.fonts.display}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${assets.css}">
</head>
<body class="page-404">
${header()}
<main id="main"><div class="wrap content"><div class="hero"><h1>That page does not exist</h1>
<div class="lede"><p>The link may be old or mistyped. These pages do exist.</p></div>
<ul class="cards">${PAGES.map(page => `<li><a href="${pageUrl(page.slug)}"><strong>${esc(page.label)}</strong><span>${esc(page.description)}</span></a></li>`).join('')}</ul>
</div></div></main>
${footer()}
</body>
</html>
`

export const renderSitemap = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(page => `<url><loc>${abs(pageUrl(page.slug))}</loc><lastmod>${page.updated}</lastmod></url>`).join('\n')}
</urlset>
`

export const renderRobots = () => `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`
