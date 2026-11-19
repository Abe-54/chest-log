import { chromium } from 'playwright'

const [base = 'http://127.0.0.1:5173', ...paths] = process.argv.slice(2)
const sizes = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, laptop: { width: 1440, height: 900 } }
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
for (const path of paths) {
  for (const [name, size] of Object.entries(sizes)) {
    const { width, height, ...rest } = size
    const context = await browser.newContext({ viewport: { width, height }, ...rest })
    const page = await context.newPage()
    const problems = []
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text().slice(0, 300)) })
    page.on('pageerror', error => problems.push('pageerror: ' + error.message))
    page.on('response', response => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`) })
    await page.goto(base + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const file = `../proto/shots/v2-${path.replace(/[^a-z0-9]+/gi, '_')}-${name}.png`
    await page.screenshot({ path: file, fullPage: name === 'phone' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    console.log(name, path, file, 'overflow', overflow, problems.length ? problems : 'clean')
    await context.close()
  }
}
await browser.close()
