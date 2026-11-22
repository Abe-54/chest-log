import { SITE } from '../config.ts'
import type { Page } from '../types.ts'
import { DEMO, calc, treasure } from '../odds.ts'
import { cite, link, table } from '../html.ts'
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
  { chests: DEMO.chests, label: `${calc.formatCount(DEMO.chests)}, demo squad`, demo: true },
  { chests: 10_000, label: `${calc.formatCount(10_000)} chests` },
  { chests: 50_000, label: `${calc.formatCount(50_000)} chests`, wideOnly: true },
  { chests: coinFlip, label: `${calc.formatCount(coinFlip)} chests` },
]

const ladder = `<div class="ladder"><ol>${LADDER.map(row => {
  const chance = calc.chanceAtLeastOne(psa.oneIn, 1, row.chests, 0)
  const classes = [row.demo ? 'is-demo' : '', row.wideOnly ? 'wide-only' : ''].filter(Boolean).join(' ')
  return `<li${classes ? ` class="${classes}"` : ''}><span class="l">${row.label}</span><span class="track" aria-hidden="true"><span class="fill" style="--w:${(chance * 100).toFixed(2)}%"></span></span><span class="v">${ladderPercent(chance)}</span></li>`
}).join('')}</ol><p class="ladder-note">Odds that at least one token dropped: 1 &minus; (1 &minus; 1/${calc.formatCount(psa.oneIn)})^chests. A coin flip takes ${calc.formatCount(coinFlip)} chests.</p></div>`

const steps = (items: { title: string; body: string }[]) =>
  `<ol class="home-steps">${items.map(item => `<li><h3>${item.title}</h3><p>${item.body}</p></li>`).join('')}</ol>`

export const home: Page = {
  slug: '',
  type: 'home',
  label: 'Home',
  title: 'Fortnite Chest Counter: Count Chests From Your Replays',
  description: 'Free Fortnite chest counter. Count every chest from your replay files, replay each match on the map and see your Pirate token odds. Nothing is uploaded.',
  h1: 'Count every Fortnite chest from your replays',
  hero: {
    promise: 'Free for Windows PC. Runs in your browser, and nothing is uploaded.',
    note: 'Counting needs the replay files on your Windows PC. Open this page there, or try the demo here.',
  },
  lede: `<p>With replays turned on, Fortnite saves every match. Chest Log reads them, counts the chests your squad opened, and plays each match back on the island.</p>`,
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
      aside: `<p>Chest Log is a free Fortnite chest counter for Windows PC. With replays turned on, Fortnite saves a file for every match, and Chest Log reads those files inside your browser tab. ${link('/fortnite-replay-files/', 'Where the files are')}.</p>`,
      html: steps([
        { title: 'Pick your Fortnite replay folder', body: 'Chest Log shows you the exact path. Or drop in a single .replay file.' },
        { title: 'Your browser reads the replays', body: 'Every chest you or your squad opened or broke gets counted, match by match.' },
        { title: 'Watch any match back', body: 'Your week, your token odds, and every match on the island with each chest pinned where you opened it.' },
      ]),
    },
    {
      id: 'token-odds',
      heading: 'Did your squad find a Pirate Shop token yet?',
      html: `<div class="panel-copy"><p>Epic puts the drop at 1 in ${calc.formatCount(psa.oneIn)} per chest, and any squadmate's find goes to the whole squad. So every chest your squad opens is a roll for you, and Chest Log turns your squad's real count into your odds.</p><p class="cta-row"><a class="btn btn-inline btn-ink" href="/treasure-hunters-odds/">Get my odds</a></p>${cite('epic-drop-rates')}</div><div class="odds-side"><p class="odds-figure"><strong>${ladderPercent(calc.chanceAtLeastOne(psa.oneIn, 1, DEMO.chests, 0))}</strong><span>chance the demo squad found one in ${calc.formatCount(DEMO.chests)} chests</span></p>${ladder}</div>`,
    },
    {
      id: 'manual-vs-replay',
      heading: 'Why count from replays instead of by hand',
      html: `<p>A manual counter only knows what you told it. A replay is the game's own record of the match, so counting from replays does not depend on your memory.</p>${table({
        caption: 'Manual chest counters compared with counting from replays',
        head: ['', 'Manual counter', 'Chest Log'],
        stack: true,
        rows: [
          ['During a match', 'You tap or type each time you open a chest.', 'Nothing. You play normally.'],
          ['A match you forgot to log', 'Lost.', 'Counted, as long as its replay file still exists.'],
          ['Match history', 'Usually one running total.', 'A count for every match, and every match on the map.'],
          ['New matches', 'You add them by hand.', `In Chrome or Edge, rechecks your folder every 30 seconds. ${link('/auto-track/', 'Auto tracking')}.`],
          ['Account and uploads', 'Often an account.', `No account. Replays never leave your computer. ${link('/privacy/', 'Privacy')}.`],
        ],
      })}<p>The in-game Quests tab is not a substitute. Players report that it shows one total with no history by match and stops counting at a cap. ${link('/faq/', 'More on that in the FAQ')}.</p>`,
    },
  ],
  faq: pick('upload', 'where', 'shared', 'odds', 'browser'),
  related: ['treasure-hunters-odds', 'fortnite-replay-files', 'auto-track', 'treasure-hours', 'privacy', 'faq'],
}
