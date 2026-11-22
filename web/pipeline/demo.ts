import type { Match, Week } from '../src/data'

/**
 * The demo library: one real player's week with every name replaced. The source files are the local app's own
 * data (week.json and one file per match), which carry the player's, their squad's and their opponents' Epic names.
 */
export interface Demo { week: Week; matches: Match[] }
export interface DemoSource { week: Record<string, unknown>; matches: Match[] }

/** Every field the app reads from a week. A source file's other fields are left behind. */
const weekFields: Record<keyof Week, true> = {
  player: true, generatedAt: true, total: true, opened: true, broken: true, team: true, average: true, realMatches: true,
  stubs: true, wins: true, topFive: true, pace: true, distanceKm: true, mapCrossings: true, firstChestMedian: true,
  bestOpening: true, ammoBoxes: true, otherContainers: true, confirmedShare: true, bestMatchId: true, matches: true,
  chestTimes: true, loot: true, rarity: true, drops: true, finishes: true, clipCount: true,
}

export const OWNER = 'Player'
export const UNKNOWN = ['Unknown opener', '?']
const ARROW = ' → '

const names = (detail: string) => detail.split(ARROW)
const isPerson = (name: string) => !UNKNOWN.includes(name)

/**
 * A stable fake name for every name in the matches: the recorder is "Player", the people they squadded with are
 * "Squadmate N" (1 is the most frequent), and everyone else in a combat or chest event is "Opponent N" in the order
 * they first appear. The same input always gives the same names.
 */
