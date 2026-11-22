import { CHECKED, type IsoDate } from './config.ts'

export type Source = { label: string; publisher: string; url: string; checked: IsoDate }

export const SOURCES = {
  'epic-drop-rates': {
    label: "What are the drop rates of treasure in chests in Fortnite Battle Royale's Pirate Treasure event",
    publisher: 'Epic Games Help Center',
    url: 'https://www.epicgames.com/help/c-34254770/c-33726977/what-are-the-drop-rates-of-treasure-in-chests-in-fortnite-battle-royale-s-pirate-treasure-event-a14361627',
    checked: CHECKED,
  },
  'epic-replays': {
    label: 'Unable to play Fortnite replays from a previous update',
    publisher: 'Epic Games Help Center',
    url: 'https://www.epicgames.com/help/c-34254770/c-33726977/a25553277',
    checked: CHECKED,
  },
  'epic-play-replays': {
    label: 'How can I play my replay saves in Fortnite?',
    publisher: 'Epic Games Help Center',
    url: 'https://www.epicgames.com/help/fortnite-battle-royale-c-202300000001636/a202300000013833',
    checked: CHECKED,
  },
  'epic-season': {
    label: 'Fortnite Treasure Hunters: The Greatest Adventure of All Time',
    publisher: 'Fortnite news, October 30, 2026',
    url: 'https://www.fortnite.com/news/fortnite-treasure-hunters-the-greatest-adventure-of-all-time',
    checked: CHECKED,
  },
  'vgc-squad': {
    label: 'Fortnite Pirate Shop Token guide',
    publisher: 'Video Games Chronicle',
    url: 'https://www.videogameschronicle.com/news/fortnite-pirate-shop-access-token-guide/',
    checked: CHECKED,
  },
  'epic-hours-nov7': {
    label: 'Treasure Hours: Fortune, November 7',
    publisher: 'Fortnite Communities',
    url: 'https://communities.epicgames.com/thread/treasure-hours-fortune-november-7/GJLD',
    checked: CHECKED,
  },
  'epic-hours-nov14': {
    label: 'Treasure Hours: Cursed, November 14',
    publisher: 'Fortnite Communities',
    url: 'https://communities.epicgames.com/thread/treasure-hours-cursed-november-14/hPrI',
    checked: CHECKED,
  },
  'epic-hours-nov21': {
    label: 'Treasure Hours: Fortune and Cursed, November 21',
    publisher: 'Fortnite Communities',
    url: 'https://communities.epicgames.com/thread/treasure-hours-fortune-and-cursed-november-21/xeqS',
    checked: CHECKED,
  },
} as const satisfies Record<string, Source>

export type SourceId = keyof typeof SOURCES

export const sourceList = (): readonly (Source & { id: SourceId })[] =>
  (Object.keys(SOURCES) as SourceId[]).map(id => ({ id, ...SOURCES[id] }))
