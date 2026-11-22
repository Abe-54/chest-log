import type { Page } from '../types.ts'
import {
  CALC_SOURCE,
  COMMON_COUNTS,
  DEFAULT_CHESTS,
  ALL_TREASURES,
  boostedOneIn,
  calc,
  oneInText,
  treasure,
  type Treasure,
} from '../odds.ts'
import { CHECKED } from '../config.ts'
import { cite, esc, link, longDate, sourceLink, table } from '../html.ts'
import { pick } from './faq-pool.ts'

const gold = treasure('weekly-gold-outfit')
const psa = treasure('pirate-shop-access')
const vehicle = treasure('weekly-vehicle-decal')
const headline: Treasure[] = [psa, gold, vehicle]
const about = (value: number) => calc.formatCount(Number(value.toPrecision(2)))
const chance = (entry: Treasure, normal: number, hours = 0) => calc.formatPercent(calc.chanceAtLeastOne(entry.oneIn, entry.hoursBoost ?? 1, normal, hours))

const calcData = JSON.stringify(ALL_TREASURES.map(entry => ({ name: esc(entry.name), oneIn: entry.oneIn, boost: entry.hoursBoost ?? 1 })))

const calculatorHtml = `<form id="calc" class="calc" novalidate>
<div class="field"><label for="normal">Chests you opened in normal matches</label><input id="normal" name="normal" type="number" inputmode="numeric" min="0" step="1" value="${DEFAULT_CHESTS.normal}"></div>
<div class="field"><label for="hours">Chests you opened during Treasure Hours</label><input id="hours" name="hours" type="number" inputmode="numeric" min="0" step="1" value="${DEFAULT_CHESTS.hours}"></div>
</form>
${table({
  caption: 'Chance of finding each reward at least once',
  head: ['Reward', 'Odds per chest', 'Chance of at least one'],
  numeric: [1, 2],
  bodyId: 'calc-out',
  rows: ALL_TREASURES.map(entry => [esc(entry.name), oneInText(entry), chance(entry, DEFAULT_CHESTS.normal, DEFAULT_CHESTS.hours)]),
})}
<p class="note">The table starts at ${calc.formatCount(DEFAULT_CHESTS.normal)} chests. Change the numbers and it updates. The formula is 1 &minus; (1 &minus; p)<sup>N</sup>, where p is the chance on one chest and N is the number of chests. Chests opened during Treasure Hours use p times the boost Epic lists. Rewards with no boost in Epic's list keep their normal odds.</p>
<script type="application/json" id="odds-data">${calcData}</script>`

const script = `${CALC_SOURCE}
(function () {
  var form = document.getElementById('calc');
  var out = document.getElementById('calc-out');
  var data = JSON.parse(document.getElementById('odds-data').textContent);
  function whole(input) {
    var value = Math.floor(Number(input.value));
    return isFinite(value) && value > 0 ? value : 0;
  }
  function render() {
    var normal = whole(form.elements.normal);
    var hours = whole(form.elements.hours);
    out.innerHTML = data.map(function (item) {
      var chance = chanceAtLeastOne(item.oneIn, item.boost, normal, hours);
      return '<tr><th scope="row">' + item.name + '</th><td class="num">1 in ' + formatCount(item.oneIn) + '</td><td class="num">' + formatPercent(chance) + '</td></tr>';
    }).join('');
  }
  form.addEventListener('input', render);
  form.addEventListener('submit', function (event) { event.preventDefault(); });
  render();
})();`