export function aliasesFor(matches: Match[], owner: string) {
  const ordered = matches.toSorted((a, b) => a.id.localeCompare(b.id))
  const squadmates = new Map<string, number>()
  for (const match of ordered) {
    for (const { name, you } of match.squad) if (!you && name !== owner) squadmates.set(name, (squadmates.get(name) ?? 0) + 1)
    for (const { name } of match.team) if (name !== owner && !squadmates.has(name)) squadmates.set(name, 0)
  }
  const aliases = new Map<string, string>([[owner, OWNER], ...ordered.map((match): [string, string] => [match.player, OWNER])])
  for (const [i, [name]] of [...squadmates].sort((a, b) => b[1] - a[1]).entries()) aliases.set(name, `Squadmate ${i + 1}`)
  let opponents = 0
  for (const match of ordered) {
    for (const event of match.events) {
      for (const name of names(event.detail)) {
        if (isPerson(name) && !aliases.has(name)) aliases.set(name, `Opponent ${++opponents}`)
      }
    }
  }
  return aliases
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const hundredths = (value: number) => Math.round(value * 100) / 100
const finish = (placement: number) => placement === 1 ? '1st' : placement <= 5 ? '2nd to 5th' : placement <= 10 ? '6th to 10th' : '11th or later'

/**
 * The week lists a match its folder has no file for when the two were exported at different moments, and a visitor
 * would open it to a missing page. Drops such rows and takes them back out of the totals that follow from them
 * (chests, matches, wins, finishes, drop spots, chest times). Totals that cannot be split by match stay as exported.
 */
export function reconcile(week: Week, have: Set<string>): Week {
  const gone = week.matches.filter(row => !have.has(row.id))
  if (gone.length === 0) return week
  const lost = gone.filter(row => !row.stub)
  const chests = sum(lost.map(row => row.chests))
  const mates = sum(lost.flatMap(row => row.squad.filter(member => !member.you).map(member => member.chests)))
  const matches = week.matches.filter(row => have.has(row.id))
  const real = matches.filter(row => !row.stub)
  const total = week.total - chests
  const drop = (tallies: Week['drops'], label: string | null) => tallies.map(tally => tally.label === label ? { ...tally, count: tally.count - 1 } : tally)
  const within = (time: number) => lost.some(row => time >= Date.parse(row.startUtc) && time <= Date.parse(row.startUtc) + row.duration * 1000)
  const placed = lost.filter(row => row.placement !== null)
  return {
    ...week,
    matches,
    total,
    opened: week.opened - chests,
    team: { ...week.team, opened: week.team.opened - mates },
    realMatches: real.length,
    stubs: matches.length - real.length,
    average: real.length ? hundredths(total / real.length) : 0,
    wins: week.wins - placed.filter(row => row.placement === 1).length,
    topFive: week.topFive - placed.filter(row => row.placement! <= 5).length,
    chestTimes: week.chestTimes.filter(time => !within(time)),
    drops: lost.reduce((tallies, row) => drop(tallies, row.zone), week.drops),
    finishes: placed.reduce((tallies, row) => tallies.map(tally => tally.label === finish(row.placement!) ? { ...tally, count: tally.count - 1 } : tally), week.finishes),
    bestMatchId: lost.some(row => row.id === week.bestMatchId) ? real.toSorted((a, b) => b.chests - a.chests)[0]?.id ?? null : week.bestMatchId,
  }
}

/** The demo's week and matches: names replaced, clips dropped, the week matching the matches it lists. */
export function anonymizeDemo({ week: source, matches: sourceMatches }: DemoSource): Demo {
  for (const field of Object.keys(weekFields)) if (!(field in source)) throw new Error(`the week has no ${field}`)
  const picked = Object.fromEntries(Object.keys(weekFields).map(field => [field, source[field]])) as unknown as Week
  const aliases = aliasesFor(sourceMatches, picked.player)
  const alias = (name: string) => aliases.get(name) ?? name
  const rename = <T extends { name: string }>(entry: T): T => ({ ...entry, name: alias(entry.name) })

  const matches = sourceMatches.toSorted((a, b) => a.id.localeCompare(b.id)).map((match): Match => ({
    ...match,
    player: alias(match.player),
    squad: match.squad.map(rename),
    team: match.team.map(rename),
    track: match.track && rename(match.track),
    events: match.events.map(event => ({ ...event, detail: names(event.detail).map(alias).join(ARROW) })),
    clips: [],
  }))
  const week = reconcile({
    ...picked,
    player: alias(picked.player),
    matches: picked.matches.map(row => ({ ...row, squad: row.squad.map(rename), clips: 0 })),
    clipCount: 0,
  }, new Set(matches.map(match => match.id)))
  return { week, matches }
}

const escape = (text: string) => text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Every string in `value`, once. */
function strings(value: unknown, found = new Set<string>()) {
  if (typeof value === 'string') found.add(value)
  else if (Array.isArray(value)) for (const item of value) strings(item, found)
  else if (value && typeof value === 'object') for (const item of Object.values(value)) strings(item, found)
  return found
}

/**
 * Place names such as "Buggy's Beachhead" can hold a player's name as a word. They come from the map, not from a
 * player, so a leak check leaves them alone.
 */
export function placeNames({ week, matches }: DemoSource) {
  const rows = Array.isArray(week.matches) ? week.matches as { zone: string | null }[] : []
  const drops = Array.isArray(week.drops) ? week.drops as { label: string }[] : []
  return new Set([...matches.map(match => match.zone), ...rows.map(row => row.zone), ...drops.map(drop => drop.label)].filter(name => name !== null))
}

/** The strings in `output` that carry a name from `originals`, as a name or inside one, ignoring case. */
export function leaks(output: unknown, originals: Iterable<string>, places: Set<string> = new Set()) {
  const list = [...originals].filter(name => name.length > 0).toSorted((a, b) => b.length - a.length)
  if (list.length === 0) return []
  const apart = '(?<![\\p{L}\\p{N}_-])'
  const pattern = new RegExp(`${apart}(?:${list.map(escape).join('|')})(?![\\p{L}\\p{N}_-])`, 'iu')
  return [...strings(output)].filter(text => !places.has(text) && pattern.test(text))
}
