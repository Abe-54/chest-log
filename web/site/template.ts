import { SITE } from './config.ts'
import { esc, longDate, plainText, shortDate } from './html.ts'
import { structuredData } from './jsonld.ts'
import { mapHero, mapHeroScript } from './map-hero.ts'
import { PAGES, pageBySlug, pageUrl, type Cta, type Page } from './pages.ts'

export type Assets = { css: string; preload: string[]; toc: string; map: { small: string; large: string } }

const abs = (path: string) => `${SITE.origin}${path}`

const json = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c')

const THEME_COLOR = '#0d4f94'

export const logoMark = `<svg class="logo-mark" viewBox="-8 -8 52 52" aria-hidden="true" focusable="false"><rect class="lm-outer" width="36" height="36" rx="8" transform="rotate(45 18 18)"/><rect class="lm-inner" x="12" y="12" width="12" height="12" rx="2" transform="rotate(45 18 18)"/></svg>`

const hamburger = `<svg class="menu-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path class="menu-open" d="M3 6h18M3 12h18M3 18h18"/><path class="menu-close" d="M5 5l14 14M19 5L5 19"/></svg>`

/** Closes the menu on Escape or an outside tap; hands the page to a PC from a phone by sharing or copying its link. */
const menuScript = `<script>(function(){var url=location.origin+location.pathname;var toast=document.querySelector('[data-toast]');
function say(text,long){toast.textContent=text;toast.classList.add('is-on');clearTimeout(say.t);say.t=setTimeout(function(){toast.classList.remove('is-on')},long?8000:2600)}
document.querySelectorAll('[data-send-to-pc]').forEach(function(b){b.addEventListener('click',function(){var data={title:'Chest Log',text:'Count my Fortnite chests on PC',url:url};
if(navigator.share){navigator.share(data).catch(function(){})}else if(navigator.clipboard){navigator.clipboard.writeText(url).then(function(){say('Link copied. Open it on your PC.')},function(){say(url,1)})}else{say(url,1)}})});
function shut(m,focus){m.removeAttribute('open');if(focus)m.querySelector('summary').focus()}document.addEventListener('touchstart',function(){},{passive:true});document.addEventListener('click',function(e){var m=document.querySelector('details.menu[open]');if(m&&(!m.contains(e.target)||e.target.closest('.menu-panel a')))shut(m,false)});document.addEventListener('keydown',function(e){var m=document.querySelector('details.menu[open]');if(m&&e.key==='Escape')shut(m,true)})})()</script>`

const NAV = [
  { href: '/#how-it-works', text: 'How it works' },
  { href: '/treasure-hunters-odds/', text: 'Token odds' },
  { href: '/faq/', text: 'FAQ' },
] as const

