import { rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import sirv from 'sirv'
import { faq, site } from './src/seo/content'
import { StaticLanding } from './src/seo/landing'

const media: Plugin = {
  name: 'chest-log-media',
  configureServer(server) {
    server.middlewares.use('/media', sirv(fileURLToPath(new URL('../clips', import.meta.url)), { dev: true }))
  },
}

// public/data holds this PC's own matches. The hosted site ships without it: visitors bring their own replays.
// index.html describes this PC's own site, so the public build replaces its metadata, writes the front page copy
// into the page for search engines and link previews, and adds robots.txt and a sitemap. Vercel provides the
// production host at build time; without it the tags that need an absolute URL are left out.
const hostedSite = (outDir: string): Plugin => {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const origin = host ? `https://${host}` : null
  const out = (file: string) => new URL(`./${outDir}/${file}`, import.meta.url)
  const meta = (key: 'name' | 'property', id: string, content: string): HtmlTagDescriptor =>
    ({ tag: 'meta', attrs: { [key]: id, content }, injectTo: 'head' })
  const text = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  const structured = [
    {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: site.name, description: site.description,
      ...(origin && { url: `${origin}/` }), applicationCategory: 'UtilitiesApplication', operatingSystem: 'Windows',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faq.map(entry => ({ '@type': 'Question', name: entry.question, acceptedAnswer: { '@type': 'Answer', text: entry.answer } })),
    },
  ]
  return {
    name: 'chest-log-hosted',
    apply: 'build',
    transformIndexHtml: html => ({
      html: html
        .replace(/<title>[^<]*<\/title>/, () => `<title>${text(site.title)}</title>`)
        .replaceAll(/\s*<meta (?:name="(?:description|twitter:card)"|property="og:[^"]*") [^>]*>/g, '')
        .replace('<div id="root"></div>', () => `<div id="root">${renderToStaticMarkup(createElement(StaticLanding))}</div>`),
      tags: [
        meta('name', 'description', site.description),
        meta('property', 'og:type', 'website'),
        meta('property', 'og:site_name', site.name),
        meta('property', 'og:title', site.title),
        meta('property', 'og:description', site.description),
        ...(origin ? [
          { tag: 'link', attrs: { rel: 'canonical', href: `${origin}/` }, injectTo: 'head' } as const,
          meta('property', 'og:url', `${origin}/`),
          meta('property', 'og:image', `${origin}/og-hosted.png`),
          meta('property', 'og:image:width', '1200'),
          meta('property', 'og:image:height', '630'),
          meta('name', 'twitter:card', 'summary_large_image'),
        ] : []),
        ...structured.map(data => ({
          tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(data).replaceAll('<', '\\u003c'), injectTo: 'head' as const,
        })),
        // Runs before first paint: see the rule for [data-static-landing] in styles.css.
        { tag: 'script', children: "try{if(localStorage.getItem('chest-log:library'))document.documentElement.dataset.library=''}catch{}", injectTo: 'head-prepend' },
      ],
    }),
    async closeBundle() {
      // Both belong to this PC's own site: its matches and its share image.
      await rm(out('data'), { recursive: true, force: true })
      await rm(out('og.png'), { force: true })
      await writeFile(out('robots.txt'), `User-agent: *\nAllow: /\n${origin ? `\nSitemap: ${origin}/sitemap.xml\n` : ''}`)
      if (origin) {
        await writeFile(out('sitemap.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc></url>\n</urlset>\n`)
      }
    },
  }
}

/** `--mode hosted` builds the public site into dist-hosted; the default build is the local app in dist. */
export default defineConfig(({ mode }) => {
  const hosted = mode === 'hosted'
  const outDir = hosted ? 'dist-hosted' : 'dist'
  return {
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), hosted ? hostedSite(outDir) : media],
    resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { fs: { allow: ['..'] } },
    worker: { format: 'es' },
    build: { target: 'es2023', assetsInlineLimit: 0, outDir },
  }
})
