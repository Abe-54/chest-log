import type { Page } from '../types.ts'
import { allFaq } from './faq-pool.ts'

export const faq: Page = {
  slug: 'faq',
  type: 'faq',
  label: 'FAQ',
  title: 'Fortnite Chest Counter FAQ: Replays, Odds, Privacy',
  description: 'Answers about the Chest Log Fortnite chest counter: replay files, Pirate token odds, Treasure Hours, privacy and which browsers and platforms work.',
  h1: 'Fortnite chest counter FAQ',
  lede: `<p>Answers about counting chests from Fortnite replays, the Pirate token odds, and what Chest Log does with your files.</p>`,
  published: '2026-11-22',
  updated: '2026-11-22',
  breadcrumbs: [],
  sections: [],
  faq: allFaq(),
  related: ['treasure-hunters-odds', 'fortnite-replay-files', 'treasure-hours', 'auto-track', 'privacy'],
}
