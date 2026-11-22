// Drives the built hosted app in headless Chromium, with no replays needed: an empty browser lands on Auto-track,
// the demo opens a week and a match replay, the replay reader boots from /app/engine, and a watched folder shows its
// status. Every request must succeed and nothing may log an error.
// Run: npx vite build --mode hosted && node scripts/serve-hosted.mjs & npx tsx scripts/hosted-smoke.ts
// Set CHROME to a Chromium binary when Playwright's own download is not installed.
import { chromium } from 'playwright'

const site = process.env.SITE ?? 'http://127.0.0.1:4180/app'
const shots = process.env.SHOTS
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const problems: string[] = []
page.on('pageerror', error => problems.push(`error ${error}`))
page.on('console', message => { if (message.type() === 'error') problems.push(`console ${message.text()}`) })
page.on('response', response => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`) })

const check = (ok: boolean, label: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) process.exitCode = 1
}
const path = () => new URL(page.url()).pathname
const shot = async (name: string) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }) }

// An empty browser has no library, so every page sends it to Auto-track.
for (const start of ['/', '/import', '/matches']) {
  await page.goto(site + start, { waitUntil: 'networkidle' })
  check(path() === '/app/track', `/app${start === '/' ? '/' : start} lands on /app/track`)
}
check(await page.getByRole('heading', { name: 'Watch your Demos folder' }).isVisible(), 'Auto-track offers the Demos folder')
check(await page.getByRole('heading', { name: 'Add a replay' }).isVisible(), 'Auto-track offers a single replay')
check((await page.locator('code').filter({ hasText: 'FortniteGame' }).innerText()).includes('%LOCALAPPDATA%\\FortniteGame\\Saved\\Demos'), 'it names the Demos folder')
await shot('track')

// The replay reader starts from /app/engine in a worker. A file that is not a replay is read and refused.
await page.locator('input[type=file][accept=".replay"]').setInputFiles({ name: 'not-a-replay.replay', mimeType: 'application/octet-stream', buffer: Buffer.alloc(6000) })
await page.getByText('None of those files held a finished match.').waitFor({ timeout: 120_000 })
check(true, 'the replay reader booted from /app/engine and refused a file that is not a replay')

// A watched folder. The browser's own private file system stands in for the Demos folder: it is a real folder handle.
await page.evaluate(async () => {
  const folder = await navigator.storage.getDirectory()
  const writable = await (await folder.getFileHandle('not-a-replay.replay', { create: true })).createWritable()
  await writable.write(new Uint8Array(6000))
  await writable.close()
  window.showDirectoryPicker = async () => folder
})
await page.getByRole('button', { name: 'Choose Demos folder' }).click()
const status = page.getByRole('status')
await status.getByText(/last checked \d+s ago · 0 new/).waitFor({ timeout: 30_000 })
check(true, `watching shows "${(await status.innerText()).split('\n')[0]}"`)
check(await page.getByRole('button', { name: 'Stop watching' }).isVisible(), 'watching offers a stop button')
await shot('watching')
await page.getByRole('button', { name: 'Stop watching' }).click()
check(await page.getByRole('button', { name: /^Resume/ }).isVisible(), 'stopping leaves a resume button')

// The demo is the same app one level deeper, reading the published library instead of this browser's.
await page.goto(site + '/track', { waitUntil: 'networkidle' })
await page.getByRole('link', { name: 'Try the demo library' }).click()
await page.waitForURL('**/app/demo')
await page.getByText(/chests cracked/).waitFor()
check(path() === '/app/demo', 'the demo opens at /app/demo')
check(await page.getByText('Demo library').isVisible() && (await page.getByRole('link', { name: 'Add your own replays' }).getAttribute('href')) === '/app/track', 'the demo says so and links to /app/track')
check(!(await page.getByRole('link', { name: 'Add replays' }).count()), 'the demo has no way to add replays')
await shot('demo-week')

await page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Matches' }).click()
await page.waitForURL('**/app/demo/matches')
await page.getByRole('heading', { name: 'Matches', exact: true }).waitFor()
const first = page.getByRole('link').filter({ hasText: /with Squadmate/ }).first()
await first.waitFor()
const squads = [...(await page.locator('main').innerText()).matchAll(/with ([^·\n]+)/g)].map(found => found[1].split(', '))
const stray = squads.flat().filter(name => !/^Squadmate \d+$/.test(name.trim()))
check(squads.length > 0 && stray.length === 0, `the matches list names squadmates only as Squadmate N${stray.length ? `; saw ${JSON.stringify(stray.slice(0, 3))}` : ''}`)
await first.click()
await page.waitForURL(/\/app\/demo\/matches\/UnsavedReplay/)
await page.locator('canvas').first().waitFor({ timeout: 30_000 })
await page.waitForTimeout(1500)
check(path().startsWith('/app/demo/matches/'), `a match replay opens inside the demo (${decodeURIComponent(path()).split('/').pop()})`)
await shot('demo-match')

// Deep links work on a cold load, as they do behind the host's rewrite.
const deep = path() + '?t=120'
await page.goto(new URL(deep, site).href, { waitUntil: 'networkidle' })
await page.locator('canvas').first().waitFor({ timeout: 30_000 })
check(page.url().endsWith(deep), 'a match link opens on a cold load')

check(problems.length === 0, `no failed requests or errors${problems.length ? `: ${problems.slice(0, 4).join(' | ')}` : ''}`)
await browser.close()
