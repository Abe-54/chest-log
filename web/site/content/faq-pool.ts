import { SITE } from '../config.ts'
import type { Faq } from '../types.ts'
import { calc, treasure } from '../odds.ts'
import { link, pathCode, sourceLink } from '../html.ts'

const psa = treasure('pirate-shop-access')
const roundTo2 = (value: number) => calc.formatCount(Number(value.toPrecision(2)))
const half = calc.chestsFor(0.5, psa.oneIn, 1)
const ninety = calc.chestsFor(0.9, psa.oneIn, 1)

export const FAQ_POOL = {
  what: {
    q: 'What is Chest Log?',
    a: `Chest Log is a free Fortnite chest counter that runs in your browser. It reads the replay files Fortnite saves on your PC, counts the chests you opened in each match, and replays every match on the island map. There is no account and nothing to download.`,
  },
  upload: {
    q: 'Does Chest Log upload my replays?',
    a: `No. Your browser reads the replay files on your own computer and keeps the results in that browser's storage. Nothing is sent to a server. The ${link('/privacy/', 'privacy page')} lists the one thing the site does collect, which is cookieless page-view analytics.`,
  },
  where: {
    q: 'Where are my Fortnite replay files?',
    a: `On a Windows PC they are in ${pathCode(SITE.demosPath)}. The ${link('/fortnite-replay-files/', 'replay files guide')} shows how to open that folder and how to turn replays on.`,
  },
  turnOn: {
    q: 'Do I need to turn replays on?',
    a: `Yes. Epic puts the switch in Settings, on the Game tab, in the Replays group at the bottom. Fortnite only saves a replay for matches played while it is on.`,
  },
  platform: {
    q: 'Does Chest Log work on console or mobile?',
    a: `No. Chest Log reads replay files, and you can only reach those on a PC. Epic's help center says replays also exist on PlayStation and Xbox, but they stay on the console, so there is no folder to give Chest Log.`,
  },
  browser: {
    q: 'Which browsers work?',
    a: `Any current desktop browser: Chrome, Edge, Firefox or Safari. You choose your replay folder after you play, and Chest Log skips matches it already counted.`,
  },
  missing: {
    q: 'Why are some of my matches missing?',
    a: `Chest Log can only count a match if you still have its replay file. Epic says a replay only plays in the game version that recorded it, and that after an update older replays stop being valid unless you saved them. Import your matches before the next update.`,
  },
  odds: {
    q: 'What are the odds of getting the Pirate token?',
    a: `Epic lists Pirate Shop Access at 1 in ${calc.formatCount(psa.oneIn)} for every chest opened in a normal match (${sourceLink('epic-drop-rates', `Epic's drop rate article`)}). Treasure is shared across the squad, so every chest a squadmate opens counts toward your odds too. Treasure Hours multiply that chance by ${psa.hoursBoost}. The ${link('/treasure-hunters-odds/', 'odds page')} has the full table and a calculator.`,
  },
  howMany: {
    q: 'How many chests until I get the Pirate Shop Access token?',
    a: `No number guarantees it. At 1 in ${calc.formatCount(psa.oneIn)} per chest, about ${roundTo2(half)} chests opened by your squad give you a 50% chance and about ${roundTo2(ninety)} give you 90%. Those are our calculations from Epic's odds, not figures Epic publishes.`,
  },
  hours: {
    q: 'What are Treasure Hours?',
    a: `Treasure Hours are windows when Epic boosts the drop rate of some treasures. Epic lists 1.5x for Pirate Shop Access, 7.5x for the Weekly Gold Outfit and 10x for the Weekly Vehicle &amp; Decal. ${link('/treasure-hours/', 'Treasure Hours explained')} has the details.`,
  },
  shared: {
    q: 'If a squadmate finds the Pirate token, do I get it too?',
    a: `Yes. When anyone in your squad finds the Pirate Shop Access token in a chest, everyone in the squad gets it, and the same goes for every other treasure (${sourceLink('vgc-squad', 'Video Games Chronicle')}). That makes your odds depend on how many chests your whole squad opens, not only yours.`,
  },
  teammates: {
    q: "Does Chest Log count my teammates' chests?",
    a: `Yes, and your token odds include them, because a treasure any squadmate finds goes to the whole squad. A teammate's count is what your replay saw, so it runs low when your squad splits up and your real odds are a little better than shown.`,
  },
  quests: {
    q: 'Why not use the Quests tab in Fortnite?',
    a: `Players report that the in-game chest quest shows one running total with no history by match, and that it stops counting at a cap, commonly given as 1,000. We could not find Epic documentation for that cap, so check your own Quests tab. Chest Log keeps a count for every match you have a replay for.`,
  },
  newMatches: {
    q: 'How do I add new matches?',
    a: `After you play, open Chest Log and choose your Demos folder again. Matches it already counted are skipped, so only the new ones are read. Browsers do not let a website watch that folder on its own, because Windows keeps it inside AppData.`,
  },
  speed: {
    q: 'How long does an import take?',
    a: `About two seconds for each replay file. Keep the tab open while it works.`,
  },
  delete: {
    q: 'How do I delete my data?',
    a: `Clear this site's data in your browser settings. That removes everything Chest Log stored, including your match library. Chest Log reads your replay files without changing them, so they stay where they are.`,
  },
  game: {
    q: 'Does Chest Log touch the game?',
    a: `No. Chest Log never connects to Fortnite. It reads replay files after the game has written them.`,
  },
  epic: {
    q: 'Is Chest Log made by Epic Games?',
    a: `No. ${SITE.disclaimer}`,
  },
} as const satisfies Record<string, Faq>

export type FaqId = keyof typeof FAQ_POOL

export const pick = (...ids: FaqId[]): Faq[] => ids.map(id => FAQ_POOL[id])
export const allFaq = (): Faq[] => (Object.keys(FAQ_POOL) as FaqId[]).map(id => FAQ_POOL[id])
