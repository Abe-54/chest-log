// Share images. Local app: node scripts/og.mjs [base]. Public site, from an empty browser against the hosted
// build: node scripts/og.mjs http://127.0.0.1:4180 hosted
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://127.0.0.1:5173'
const hosted = process.argv[3] === 'hosted'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
if (hosted) {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: 'header { display: none }' })
  await page.screenshot({ path: 'public/og-hosted.png' })
} else {
  await page.goto(`${base}/wrapped?s=total`, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: '[role=tablist], [aria-label="Share this slide"], [aria-label="Close Wrapped"] { visibility: hidden }' })
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(1600)
  await page.screenshot({ path: 'public/og.png' })
}
await browser.close()
