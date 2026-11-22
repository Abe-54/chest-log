import { SITE } from '../config.ts'
import type { Page } from '../types.ts'
import { calc, treasure } from '../odds.ts'
import { cite, link, pathCode, steps, table } from '../html.ts'
import { pick } from './faq-pool.ts'

const psa = treasure('pirate-shop-access')

export const home: Page = {
  slug: '',
  type: 'home',
  label: 'Home',
  title: 'Fortnite Chest Counter: Count Chests From Your Replays',
  description: 'Free Fortnite chest counter. Count every chest from your replay files, replay each match on the map and see your Pirate token odds. Nothing is uploaded.',
  h1: 'Every chest, every match, replayed on the map',
  lede: `<p class="lede-main">No download. Nothing uploaded. Your own Pirate token odds.</p><p>Chest Log is a free Fortnite chest counter for PC. Point it at the replay files Fortnite already saves and it counts the chests you opened in every match.</p>`,
  ctas: [
    { label: 'Start tracking', href: SITE.app.track, kind: 'primary' },
    { label: 'Try the demo', href: SITE.app.demo, kind: 'secondary' },
  ],
  published: '2026-11-22',
  updated: '2026-11-22',
  breadcrumbs: [],
  sections: [
    {
      id: 'how-it-works',
      heading: 'How it works',
      html: steps([
        {
          title: 'Turn on replays',
          body: `In Fortnite, open Settings, go to the Game tab and scroll to the Replays group. Fortnite then saves a replay file for each match. ${link('/fortnite-replay-files/', 'Where the files are')}.`,
        },
        {
          title: 'Choose your replay folder',
          body: `Open Chest Log and pick the Demos folder, ${pathCode(SITE.demosPath)}. Your browser reads the files on your PC. Chrome and Edge remember the folder for next time.`,
        },
        {
          title: 'See your chests',
          body: `Chest Log adds up the chests in every match, replays each match on the island map and works out your Pirate token odds.`,
        },
      ]),
    },
    {
      id: 'what-you-get',
      heading: 'What you get',
      html: `<ul class="features">
<li><strong>A chest count for every match.</strong> See what each match gave you, not only a running total.</li>
<li><strong>Every match on the map.</strong> Watch each match back on the island map.</li>
<li><strong>Your Pirate token odds.</strong> Your chest count run through Epic's published per-chest odds. ${link('/treasure-hunters-odds/', 'See the odds and the calculator')}.</li>
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
    {
      id: 'epic-odds',
      heading: "Epic's odds, applied to your count",
      html: `<p>Epic lists Pirate Shop Access at 1 in ${calc.formatCount(psa.oneIn)} for every chest you open in a normal match. Chest Log takes your own chest count and shows your chance of having found one. ${link('/treasure-hunters-odds/', 'Try the calculator without any replays')}.</p>${cite('epic-drop-rates')}`,
    },
  ],
  faq: pick('what', 'upload', 'where', 'platform', 'odds', 'quests'),
  related: ['treasure-hunters-odds', 'fortnite-replay-files', 'auto-track', 'treasure-hours', 'privacy', 'faq'],
}
