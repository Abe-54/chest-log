// Rehearses a match end to end against a fake Fortnite folder: hold back the newest replay, rebuild without it,
// then feed it in as a live recording followed by the finished file, and watch the home page count it.
// Restores the original data at the end. Usage: node scripts/tracker-rehearsal.mjs <scratch dir>
import { spawn, execFileSync } from 'node:child_process'
import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { compressTree } from './compress.mjs'

const scratch = process.argv[2]
// The real server's tracker would copy the held-back replay straight back from the Demos folder.
const busy = await fetch('http://127.0.0.1:4173/api/live', { signal: AbortSignal.timeout(1000) }).then(() => true, () => false)
if (busy) throw new Error('Stop the Chest Log server on 4173 first; its tracker would race this rehearsal.')
const root = fileURLToPath(new URL('../../', import.meta.url))
const web = fileURLToPath(new URL('../', import.meta.url))
const replays = join(root, 'replays')
const fake = join(scratch, 'appdata')
const demos = join(fake, 'FortniteGame', 'Saved', 'Demos')
const shots = join(root, 'proto', 'shots')
const port = 4175
const started = Date.now()
const log = (...parts) => console.log(`${((Date.now() - started) / 1000).toFixed(1)}s`, ...parts)
const week = async () => JSON.parse(await readFile(join(root, 'data', 'index.json'), 'utf8')).week

const original = await week()
const name = (await readdir(replays)).filter(file => file.endsWith('.replay')).sort().at(-1)
const held = join(scratch, name)
await rm(fake, { recursive: true, force: true })
await mkdir(demos, { recursive: true })
await cp(join(root, 'data'), join(scratch, 'data-backup'), { recursive: true })
await rename(join(replays, name), held)
log('held back', name)

const rebuild = async () => {
  execFileSync(join(root, 'extractor', 'bin', 'Release', 'net10.0', 'Extractor.exe'), [replays, join(root, 'data')], { env: { ...process.env, DOTNET_ROOT: join(root, 'tools', 'dotnet') }, stdio: 'ignore' })
  execFileSync(process.execPath, ['--import', 'tsx', 'pipeline/build-data.ts'], { cwd: web, stdio: 'ignore' })
  await cp(join(web, 'public', 'data'), join(web, 'dist', 'data'), { recursive: true, force: true })
  await compressTree(join(web, 'dist', 'data'))
}
let server
let browser
try {
  await rebuild()
  log('rebuilt without it, total', (await week()).ownerChests)

  server = spawn(process.execPath, ['server.mjs'], { cwd: web, env: { ...process.env, PORT: String(port), LOCALAPPDATA: fake }, stdio: 'inherit' })
  await new Promise(resolve => setTimeout(resolve, 1500))
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' })
  const hero = page.locator('h1 span').first()
  const line = page.locator('[role=status]').first()
  await line.waitFor()
  log('before', await hero.textContent(), '|', await line.textContent())

  const bytes = await readFile(held)
  const live = Buffer.from(bytes.subarray(0, Math.floor(bytes.length / 3)))
  live.writeUInt32LE(1, 48 + -live.readInt32LE(44) * 2)
  await writeFile(join(demos, name), live)
  await page.getByText('In a match,').waitFor({ timeout: 20000 })
  log('recording', await line.textContent())
  await page.screenshot({ path: join(shots, 'live-recording-phone.png') })

  await writeFile(join(demos, name), bytes)
  await page.getByText('Counting your chests').waitFor({ timeout: 30000 })
  log('counting')
  await page.screenshot({ path: join(shots, 'live-counting-phone.png') })
  await page.getByText(/Match\s*counted/).waitFor({ timeout: 180000 })
  log('celebration', await page.getByText(/Match\s*counted/).locator('..').textContent())
  await page.waitForTimeout(4500)
  log('after', await hero.textContent(), '|', await line.textContent())
  await page.screenshot({ path: join(shots, 'live-counted-phone.png') })
  // The total comes from the replay alone; the full rebuild lands after it and must finish before teardown.
  const deadline = Date.now() + 180000
  while (JSON.stringify(await week()) !== JSON.stringify(original) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 2000))
  log('full rebuild landed')
  const restored = await week()
  log('archive has it again', (await readdir(replays)).includes(name), '| totals match original', JSON.stringify(restored) === JSON.stringify(original))
  log('page errors', errors.length ? errors : 'none')
} finally {
  await browser?.close()
  server?.kill()
  if (!(await readdir(replays)).includes(name)) {
    await rename(held, join(replays, name))
    await rebuild()
    log('restored after failure')
  }
}