/** Every page is linked from every footer, so no page depends on the home page for internal links. */
const FOOTER = [
  { slug: 'treasure-hunters-odds', text: 'Token odds' },
  { slug: 'fortnite-replay-files', text: 'Replay files', short: 'Replay files' },
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
<script>document.documentElement.classList.add('js')</script>
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
<a class="btn-nav on-pc" href="${SITE.app.track}">Count my chests</a><a class="btn-nav on-touch" href="${SITE.app.demo}">Try the demo</a>
<details class="menu"><summary aria-label="Menu">${hamburger}</summary><nav class="menu-panel" aria-label="All pages">${[
  ...NAV.map(item => `<a href="${item.href}">${item.text}</a>`),
  ...FOOTER.filter(item => !NAV.some(nav => nav.href === pageUrl(item.slug))).map(item => `<a href="${pageUrl(item.slug)}">${item.text}</a>`),
  `<a href="${SITE.app.demo}">Try the demo</a>`,
].join('')}</nav></details>
</div></header>`

const footer = () => `<p class="toast" data-toast role="status" aria-live="polite"></p>
<footer class="site-footer"><div class="foot">
<div class="foot-id"><a class="foot-brand" href="/">${SITE.name}</a><p class="disclaimer">${SITE.disclaimer}</p></div>
<nav class="foot-nav" aria-label="Guides">${FOOTER.map(item => `<a href="${pageUrl(item.slug)}">${'short' in item ? `<span class="wide-only">${item.text}</span><span class="narrow-only">${item.short}</span>` : item.text}</a>`).join('')}</nav>
</div></footer>`

const button = (cta: Cta, extra = '') =>
  `<a class="btn${cta.kind === 'secondary' ? ' btn-ghost' : ''}${extra}" href="${esc(cta.href)}">${esc(cta.label)}</a>`

/** A shared answer that ends by pointing at the page it already sits on drops that closing sentence. */
const withoutSelfLink = (answer: string, page: Page) => {
  const self = `<a href="${pageUrl(page.slug)}">`
  const at = answer.lastIndexOf(self)
  if (at < 0) return answer
  const start = answer.lastIndexOf('. ', at)
  return start < 0 ? answer : answer.slice(0, start + 1)
}

const faqItems = (page: Page) =>
  `<div class="qa-list">${page.faq.map((entry, at) => `<details class="qa"${at === 0 ? ' open' : ''}><summary>${esc(entry.q)}</summary><div class="answer"><p>${withoutSelfLink(entry.a, page)}</p></div></details>`).join('')}</div>`

const faqHeading = (page: Page) => (page.type === 'faq' ? 'Questions and answers' : 'Questions')

/* Home */

const homeSection = (section: Page['sections'][number]) => {
  const head = `<div class="section-head"><h2 id="${section.id}-h">${esc(section.heading)}</h2>${section.aside ? `<div class="aside">${section.aside}</div>` : ''}</div>`
  return `<section class="home-section" id="${section.id}" aria-labelledby="${section.id}-h"><div class="wrap">${head}${section.html}</div></section>`
}

/**
 * PC visitors get the counter first. Phones and tablets cannot reach a replay folder, so the demo leads there,
 * and the second action hands the page to their PC instead of opening an app that cannot run on the phone.
 */
const homeCtas = (extra = '') => `<p class="cta-row on-pc">${button({ label: 'Count my chests', href: SITE.app.track, kind: 'primary' })}${button({ label: 'Try the demo', href: SITE.app.demo, kind: 'secondary' }, extra)}</p><p class="cta-row on-touch">${button({ label: 'Try the demo', href: SITE.app.demo, kind: 'primary' })}<button type="button" class="btn btn-ghost${extra}" data-send-to-pc>Send this to my PC</button></p>`

/** Shares the page link on phones (or copies it), and keeps the header button out of the way while the hero's own buttons are on screen. */
/** Keeps the header button out of the way while the hero's own buttons are on screen. */
const homeScript = `(function(){if(!('IntersectionObserver' in window)){document.body.classList.add('hero-cta-off');return}
var rows=document.querySelectorAll('.hero-copy .cta-row'),seen=new Map();
var io=new IntersectionObserver(function(es){es.forEach(function(e){seen.set(e.target,e.isIntersecting)});document.body.classList.toggle('hero-cta-off',!Array.from(seen.values()).some(Boolean))});rows.forEach(function(r){io.observe(r)})})()`

const renderHome = (page: Page, assets: Assets) => `<main id="main">
<section class="hero">
<div class="hero-copy">
<h1>${esc(page.h1)}</h1>
<div class="dek">${page.lede}</div>
${homeCtas()}
${page.hero ? `<p class="hero-promise on-pc">${esc(page.hero.promise)}</p><p class="hero-note on-touch">${esc(page.hero.note)}</p>` : ''}</div>
${mapHero(assets.map)}
</section>
${page.sections.map(homeSection).join('\n')}
<section class="home-section faq-home" id="faq-list" aria-labelledby="faq-h"><div class="wrap"><h2 id="faq-h">${faqHeading(page)}</h2>${faqItems(page)}<p class="faq-stamp">Answers updated <time datetime="${page.updated}">${longDate(page.updated)}</time>. <a href="/faq/">All questions</a></p></div></section>
<section class="final-cta" aria-labelledby="cta-h"><div class="final-map" aria-hidden="true" style="background-image:url(${assets.map.small})"></div><div class="wrap"><h2 id="cta-h"><span class="on-pc">How many chests did your squad open this week?</span><span class="on-touch">See a real squad's week in the demo</span></h2>${homeCtas(' cta-btn-secondary')}</div></section>
</main>`

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
const DEMO_CTA: Cta = { label: 'Try the demo', href: SITE.app.demo, kind: 'secondary' }

/** Like the home page, phones get the demo and a way to send the page to their PC, never a tracker they cannot run. */
const ctaCard = (page: Page) => `<aside class="cta-card" aria-labelledby="cta-h"><div><h2 id="cta-h">Count your own chests</h2><p class="on-pc">Free, nothing uploaded, and every match back on the map.</p><p class="on-touch">Counting needs the replay files on your Windows PC. Send this page there, or see a real squad's week in the demo.</p></div><p class="cta-row on-pc">${[page.ctas?.[0] ?? DEFAULT_CTA, DEMO_CTA].map(cta => button(cta, ' btn-inline')).join('')}</p><p class="cta-row on-touch">${button({ label: 'Try the demo', href: SITE.app.demo, kind: 'primary' }, ' btn-inline')}<button type="button" class="btn btn-ghost btn-inline" data-send-to-pc>Send this to my PC</button></p></aside>`

const related = (page: Page) =>
  page.related.length === 0
    ? ''
    : `<section class="related" aria-labelledby="related-h"><h2 id="related-h">Keep reading</h2><ul class="cards">${page.related
        .map(slug => {
          const target = pageBySlug(slug)!
          return `<li><a href="${pageUrl(slug)}"><strong>${esc(target.label)}</strong><span>${esc(target.description)}</span></a></li>`
        })
        .join('')}</ul></section>`

/** A contents list earns its column only when there are at least three places to jump to. */
const MIN_TOC = 3

const renderArticle = (page: Page, assets: Assets) => {
  const toc = tocEntries(page).length >= MIN_TOC
  return `<main id="main"${toc ? '' : ' class="no-toc"'}>
<header class="art-head"><div class="art-map" aria-hidden="true" style="background-image:url(${assets.map.small})"></div><div class="art-head-in">
${crumbs(page)}<h1>${esc(page.h1)}</h1>
<div class="lede">${page.lede}</div>
<p class="meta"><span>Updated <time datetime="${page.updated}">${shortDate(page.updated)}</time></span><span>${readMinutes(page)} min read</span></p>
</div></header>
${toc ? tocBar(page) : ''}
<div class="art-body">
${toc ? tocNav(page) : ''}
<div class="prose">
${page.sections.map(section => `<section id="${section.id}" aria-labelledby="${section.id}-h"><h2 id="${section.id}-h">${esc(section.heading)}</h2>${section.html}</section>`).join('\n')}
${page.faq.length === 0 ? '' : `<section id="faq-list" aria-labelledby="faq-h"><h2 id="faq-h">${faqHeading(page)}</h2>${faqItems(page)}</section>`}
${ctaCard(page)}
${related(page)}
</div>
</div>
</main>`
}

export const renderPage = (page: Page, assets: Assets) => {
  const home = page.type === 'home'
  return `<!doctype html>
<html lang="en">
<head>
${head(page, assets)}
</head>
<body class="${home ? 'page-home' : 'page-article'}">
${header()}
${home ? renderHome(page, assets) : renderArticle(page, assets)}
${footer()}
${menuScript}${home ? `\n<script>${mapHeroScript}</script>\n<script>${homeScript}</script>` : `\n<script defer src="${assets.toc}"></script>`}${page.script ? `\n<script>${page.script}</script>` : ''}
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
