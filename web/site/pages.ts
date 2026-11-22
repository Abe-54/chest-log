import type { Page, Slug } from './types.ts'
import { home } from './content/home.ts'
import { faq } from './content/faq.ts'
import { oddsPage } from './content/odds-page.ts'
import { replays } from './content/replays.ts'
import { hours } from './content/hours.ts'
import { autoTrack } from './content/auto-track.ts'
import { privacy } from './content/privacy.ts'

export type { Page, Section, Faq, Cta, PageType, Slug } from './types.ts'

export const PAGES: readonly Page[] = [home, faq, oddsPage, replays, hours, autoTrack, privacy]

export const pageUrl = (slug: Slug) => (slug === '' ? '/' : `/${slug}/`)

export const pageBySlug = (slug: Slug) => PAGES.find(page => page.slug === slug)
