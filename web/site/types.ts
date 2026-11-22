import type { IsoDate } from './config.ts'

/** The path segment after the domain. The empty string is the home page. */
export type Slug = string

export type Faq = { q: string; a: string }

export type Section = {
  id: string
  heading: string
  html: string
  /** Short caps line above the heading. */
  /** HTML set beside the heading on wide screens. */
  aside?: string
}

/** The home page hero: a one-line promise under the buttons, and a note phones see because replays live on a PC. */
export type Hero = { promise: string; note: string }

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
  hero?: Hero
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
