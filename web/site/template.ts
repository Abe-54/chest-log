import { SITE } from './config.ts'
import { esc, longDate, plainText, shortDate } from './html.ts'
import { structuredData } from './jsonld.ts'
import { DEMO, calc, treasure } from './odds.ts'
import { PAGES, pageBySlug, pageUrl, type Cta, type Page } from './pages.ts'

export type Assets = { css: string; preload: string[]; toc: string }

const abs = (path: string) => `${SITE.origin}${path}`

const json = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c')

const THEME_COLOR = '#110b22'

export const logoMark = `<svg class="logo-mark" viewBox="-8 -8 52 52" aria-hidden="true" focusable="false"><rect class="lm-outer" width="36" height="36" rx="8" transform="rotate(45 18 18)"/><rect class="lm-inner" x="12" y="12" width="12" height="12" rx="2" transform="rotate(45 18 18)"/></svg>`

const hamburger = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`

const NAV = [
  { href: '/#how-it-works', text: 'How it works' },
  { href: '/treasure-hunters-odds/', text: 'Token odds' },
  { href: '/faq/', text: 'FAQ' },
] as const

/** Every page is linked from every footer, so no page depends on the home page for internal links. */
const FOOTER = [
  { slug: 'treasure-hunters-odds', text: 'Token odds' },
  { slug: 'fortnite-replay-files', text: 'Replay folder help', short: 'Folder help' },
  { slug: 'treasure-hours', text: 'Treasure Hours' },
  { slug: 'auto-track', text: 'Auto-track' },
  { slug: 'faq', text: 'FAQ' },
  { slug: 'privacy', text: 'Privacy' },
] as const

const analytics = `<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script><script defer src="/_vercel/insights/script.js"></script>`

const preloads = (assets: Assets) =>
  assets.preload.map(href => `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`).join('\n')

const head = (page: Page, assets: Assets) => {
  const url = abs(pageUrl(page.slug))
  const image = abs(SITE.ogImage.path)
  const article = page.type === 'guide'
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow,max-image-preview:large">${SITE.googleVerification ? `
<meta name="google-site-verification" content="${esc(SITE.googleVerification)}">` : ''}
<meta name="theme-color" content="${THEME_COLOR}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${preloads(assets)}
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
<header class="site-header"><div class="bar">
<a class="brand" href="/">${logoMark}<span>${SITE.name}</span></a>
<nav class="main-nav" aria-label="Main">${NAV.map(item => `<a href="${item.href}">${item.text}</a>`).join('')}</nav>
<a class="btn-nav" href="${SITE.app.track}"><span class="wide-only">Count my chests</span><span class="narrow-only">Count</span></a>
<details class="menu"><summary aria-label="Menu">${hamburger}</summary><nav class="menu-panel" aria-label="All pages">${[
  ...NAV.map(item => `<a href="${item.href}">${item.text}</a>`),
  ...FOOTER.filter(item => !NAV.some(nav => nav.href === pageUrl(item.slug))).map(item => `<a href="${pageUrl(item.slug)}">${item.text}</a>`),
  `<a href="${SITE.app.demo}">Try the demo</a>`,
].join('')}</nav></details>
</div></header>`

const footer = () => `<footer class="site-footer"><div class="foot">
<div class="foot-id"><a class="foot-brand" href="/">${SITE.name}</a><p class="disclaimer">${SITE.disclaimer}</p></div>
<nav class="foot-nav" aria-label="Guides">${FOOTER.map(item => `<a href="${pageUrl(item.slug)}">${'short' in item ? `<span class="wide-only">${item.text}</span><span class="narrow-only">${item.short}</span>` : item.text}</a>`).join('')}</nav>
</div></footer>`

const button = (cta: Cta, extra = '') =>
  `<a class="btn${cta.kind === 'secondary' ? ' btn-ghost' : ''}${extra}" href="${esc(cta.href)}">${esc(cta.label)}</a>`

const faqItems = (page: Page) =>
  `<div class="qa-list">${page.faq.map((entry, at) => `<details class="qa"${at === 0 ? ' open' : ''}><summary>${esc(entry.q)}</summary><div class="answer"><p>${entry.a}</p></div></details>`).join('')}</div>`

const faqHeading = (page: Page) => (page.type === 'faq' ? 'Questions and answers' : 'Questions')

/* Home */

const psa = treasure('pirate-shop-access')

