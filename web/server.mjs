import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'
import { join } from 'node:path'
import { createTracker } from './live/tracker.mjs'

const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? '127.0.0.1'
const hashed = /^\/assets\//
const mediaFile = /^\/media\/(?:web\/[\w.-]+\.mp4|posters\/[\w.-]+\.jpg)$/
const app = sirv(fileURLToPath(new URL('./dist', import.meta.url)), {
  brotli: true,
  gzip: true,
  etag: true,
  setHeaders(res, pathname) {
    if (hashed.test(pathname)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    else res.setHeader('Cache-Control', 'no-cache')
  },
})
// dev mode stats files per request, so matches the tracker adds are served without a restart.
const data = sirv(fileURLToPath(new URL('./dist/data', import.meta.url)), {
  dev: true,
  brotli: true,
  gzip: true,
  etag: true,
  setHeaders: res => res.setHeader('Cache-Control', 'no-cache'),
})
const media = sirv(fileURLToPath(new URL('../clips', import.meta.url)), {
  etag: true,
  setHeaders: res => res.setHeader('Cache-Control', 'public, max-age=86400'),
})

const listeners = new Set()
const message = state => `event: status\ndata: ${JSON.stringify(state)}\n\n`
const tracker = process.env.CHEST_TRACKER === 'off'
  ? { snapshot: () => ({ phase: 'off' }) }
  : await createTracker({
    demos: join(process.env.LOCALAPPDATA ?? '', 'FortniteGame', 'Saved', 'Demos'),
    onChange: state => {
      for (const res of listeners) res.write(message(state))
    },
  })
setInterval(() => { for (const res of listeners) res.write(': keep-alive\n\n') }, 25_000).unref()

function live(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' })
  res.write('retry: 5000\n' + message(tracker.snapshot()))
  listeners.add(res)
  req.on('close', () => listeners.delete(res))
}

function supportedRange(header) {
  const match = /^bytes=(\d+)-(\d*)$/.exec(header)
  return !!match && (match[2] === '' || Number(match[1]) <= Number(match[2]))
}

function handle(req, res) {
  const notFound = () => { res.statusCode = 404; res.end('Not found') }
  if (req.headers.range !== undefined && !supportedRange(req.headers.range)) delete req.headers.range
  const path = (req.url ?? '/').split('?')[0]
  if (path.startsWith('/media/')) {
    if (!mediaFile.test(path)) return notFound()
    req.url = req.url.slice('/media'.length)
    return media(req, res, notFound)
  }
  if (path === '/api/live') return live(req, res)
  if (path.startsWith('/data/')) {
    req.url = req.url.slice('/data'.length)
    return data(req, res, notFound)
  }
  if (path.startsWith('/assets/')) return app(req, res, notFound)
  app(req, res, () => {
    req.url = '/index.html'
    app(req, res, notFound)
  })
}

createServer((req, res) => {
  try {
    handle(req, res)
  } catch (error) {
    console.error(error)
    if (!res.headersSent) res.statusCode = 500
    res.end()
  }
}).listen(port, host, () => console.log(`Chest Log on http://${host}:${port}`))
