import { SITE } from '../config.ts'
import type { Page } from '../types.ts'
import { DEMO, calc, treasure } from '../odds.ts'
import { cite, esc, link, table } from '../html.ts'
import { pick } from './faq-pool.ts'

const psa = treasure('pirate-shop-access')
const coinFlip = calc.chestsFor(0.5, psa.oneIn, 1)

/** The ladder rounds harder than the article tables: two decimals under 10%, one under 50%, whole numbers above. */
export const ladderPercent = (chance: number) => {
  const percent = chance * 100
  return `${percent >= 50 ? Math.floor(percent) : percent.toFixed(percent < 10 ? 2 : 1)}%`
}

const LADDER = [
  { chests: 1_000, label: `${calc.formatCount(1_000)} chests` },
  { chests: DEMO.chests, label: `${calc.formatCount(DEMO.chests)} · demo squad`, demo: true },
  { chests: 10_000, label: `${calc.formatCount(10_000)} chests` },
  { chests: 50_000, label: `${calc.formatCount(50_000)} chests`, wideOnly: true },
  { chests: coinFlip, label: `${calc.formatCount(coinFlip)} chests` },
]

const ladder = `<div class="ladder"><ol>${LADDER.map(row => {
  const chance = calc.chanceAtLeastOne(psa.oneIn, 1, row.chests, 0)
  const classes = [row.demo ? 'is-demo' : '', row.wideOnly ? 'wide-only' : ''].filter(Boolean).join(' ')
  return `<li${classes ? ` class="${classes}"` : ''}><span class="l">${row.label}</span><span class="track" aria-hidden="true"><span class="fill" style="--w:${(chance * 100).toFixed(2)}%"></span></span><span class="v">${ladderPercent(chance)}</span></li>`
}).join('')}</ol><p class="ladder-note">Odds that at least one token dropped: 1 &minus; (1 &minus; 1/${calc.formatCount(psa.oneIn)})^chests. A coin flip takes ${calc.formatCount(coinFlip)} chests.</p></div>`

const lootSteps = (items: { title: string; body: string }[]) =>
  `<ol class="loot-steps">${items.map((item, at) => `<li class="rarity-wash"><span class="step-n" aria-hidden="true">0${at + 1}</span><h3>${item.title}</h3><p>${item.body}</p></li>`).join('')}</ol>`

export const home: Page = {
  slug: '',
  type: 'home',
  label: 'Home',
  title: 'Fortnite Chest Counter: Count Chests From Your Replays',
  description: 'Free Fortnite chest counter. Count every chest from your replay files, replay each match on the map and see your Pirate token odds. Nothing is uploaded.',
  h1: 'Every chest, every match, replayed on the map.',
  hero: {
    eyebrow: 'Free · runs in your browser',
    accent: 'replayed on the map.',
    note: 'Replays live on your PC. Open this page there to count them, or try the demo here.',
  },
  lede: `<p><strong>No download. Nothing uploaded.</strong> Drop in your Fortnite replays and get your own Pirate Shop token odds.</p>`,
  ctas: [
    { label: 'Count my chests', href: SITE.app.track, kind: 'primary' },
    { label: 'Try the demo', href: SITE.app.demo, kind: 'secondary' },
  ],
  published: '2026-11-22',
  updated: '2026-11-22',
  breadcrumbs: [],
  sections: [
    {
      id: 'how-it-works',
      heading: 'How it works',
      aside: `<p>With replays turned on, Fortnite records every match. Chest Log reads those replays inside your browser tab.</p>`,
      html: lootSteps([
        { title: 'Pick your Demos folder', body: `It lives at <code>${esc(SITE.demosPath)}</code>. Or drop in a single .replay file.` },
        { title: 'Your browser reads them', body: 'Every chest you or your squad opened or broke gets counted. The files never leave your computer.' },
        { title: 'Count, compare, replay', body: 'See your week, your token odds, and every match played back on the island with each chest pinned.' },
      ]),
    },
    {
      id: 'token-odds',
      eyebrow: 'Pirate Shop token odds',
      heading: 'Did your squad find a token yet?',
      html: `<div class="panel-copy"><p>Epic puts the drop at 1 in ${calc.formatCount(psa.oneIn)} per chest. When anyone in your squad finds a treasure in a chest, the whole squad gets it, so every chest your squad opens is a roll for you. Chest Log adds up your squad's real chest count and turns it into your odds that at least one dropped.</p><p class="cta-row"><a class="btn btn-inline" href="/treasure-hunters-odds/">Get my odds</a></p>${cite('epic-drop-rates')}</div>${ladder}`,
    },
    {
      id: 'what-you-get',
      heading: 'What you get',
      html: `<p>Chest Log is a free Fortnite chest counter for PC. Point it at the replay files Fortnite saves and it counts the chests you opened in every match. ${link('/fortnite-replay-files/', 'Where the files are')}.</p><ul class="features">
<li><strong>A chest count for every match.</strong> See what each match gave you, not only a running total.</li>
<li><strong>Every match on the map.</strong> Watch each match back on the island map.</li>
<li><strong>Your Pirate token odds.</strong> Your squad's chest count run through Epic's published per-chest odds. ${link('/treasure-hunters-odds/', 'See the odds and the calculator')}.</li>
<li><strong>Auto tracking.</strong> In Chrome or Edge, Chest Log rechecks your replay folder every 30 seconds while the tab is open. ${link('/auto-track/', 'How auto tracking works')}.</li>
<li><strong>Nothing leaves your computer.</strong> Replays are read in your browser. There is no account. ${link('/privacy/', 'Read the privacy details')}.</li>
</ul>`,
    },
    {
      id: 'manual-vs-replay',
      heading: 'Manual counters and replay counting',
      html: `<p>A manual counter only knows what you told it. A replay is the game's own record of the match, so counting from replays does not depend on your memory.</p>${table({
        caption: 'Manual chest counters compared with counting from replays',
        head: ['', 'Manual counter', 'Chest Log'],
        rows: [
          ['During a match', 'You tap or type each time you open a chest.', 'Nothing. You play normally.'],
          ['Where the count comes from', 'What you remembered to log.', 'The replay file Fortnite saved.'],
          ['Match history', 'Usually one running total.', 'A count for every match.'],
          ['A match you forgot to log', 'Lost.', 'Counted, as long as its replay file still exists.'],
          ['What you need', 'A tab or app open beside the game.', 'Replays turned on and one folder to pick.'],
          ['Limits', 'Easy to miss chests in a fight.', 'PC only. A teammate count is what your replay saw.'],
        ],
      })}<p>The in-game Quests tab is not a substitute. Players report that it shows one total with no history by match and stops counting at a cap. ${link('/faq/', 'More on that in the FAQ')}.</p>`,
    },
  ],
  faq: pick('upload', 'where', 'odds', 'shared', 'browser', 'teammates'),
  related: ['treasure-hunters-odds', 'fortnite-replay-files', 'auto-track', 'treasure-hours', 'privacy', 'faq'],
}
