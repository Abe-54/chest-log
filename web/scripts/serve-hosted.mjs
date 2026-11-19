import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'

// Serves the hosted build the way vercel.json does: static files, and every other path gets index.html.
// (sirv's own single-page mode treats a match id, which has dots in it, as a missing file.)
const port = Number(process.env.PORT ?? 4180)
const app = sirv(fileURLToPath(new URL('../dist-hosted', import.meta.url)), { brotli: true, gzip: true, dev: true })
createServer((req, res) => app(req, res, () => {
  req.url = '/index.html'
  app(req, res, () => { res.statusCode = 404; res.end('Not found') })
})).listen(port, '127.0.0.1', () => console.log(`hosted build on http://127.0.0.1:${port}`))
