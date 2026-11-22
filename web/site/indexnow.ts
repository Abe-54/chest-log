import { SITE } from './config.ts'
import { PAGES, pageUrl } from './pages.ts'

/** Tells Bing, Yandex and the other IndexNow engines that every page changed. Run after a production deploy. */
const urlList = PAGES.map(page => SITE.origin + pageUrl(page.slug))
const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE.origin).host, key: SITE.indexNowKey, keyLocation: `${SITE.origin}/${SITE.indexNowKey}.txt`, urlList }),
})
console.log(`IndexNow ${response.status} for ${urlList.length} urls`)
if (!response.ok && response.status !== 202) process.exit(1)
