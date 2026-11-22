import { SITE } from './config.ts'
import { plainText } from './html.ts'
import { pageBySlug, pageUrl, type Page } from './pages.ts'

const abs = (path: string) => `${SITE.origin}${path}`
const ORG_ID = abs('/#organization')
const SITE_ID = abs('/#website')
const APP_ID = abs('/#app')

const organization = () => ({
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE.name,
  url: abs('/'),
  logo: { '@type': 'ImageObject', url: abs(SITE.logoPath), width: 512, height: 512 },
  sameAs: [SITE.repo],
})

const website = (page: Page) => ({
  '@type': 'WebSite',
  '@id': SITE_ID,
  url: abs('/'),
  name: SITE.name,
  description: page.description,
  inLanguage: 'en-US',
  publisher: { '@id': ORG_ID },
})

const application = (page: Page) => ({
  '@type': 'WebApplication',
  '@id': APP_ID,
  name: SITE.name,
  url: abs(SITE.app.home),
  description: page.description,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires a current browser. Chrome or Edge for folder auto tracking.',
  isAccessibleForFree: true,
  image: abs(SITE.ogImage.path),
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@id': ORG_ID },
})

const breadcrumb = (page: Page) => {
  const trail = [
    { name: 'Home', url: abs('/') },
    ...page.breadcrumbs.map(slug => ({ name: pageBySlug(slug)!.label, url: abs(pageUrl(slug)) })),
    { name: page.label, url: abs(pageUrl(page.slug)) },
  ]
  return {
    '@type': 'BreadcrumbList',
    '@id': `${abs(pageUrl(page.slug))}#breadcrumb`,
    itemListElement: trail.map((entry, at) => ({ '@type': 'ListItem', position: at + 1, name: entry.name, item: entry.url })),
  }
}

const faqNode = (page: Page, main: boolean) => ({
  '@type': 'FAQPage',
  '@id': `${abs(pageUrl(page.slug))}#faq`,
  url: abs(pageUrl(page.slug)),
  ...(main ? { name: page.title, description: page.description, inLanguage: 'en-US', isPartOf: { '@id': SITE_ID } } : {}),
  mainEntity: page.faq.map(entry => ({
    '@type': 'Question',
    name: entry.q,
    acceptedAnswer: { '@type': 'Answer', text: plainText(entry.a) },
  })),
})

const article = (page: Page) => ({
  '@type': 'Article',
  '@id': `${abs(pageUrl(page.slug))}#article`,
  url: abs(pageUrl(page.slug)),
  headline: page.h1,
  description: page.description,
  datePublished: page.published,
  dateModified: page.updated,
  inLanguage: 'en-US',
  image: [abs(SITE.ogImage.path)],
  author: { '@id': ORG_ID },
  publisher: { '@id': ORG_ID },
  isPartOf: { '@id': SITE_ID },
  mainEntityOfPage: abs(pageUrl(page.slug)),
})

const webPage = (page: Page) => ({
  '@type': 'WebPage',
  '@id': `${abs(pageUrl(page.slug))}#webpage`,
  url: abs(pageUrl(page.slug)),
  name: page.title,
  description: page.description,
  dateModified: page.updated,
  inLanguage: 'en-US',
  isPartOf: { '@id': SITE_ID },
})

/** One @graph per page. Home adds the site, the organization and the app. Every other page adds a breadcrumb trail. */
export const structuredData = (page: Page) => {
  const nodes: object[] = []
  if (page.type === 'home') nodes.push(website(page), organization(), application(page), webPage(page))
  else {
    nodes.push(breadcrumb(page))
    if (page.type === 'guide') nodes.push(article(page))
    else if (page.type === 'faq') nodes.push(faqNode(page, true))
    else nodes.push(webPage(page))
  }
  if (page.faq.length > 0 && page.type !== 'faq') nodes.push(faqNode(page, false))
  return { '@context': 'https://schema.org', '@graph': nodes }
}