export const oddsPage: Page = {
  slug: 'treasure-hunters-odds',
  type: 'guide',
  label: 'Pirate token odds',
  title: 'Fortnite Pirate Token Odds and Gold Outfit Odds',
  description: `Epic's chest odds for Treasure Hunters: Pirate Shop Access 1 in ${calc.formatCount(psa.oneIn)}, Weekly Gold Outfit 1 in ${calc.formatCount(gold.oneIn)}. Calculate your own chance.`,
  h1: 'Fortnite Pirate token odds and gold outfit odds',
  lede: `<p>Epic publishes the chance of finding each Treasure Hunters reward every time you open a chest. This page shows those numbers, what they mean for a real chest count, and a calculator for yours.</p>`,
  ctas: [{ label: 'Count your own chests', href: '/app/track', kind: 'primary' }],
  published: '2026-11-22',
  updated: '2026-11-22',
  breadcrumbs: [],
  sections: [
    {
      id: 'epic-odds',
      heading: "Epic's odds for every chest",
      html: `<p>Epic says these odds apply each time you open a chest in a normal match. It also says they have not changed since the season launched and do not vary through the day, except during Treasure Hours. Apart from Gizmos, you cannot get the same treasure twice.</p>${table({
        caption: "Epic's per-chest drop rates in a normal match",
        head: ['Reward', 'Odds per chest', 'Percent'],
        numeric: [1, 2],
        rows: ALL_TREASURES.map(entry => [esc(entry.name), oneInText(entry), calc.formatPercent(1 / entry.oneIn)]),
      })}${cite('epic-drop-rates')}<p>The percent column is our arithmetic from Epic's ratios.</p>`,
    },
    { id: 'calculator', heading: 'Calculate your chance from your chest count', html: calculatorHtml },
    {
      id: 'by-count',
      heading: 'Chance by number of chests',
      html: `<p>These rows use the same formula as the calculator, for normal matches only.</p>${table({
        caption: 'Chance of at least one reward by chests opened',
        head: ['Chests opened', ...headline.map(entry => esc(entry.name))],
        numeric: [1, 2, 3],
        rows: COMMON_COUNTS.map(count => [calc.formatCount(count), ...headline.map(entry => chance(entry, count))]),
      })}`,
    },
    {
      id: 'chests-needed',
      heading: 'How many chests for a 50% or 90% chance',
      html: `<p>One in ${calc.formatCount(psa.oneIn)} does not mean you are owed a token after ${calc.formatCount(psa.oneIn)} chests. Each chest is a separate roll, and a miss does not make the next chest more likely. The average wait is ${calc.formatCount(psa.oneIn)} chests, but your chance of having found one passes 50% after about ${about(calc.chestsFor(0.5, psa.oneIn, 1))}.</p>${table({
        caption: 'Chests you need to open for a given chance of at least one reward',
        head: ['Reward', '50% chance', '90% chance', '50% in Treasure Hours', '90% in Treasure Hours'],
        numeric: [1, 2, 3, 4],
        rows: headline.map(entry => [
          esc(entry.name),
          about(calc.chestsFor(0.5, entry.oneIn, 1)),
          about(calc.chestsFor(0.9, entry.oneIn, 1)),
          about(calc.chestsFor(0.5, entry.oneIn, entry.hoursBoost ?? 1)),
          about(calc.chestsFor(0.9, entry.oneIn, entry.hoursBoost ?? 1)),
        ]),
      })}<p>These are rounded and come from our arithmetic on Epic's odds, not from Epic.</p>`,
    },
    {
      id: 'treasure-hours',
      heading: 'Treasure Hours boost',
      html: `<p>During Treasure Hours Epic lists a boosted rate for three rewards. Pirate Shop Access is ${psa.hoursBoost}x, Weekly Gold Outfit is ${gold.hoursBoost}x and Weekly Vehicle &amp; Decal is ${vehicle.hoursBoost}x. Epic adds that the rates may be higher in future Treasure Hours. A ${psa.hoursBoost}x boost turns 1 in ${calc.formatCount(psa.oneIn)} into about 1 in ${calc.formatCount(boostedOneIn(psa))}.</p>${cite('epic-drop-rates')}<p>${link('/treasure-hours/', 'Treasure Hours explained')} covers what the windows are and where Epic announces them.</p>`,
    },
    {
      id: 'squads',
      heading: 'Squads and teammates',
      html: `<p>Epic words the odds as your chance each time you open a chest. Its help article does not say whether a treasure found by one squad member is shared with teammates. ${sourceLink('vgc-squad', 'Video Games Chronicle')} reports that if anyone in your squad finds the Pirate Shop Token in a chest, every member of the squad gets it. We could not find that in an Epic source, so treat it as unconfirmed.</p><p>If sharing is true for your squad, every chest any squad member opens is a chance for the whole squad, and you would enter the squad's total in the calculator. If it is false, only your own chests count. Chest Log counts chests for you and for the teammates your replay saw, and a teammate's count runs low when your squad splits up.</p>`,
    },
    {
      id: 'unconfirmed',
      heading: 'What we could not confirm with Epic',
      html: `<ul>
<li>Any Treasure Hours boost other than the three Epic lists. Some outlets report different multipliers for individual events. Epic's article only says future rates may be higher, and the event posts we read do not restate treasure multipliers.</li>
<li>Whether teammates share a token, covered above.</li>
<li>Whether Epic changes the base odds after the season. These figures are the ones on Epic's page on ${longDate(CHECKED)}.</li>
</ul>`,
    },
  ],
  faq: pick('odds', 'howMany', 'hours', 'teammates'),
  related: ['treasure-hours', 'auto-track', 'fortnite-replay-files', 'faq'],
  script,
}
