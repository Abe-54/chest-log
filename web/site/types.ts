import type { IsoDate } from './config.ts'

/** The path segment after the domain. The empty string is the home page. */
export type Slug = string

export type Faq = { q: string; a: string }

export type Section = { id: string; heading: string; html: string }

export type Cta = { label: string; href: string; kind: 'primary' | 'secondary' }

/** Decides which structured data a page carries. Guides get Article, the rest get WebPage. */
export type PageType = 'home' | 'guide' | 'faq' | 'landing' | 'legal'

export type Page = {
  slug: Slug
  type: PageType
  /** Short name for the breadcrumb and the related-pages card. */
  label: string
  /** The whole <title>. At most 60 characters and it contains the query the page targets. */
  title: string
  /** At most 155 characters. */
  description: string
  h1: string
  /** Opening paragraph, HTML. */
  lede: string
  ctas?: Cta[]
  published: IsoDate
  updated: IsoDate
  /** Slugs of the pages between home and this one. Empty while the site is one level deep. */
  breadcrumbs: Slug[]
  sections: Section[]
  faq: Faq[]
  related: Slug[]
  /** Plain JavaScript for the one page that needs it. */
  script?: string
}
