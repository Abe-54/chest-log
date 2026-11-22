import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import sirv from 'sirv'

const media: Plugin = {
  name: 'chest-log-media',
  configureServer(server) {
    server.middlewares.use('/media', sirv(fileURLToPath(new URL('../clips', import.meta.url)), { dev: true }))
  },
}

// public/data holds this PC's own matches. The hosted site ships without it: visitors bring their own replays.
const hostedDescription = 'Count the chests you have opened in Fortnite, straight from your replay files. Nothing is uploaded.'

const hostedSite = (outDir: string, base: string): Plugin => ({
  name: 'chest-log-hosted',
  apply: 'build',
  // index.html describes this PC's own site. The public one gets its own description and share image; Vercel
  // provides the production host at build time, and without it the share image tags are dropped.
  transformIndexHtml(html) {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
    const described = html.replaceAll(/(<meta (?:name="description"|property="og:description") content=")[^"]*"/g, `$1${hostedDescription}"`)
    return host
      ? described.replace(/(<meta property="og:image" content=")[^"]*"/, `$1https://${host}${base}og-hosted.png"`)
      : described.replaceAll(/\s*<meta (?:property="og:image[^"]*"|name="twitter:card") [^>]*>/g, '')
  },
  closeBundle: () => rm(new URL(`./${outDir}/data`, import.meta.url), { recursive: true, force: true }),
})

/**
 * `--mode hosted` builds the public app; the default build is the local app in dist. The hosted app is served under
 * /app/ because the site root is a separate static page, so its files go to dist-hosted/app, a folder that mirrors
 * the URL. The static host serves dist-hosted and sends every other /app/ path to /app/index.html.
 */
export default defineConfig(({ mode }) => {
  const hosted = mode === 'hosted'
  const base = hosted ? '/app/' : '/'
  const outDir = hosted ? 'dist-hosted/app' : 'dist'
  return {
    base,
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), hosted ? hostedSite(outDir, base) : media],
    resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { fs: { allow: ['..'] } },
    worker: { format: 'es' },
    build: { target: 'es2023', assetsInlineLimit: 0, outDir },
  }
})