export const islandArt = () => {
  const pins: [number, number][] = [[419, 450], [371, 410], [398, 352], [352, 285], [317, 300], [231, 262]]
  return `<div class="hero-art" role="img" aria-label="A drawn island inside the storm circle, with one match's route and the chests opened along it">
<svg viewBox="0 0 660 660" aria-hidden="true" focusable="false">
<circle class="art-orbit" cx="330" cy="330" r="318"/>
<circle class="art-ring" cx="330" cy="330" r="262"/>
<path class="art-island" d="M150 196C188 128 300 116 402 124C482 130 526 176 524 252C522 318 534 380 512 444C488 514 404 540 316 536C226 532 158 506 138 436C122 380 146 340 136 286C128 246 128 222 150 196Z"/>
<path class="art-contour" d="M248 238C276 224 306 240 336 246C362 252 380 266 384 296"/>
<path class="art-contour" d="M196 362C222 344 256 348 270 378"/>
<path class="art-path" d="M360 487L419 450L371 410L398 352L352 285L317 300Q292 262 267 248Q248 244 231 262L175 215"/>
${pins.map(([x, y]) => `<rect class="art-pin" x="-10" y="-10" width="20" height="20" rx="3" transform="translate(${x} ${y}) rotate(45)"/>`).join('')}
<circle class="art-start" cx="360" cy="487" r="10"/>
</svg>
<p class="loot loot-odds"><strong>${calc.formatPercent(calc.chanceAtLeastOne(psa.oneIn, 1, DEMO.chests, 0))}</strong><span><span class="wide-only">Squad's Pirate Shop </span>token odds</span></p>
<p class="loot loot-best"><strong>${DEMO.bestMatch}</strong><span><span class="wide-only">Chests · </span>best match</span></p>
</div>`
}

const homeHeading = (page: Page) => {
  const accent = page.hero?.accent ?? ''
  const lead = accent && page.h1.endsWith(accent) ? page.h1.slice(0, -accent.length) : page.h1
  const leadHtml = esc(lead.trimEnd()).replaceAll(', ', ',<br> ')
  return `<h1>${leadHtml}${accent && lead !== page.h1 ? `<br> <span class="accent">${esc(accent)}</span>` : ''}</h1>`
}

const homeSection = (section: Page['sections'][number]) => {
  const head = `<div class="section-head">${section.eyebrow ? `<p class="eyebrow">${esc(section.eyebrow)}</p>` : ''}<h2 id="${section.id}-h">${esc(section.heading)}</h2>${section.aside ? `<div class="aside">${section.aside}</div>` : ''}</div>`
  const panel = section.eyebrow !== undefined
  return `<section class="home-section" id="${section.id}" aria-labelledby="${section.id}-h">${panel ? `<div class="odds-panel">${head}${section.html}</div>` : section.aside ? `${head}${section.html}` : `<h2 id="${section.id}-h">${esc(section.heading)}</h2>${section.html}`}</section>`
}

const renderHome = (page: Page) => {
  const ctas = page.ctas ?? []
  return `<main id="main">
<section class="hero">
<div class="hero-copy">${page.hero ? `<p class="eyebrow">${esc(page.hero.eyebrow)}</p>` : ''}${homeHeading(page)}
<div class="dek">${page.lede}</div>
<p class="cta-row">${ctas.map(cta => button(cta)).join('')}</p>
${page.hero ? `<p class="hero-note">${esc(page.hero.note)}</p>` : ''}</div>
${islandArt()}
</section>
${page.sections.map(homeSection).join('\n')}
<section class="home-section faq-home" id="faq-list" aria-labelledby="faq-h"><h2 id="faq-h">${faqHeading(page)}</h2>${faqItems(page)}<p class="faq-stamp">Answers updated <time datetime="${page.updated}">${longDate(page.updated)}</time></p></section>
<section class="final-cta" aria-labelledby="cta-h"><h2 id="cta-h">How many did <em>you</em> open?</h2><p class="cta-row">${ctas.map(cta => button(cta, cta.kind === 'secondary' ? ' cta-btn-secondary' : '')).join('')}</p></section>
</main>`
}

/* Articles */

