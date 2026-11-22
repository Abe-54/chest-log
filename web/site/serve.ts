import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '..', process.env.SITE_OUT ?? 'dist-hosted')
const port = Number(process.env.PORT ?? 4181)
const files = sirv(dist, { dev: true })

const APP_SHELL = /^\/app(?:\/(?!assets\/|engine\/|map\/).*)?$/

/** Serves the hosted build the way vercel.json routes it. Only /app falls back to the app shell. Everything else is a file or the 404 page. */
createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://local').pathname
  files(req, res, () => {
    if (APP_SHELL.test(path) && existsSync(join(dist, 'app', 'index.html'))) {
      req.url = '/app/index.html'
      return files(req, res, () => notFound(res))
    }
    notFound(res)
  })
}).listen(port, '127.0.0.1', () => console.log(`site on http://127.0.0.1:${port}`))

function notFound(res: import('node:http').ServerResponse) {
  res.statusCode = 404
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end(readFileSync(join(dist, '404.html')))
}
