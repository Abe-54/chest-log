import { SITE } from '../config.ts'
import type { Page } from '../types.ts'
import { ALL_TREASURES, boostedOneIn, calc, oneInText, treasure, type Treasure } from '../odds.ts'
import { cite, esc, link, sourceLink, table } from '../html.ts'
import { pick } from './faq-pool.ts'

const psa = treasure('pirate-shop-access')
const gold = treasure('weekly-gold-outfit')
const vehicle = treasure('weekly-vehicle-decal')
const boosted: Treasure[] = ALL_TREASURES.filter(entry => entry.hoursBoost !== undefined)
const chests = 10_000
const at = (entry: Treasure, hours: boolean) => calc.formatPercent(calc.chanceAtLeastOne(entry.oneIn, entry.hoursBoost ?? 1, hours ? 0 : chests, hours ? chests : 0))

export const hours: Page = {
  slug: 'treasure-hours',
  type: 'guide',
  label: 'Treasure Hours',
  title: 'Fortnite Treasure Hours Explained: Boosted Chest Odds',
  description: `What Fortnite Treasure Hours are. Epic lists boosts of ${psa.hoursBoost}x for Pirate Shop Access, ${gold.hoursBoost}x for the Gold Outfit and ${vehicle.hoursBoost}x for Vehicle & Decal.`,
  h1: 'What Fortnite Treasure Hours are and how they change your odds',
  lede: `<p>Treasure Hours are Epic's scheduled windows with boosted treasure drops. This page lists the boosts Epic published, what they do to your odds, and where Epic announces each one.</p>`,
  ctas: [{ label: 'Open the odds calculator', href: '/treasure-hunters-odds/', kind: 'primary' }],
  published: '2026-11-22',
  updated: '2026-11-22',
  breadcrumbs: [],
  sections: [
    {
      id: 'what',
      heading: 'What Treasure Hours are',
      html: `<p>Epic says Mastery Mondays and Treasure Hours Saturdays run throughout the Treasure Hunters season. They add things like a captain's weapon at the start of every match and boosted drops. Epic's drop rate article says chest treasure rates stay constant, apart from during Treasure Hours.</p>${cite('epic-season', 'epic-drop-rates')}`,
    },
    {
      id: 'boosts',
      heading: 'The boosts Epic lists',
      html: `${table({
        caption: 'Treasure Hours boosts from the drop rate article',
        head: ['Reward', 'Normal odds per chest', 'Boost', 'Odds per chest in Treasure Hours'],
        numeric: [1, 2, 3],
        rows: boosted.map(entry => [esc(entry.name), oneInText(entry), `${entry.hoursBoost}x`, `about 1 in ${calc.formatCount(boostedOneIn(entry))}`]),
      })}<p>Epic adds that these rates may be higher in future Treasure Hours. The last column is our arithmetic, and it reads the boost as a multiplier on the chance for each chest. Epic does not publish the formula.</p>${cite('epic-drop-rates')}`,
    },
    {
      id: 'effect',
      heading: 'What a boost does to your chance',
      html: `<p>A boost raises the chance on each chest. It does not guarantee a reward. Here is the chance of finding each boosted reward at least once, if you open ${calc.formatCount(chests)} chests in normal matches or during Treasure Hours.</p>${table({
        caption: `Chance of at least one reward after ${calc.formatCount(chests)} chests`,
        head: ['Reward', 'Normal matches', 'Treasure Hours'],
        numeric: [1, 2],
        rows: boosted.map(entry => [esc(entry.name), at(entry, false), at(entry, true)]),
      })}<p>${link('/treasure-hunters-odds/', 'The odds calculator')} lets you enter your own numbers, with normal and Treasure Hours chests counted separately.</p>`,
    },
    {
      id: 'schedule',
      heading: 'When Treasure Hours happen',
      html: `<p>Epic announces each Treasure Hours on its Fortnite Communities page and on Fortnite Status. This page does not list start times, because the announcements are the source and Epic can change them. Epic's posts for this season so far:</p><ul>
<li>${sourceLink('epic-hours-nov7')}</li>
<li>${sourceLink('epic-hours-nov14')}</li>
<li>${sourceLink('epic-hours-nov21')}</li>
</ul><p>Each post names a Saturday. They describe changes to Sprites and a weapon every player drops in with. They do not restate the treasure multipliers, so the drop rate article is the only Epic statement of treasure boosts that we found.</p>`,
    },
    {
      id: 'unconfirmed',
      heading: 'What we could not confirm',
      html: `<p>Some third-party sites list different multipliers for individual events. We could not confirm any of them with Epic, so this page uses only the figures in Epic's article.</p>`,
    },
  ],
  faq: [
    ...pick('hours'),
    {
      q: 'Do Treasure Hours guarantee a Pirate token?',
      a: `No. A boost raises the chance on each chest. At ${psa.hoursBoost}x, Pirate Shop Access is still about 1 in ${calc.formatCount(boostedOneIn(psa))} per chest, by our arithmetic from Epic's figures.`,
    },
    {
      q: 'When is the next Treasure Hours?',
      a: `Epic announces each one on its Fortnite Communities page and on Fortnite Status. We do not list times here. ${link(SITE.app.track, 'Chest Log')} counts your chests from replays whenever you play.`,
    },
  ],
  related: ['treasure-hunters-odds', 'fortnite-replay-files', 'faq', 'auto-track'],
}
