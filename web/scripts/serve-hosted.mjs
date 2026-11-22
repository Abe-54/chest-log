import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'

// Serves the hosted build the way the host does: static files from dist-hosted, and every other /app/ path gets
// the app's index.html. (sirv's own single-page mode treats a match id, which has dots in it, as a missing file.)
// The site root is a separate static page and is not part of this build.
const port = Number(process.env.PORT ?? 4180)
const app = sirv(fileURLToPath(new URL('../dist-hosted', import.meta.url)), { brotli: true, gzip: true, dev: true })
const notFound = res => { res.statusCode = 404; res.end('Not found') }
// A missing file under these paths is a real 404, not a page for the app to route.
const isFile = path => /^\/app\/(assets|engine|map)\//.test(path) || /^\/app\/demo\/.*\.json$/.test(path)
createServer((req, res) => app(req, res, () => {
  const { pathname } = new URL(req.url, 'http://host')
  if (!/^\/app(\/|$)/.test(pathname) || isFile(pathname)) return notFound(res)
  req.url = '/app/index.html'
  app(req, res, () => notFound(res))
})).listen(port, '127.0.0.1', () => console.log(`hosted build on http://127.0.0.1:${port}/app/`))
