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

// An empty browser has no library, so every page sends it to the page that adds matches.
for (const start of ['/', '/import', '/matches']) {
  await page.goto(site + start, { waitUntil: 'networkidle' })
  check(path() === '/app/track', `/app${start === '/' ? '/' : start} lands on /app/track`)
}
check(await page.getByRole('heading', { name: 'Pick your Demos folder' }).isVisible(), 'the add page offers the Demos folder')
check(await page.getByRole('heading', { name: 'Or drop it here' }).isVisible(), 'the add page offers a single replay')
check((await page.locator('code').filter({ hasText: 'FortniteGame' }).first().innerText()).includes('%LOCALAPPDATA%\\FortniteGame\\Saved\\Demos'), 'it names the Demos folder')
await shot('track')

// The replay reader starts from /app/engine in a worker. A file that is not a replay is read and refused.
await page.locator('input[type=file][accept=".replay"]').setInputFiles({ name: 'not-a-replay.replay', mimeType: 'application/octet-stream', buffer: Buffer.alloc(6000) })
await page.getByText('None of those files held a finished match.').waitFor({ timeout: 120_000 })
check(true, 'the replay reader booted from /app/engine and refused a file that is not a replay')

// The Demos folder goes through the plain folder picker, the one Chrome lets open AppData. Choosing it opens that input.
const chooser = page.waitForEvent('filechooser')
await page.getByRole('button', { name: 'Choose Demos folder' }).click()
check((await chooser).isMultiple() && (await page.locator('input[type=file][webkitdirectory]').count()) === 1, 'Choose Demos folder opens the folder picker')

// The demo is the same app one level deeper, reading the published library instead of this browser's.
await page.goto(site + '/track', { waitUntil: 'networkidle' })
await page.getByRole('link', { name: 'Try the demo library' }).click()
await page.waitForURL('**/app/demo')
await page.getByRole('heading', { level: 1, name: /Chests$/ }).waitFor()
check(path() === '/app/demo', 'the demo opens at /app/demo')
check(await page.getByText('Demo library').isVisible() && (await page.getByRole('link', { name: 'Add your own replays' }).getAttribute('href')) === '/app/track', 'the demo says so and links to /app/track')
check(!(await page.getByRole('link', { name: 'Add replays' }).count()), 'the demo has no way to add replays')
await shot('demo-week')

await page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Matches', exact: true }).click()
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