const crumbs = (page: Page) => {
  const trail = [
    `<li><a href="/">Home</a></li>`,
    ...page.breadcrumbs.map(slug => `<li><a href="${pageUrl(slug)}">${esc(pageBySlug(slug)!.label)}</a></li>`),
    `<li aria-current="page">${esc(page.label)}</li>`,
  ]
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${trail.join('')}</ol></nav>`
}

const WORDS_PER_MINUTE = 230

const readMinutes = (page: Page) => {
  const text = plainText([page.lede, ...page.sections.map(section => section.html), ...page.faq.map(entry => entry.a)].join(' '))
  return Math.max(1, Math.round(text.split(' ').length / WORDS_PER_MINUTE))
}

const tocEntries = (page: Page) => [
  ...page.sections.map(section => ({ id: section.id, text: section.heading })),
  ...(page.faq.length > 0 ? [{ id: 'faq-list', text: faqHeading(page) }] : []),
]

const tocList = (page: Page, current: boolean) =>
  `<ol>${tocEntries(page).map((entry, at) => `<li><a href="#${entry.id}"${current && at === 0 ? ' aria-current="true"' : ''}>${esc(entry.text)}</a></li>`).join('')}</ol>`

const tocBar = (page: Page) => {
  const first = tocEntries(page)[0]
  return first ? `<details class="toc-m"><summary><span class="toc-label">On this page</span><span class="toc-cur">${esc(first.text)}</span></summary>${tocList(page, false)}</details>` : ''
}

const tocNav = (page: Page) =>
  tocEntries(page).length === 0 ? '<div></div>' : `<nav class="toc" aria-label="On this page"><p class="toc-label">On this page</p>${tocList(page, true)}</nav>`

const DEFAULT_CTA: Cta = { label: 'Count my chests', href: SITE.app.track, kind: 'primary' }

const ctaCard = (page: Page) => `<aside class="cta-card" aria-labelledby="cta-h"><div><h2 id="cta-h">Get your own number</h2><p>Count your real chests from your replays. Nothing uploaded.</p></div><p class="cta-row">${(page.ctas ?? [DEFAULT_CTA]).map(cta => button(cta, ' btn-inline')).join('')}</p></aside>`

const related = (page: Page) =>
  page.related.length === 0
    ? ''
    : `<section class="related" aria-labelledby="related-h"><h2 id="related-h">Keep reading</h2><ul class="cards">${page.related
        .map(slug => {
          const target = pageBySlug(slug)!
          return `<li><a href="${pageUrl(slug)}"><strong>${esc(target.label)}</strong><span>${esc(target.description)}</span></a></li>`
        })
        .join('')}</ul></section>`

const renderArticle = (page: Page) => `<main id="main">
<header class="art-head"><div class="art-head-in">
${crumbs(page)}<h1>${esc(page.h1)}</h1>
<div class="lede">${page.lede}</div>
<p class="meta">Updated <time datetime="${page.updated}">${shortDate(page.updated)}</time> · ${readMinutes(page)} min read</p>
</div></header>
${tocBar(page)}
<div class="art-body">
${tocNav(page)}
<div class="prose">
${page.sections.map(section => `<section id="${section.id}" aria-labelledby="${section.id}-h"><h2 id="${section.id}-h">${esc(section.heading)}</h2>${section.html}</section>`).join('\n')}
${page.faq.length === 0 ? '' : `<section id="faq-list" aria-labelledby="faq-h"><h2 id="faq-h">${faqHeading(page)}</h2>${faqItems(page)}</section>`}
${ctaCard(page)}
${related(page)}
</div>
</div>
</main>`

export const renderPage = (page: Page, assets: Assets) => {
  const home = page.type === 'home'
  return `<!doctype html>
<html lang="en">
<head>
${head(page, assets)}
</head>
<body class="${home ? 'page-home' : 'page-article'}">
${header()}
${home ? renderHome(page) : renderArticle(page)}
${footer()}${home ? '' : `\n<script defer src="${assets.toc}"></script>`}${page.script ? `\n<script>${page.script}</script>` : ''}
${analytics}
</body>
</html>
`
}

export const renderNotFound = (assets: Assets) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Page not found | ${SITE.name}</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="${THEME_COLOR}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${preloads(assets)}
<link rel="stylesheet" href="${assets.css}">
</head>
<body class="page-404">
${header()}
<main id="main"><header class="art-head"><div class="art-head-in"><h1>That page does not exist</h1>
<div class="lede"><p>The link may be old or mistyped. These pages do exist.</p></div>
<ul class="cards">${PAGES.map(page => `<li><a href="${pageUrl(page.slug)}"><strong>${esc(page.label)}</strong><span>${esc(page.description)}</span></a></li>`).join('')}</ul>
</div></header></main>
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
