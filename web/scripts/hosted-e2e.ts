// End-to-end check of the hosted build: a visitor with an empty browser imports this PC's replays, and the library
// the browser builds must equal what the local pipeline builds from the console extractor's output.
// Run: npx vite build --mode hosted && node scripts/serve-hosted.mjs & npx tsx scripts/hosted-e2e.ts
import { readdir, readFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { chromium } from 'playwright'
import type { ReplayIndex, ReplayMatch } from '../../data/types'
import type { Calibration } from '../pipeline/domain/model'
import { buildDataset } from '../pipeline/dataset'

const root = new URL('../../', import.meta.url)
const site = process.env.SITE ?? 'http://127.0.0.1:4180'
const shots = process.env.SHOTS
const load = async <T>(path: string) => JSON.parse(await readFile(new URL(path, root), 'utf8')) as T

const replayDir = new URL('replays/', root)
const files = (await readdir(replayDir)).filter(name => name.endsWith('.replay')).slice(0, Number(process.env.LIMIT ?? Infinity))
const full = !process.env.LIMIT

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors: string[] = []
page.on('pageerror', error => errors.push(String(error)))
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })

const check = (ok: boolean, label: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) process.exitCode = 1
}

async function importAll() {
  const started = Date.now()
  await page.locator('input[type=file][accept=".replay"]').setInputFiles(files.map(name => new URL(name, replayDir).pathname.slice(1)))
  await page.waitForURL(site + '/', { timeout: 15 * 60 * 1000 })
  await page.getByText(/chests cracked in/).waitFor()
  return (Date.now() - started) / 1000
}

await page.goto(site + '/matches', { waitUntil: 'networkidle' })
check(page.url() === site + '/import', 'an empty browser lands on the import screen')
console.log(`first import of ${files.length} replays took ${(await importAll()).toFixed(1)} s`)
if (shots) await page.screenshot({ path: `${shots}/hosted-celebrate.png` })

// Passed as text: tsx wraps named functions in a helper that does not exist inside the page.
const readLibrary = `(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('chest-log')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const get = (store, key) => new Promise((resolve, reject) => {
    const objects = db.transaction(store).objectStore(store)
    const request = key ? objects.get(key) : objects.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const library = { week: await get('kv', 'week'), meta: await get('kv', 'meta'), matches: await get('matches') }
  db.close()
  return library
})()`
type Library = { week: { generatedAt: string; total: number }; meta: { failed: unknown[] }; matches: { id: string }[] }
const stored = await page.evaluate(readLibrary) as Library

if (full) {
  const [index, calibration] = await Promise.all([
    load<ReplayIndex>('data/index.json'), load<Calibration>('map/calibration.json'),
  ])
  const replays = await Promise.all(index.matches.filter(row => !row.error).map(row => load<ReplayMatch>(`data/matches/${row.id}.json`)))
  const expected = buildDataset({ index, calibration, replays, generatedAt: stored.week.generatedAt })
  const plain = (value: unknown) => JSON.parse(JSON.stringify(value))
  check(isDeepStrictEqual(stored.week, plain(expected.week)), `week equals the local pipeline (${stored.week.total} chests)`)
  const byId = new Map(stored.matches.map(match => [match.id, match]))
  const different = expected.matches.filter(match => !isDeepStrictEqual(byId.get(match.id), plain(match))).map(match => match.id)
  check(different.length === 0 && stored.matches.length === expected.matches.length,
    `${stored.matches.length} of ${expected.matches.length} matches equal the local pipeline${different.length ? `; differ: ${different.slice(0, 3).join(', ')}` : ''}`)
}
check(stored.meta.failed.length === 0, 'no replay failed to parse')

await page.waitForTimeout(4500)
if (shots) await page.screenshot({ path: `${shots}/hosted-home.png` })
for (const path of ['/matches', `/matches/${stored.matches.at(-1)!.id}`]) {
  await page.goto(site + path, { waitUntil: 'networkidle' })
  check(page.url() === site + path && (await page.locator('#root').innerText()).trim().length > 0, `${path} opens`)
  if (shots) await page.screenshot({ path: `${shots}/hosted${path.replace(/\/matches\/.+/, '/match').replaceAll('/', '-')}.png` })
}

await page.goto(site + '/import', { waitUntil: 'networkidle' })
if (shots) await page.screenshot({ path: `${shots}/hosted-add.png`, fullPage: true })
const again = await importAll()
const after = (await page.evaluate(readLibrary) as Library).week.total
check(after === stored.week.total, `importing the same files again changes nothing (${after} chests) and took ${again.toFixed(1)} s`)

await page.reload({ waitUntil: 'networkidle' })
check(await page.getByText(/chests cracked in/).isVisible(), 'the library survives a reload')
check(errors.length === 0, `no page errors or failed requests${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`)
await browser.close()
