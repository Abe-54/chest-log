import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Match, MatchEvent, MatchRow, Week } from '../src/data'
import { anonymizeDemo, leaks, placeNames, UNKNOWN, type DemoSource } from './demo'

const REAL = ['Zed_Real', 'Mate-One', 'mate two', 'Foe#9', 'Foe_Two', 'Buggy']

const event = (kind: MatchEvent['kind'], actor: MatchEvent['actor'], detail: string): MatchEvent =>
  ({ t: 1, kind, actor, label: kind, detail, p: null })
const row = (id: string, chests: number, placement: number, zone: string, squad: string[]): MatchRow => ({
  id, startUtc: `2026-11-1${id}T20:00:00.000Z`, duration: 600, placement, kills: 1, chests, zone, alive: 500, firstChest: 10, early: [1, 2, 3], distanceKm: 1,
  stub: false, clips: 2, squad: [{ name: 'Zed_Real', you: true, chests }, ...squad.map(name => ({ name, you: false, chests: 4 }))],
})
const track = (name: string) => ({ name, segments: [] })
const match = (id: string, squad: string[], events: MatchEvent[]): Match => ({
  id, player: 'Zed_Real', startUtc: '', duration: 600, placement: 1, kills: 1, chests: 5, zone: "Buggy's Beachhead", stub: false,
  squad: [{ name: 'Zed_Real', you: true, chests: 5 }, ...squad.map(name => ({ name, you: false, chests: 4 }))],
  playerCount: 100, damageDealt: 1, landed: 1, leftBus: 1, end: 600, track: track('Zed_Real'), team: squad.map(track), events, storm: [], bus: null,
  clips: [{ id: 'c', label: 'Down', start: 0, end: 1, poster: '/media/posters/c.jpg', chestCount: 0 }], focus: null,
})

function source(): DemoSource {
  const matches = [
    match('2', ['Mate-One', 'mate two'], [
      event('chest', 'me', 'Zed_Real'), event('chest', 'team', 'mate two'), event('chest', 'enemy', 'Foe#9'), event('chest', 'unknown', 'Unknown opener'),
      event('knock', 'enemy', 'Foe#9 → Foe_Two'), event('elimination', 'me', 'Zed_Real → Foe_Two'), event('death', 'me', 'Zed_Real'),
      event('knock', 'enemy', '? → Buggy'),
    ]),
    match('1', ['Mate-One'], [event('chest', 'team', 'Mate-One'), event('knock', 'team', 'Mate-One → Foe#9')]),
  ]
  const week = {
    player: 'Zed_Real', generatedAt: 'now', total: 22, opened: 20, broken: 2, team: { opened: 12, broken: 0 }, average: 7.33, realMatches: 3, stubs: 0,
    wins: 2, topFive: 3, pace: 1, distanceKm: 3, mapCrossings: 1, firstChestMedian: 10, bestOpening: 5, ammoBoxes: 0, otherContainers: 0, confirmedShare: 1,
    bestMatchId: '3', clipCount: 4,
    matches: [row('1', 5, 1, "Buggy's Beachhead", ['Mate-One']), row('2', 5, 3, 'Windmill Village', ['Mate-One', 'mate two']), row('3', 12, 1, "Buggy's Beachhead", ['Mate-One'])],
    chestTimes: [Date.parse('2026-11-11T20:01:00Z'), Date.parse('2026-11-12T20:01:00Z'), Date.parse('2026-11-13T20:00:30Z'), Date.parse('2026-11-13T20:05:00Z')],
    loot: [], rarity: [], drops: [{ label: "Buggy's Beachhead", count: 2 }, { label: 'Windmill Village', count: 1 }],
    finishes: [{ label: '1st', count: 2 }, { label: '2nd to 5th', count: 1 }],
    crew: [{ label: 'Mate-One', count: 9 }], persona: { title: 'The First Mate', detail: 'Zed_Real averaged 8 chests' }, bestTrail: null, standoutClipId: 'c',
  }
  return { week, matches }
}

describe('demo anonymizer', () => {
  it('leaves none of the original names anywhere in the output', () => {
    const output = anonymizeDemo(source())
    // "Buggy" is also a place on the map, so it is checked as a whole word with places set aside.
    for (const name of REAL.filter(name => name !== 'Buggy')) expect(JSON.stringify(output), name).not.toContain(name)
    expect(leaks(output, REAL, placeNames(source()))).toEqual([])
  })

  it('names the recorder Player, squadmates by how often they played, and everyone else in order of appearance', () => {
    const { week, matches } = anonymizeDemo(source())
    const second = matches.find(match => match.id === '2')!
    expect(second.player).toBe('Player')
    expect(second.track?.name).toBe('Player')
    expect(second.squad.map(member => member.name)).toEqual(['Player', 'Squadmate 1', 'Squadmate 2'])
    expect(second.team.map(member => member.name)).toEqual(['Squadmate 1', 'Squadmate 2'])
    expect(second.events.map(e => e.detail)).toEqual([
      'Player', 'Squadmate 2', 'Opponent 1', 'Unknown opener', 'Opponent 1 → Opponent 2', 'Player → Opponent 2', 'Player', '? → Opponent 3',
    ])
    expect(week.player).toBe('Player')
    expect(week.matches[0].squad.map(member => member.name)).toEqual(['Player', 'Squadmate 1'])
  })

  it('drops clips, planner leftovers and every field the app does not read', () => {
    const { week, matches } = anonymizeDemo(source())
    expect(matches.every(match => match.clips.length === 0)).toBe(true)
    expect(week.clipCount).toBe(0)
    expect(week.matches.every(match => match.clips === 0)).toBe(true)
    for (const gone of ['crew', 'persona', 'bestTrail', 'standoutClipId']) expect(week).not.toHaveProperty(gone)
  })

  it('is the same however the matches arrive', () => {
    const forward = source()
    const backward = { ...source(), matches: source().matches.toReversed() }
    expect(anonymizeDemo(backward)).toEqual(anonymizeDemo(forward))
  })

  it('takes a match with no file out of the totals it feeds, and nothing else', () => {
    const { week } = anonymizeDemo(source())
    expect(week.matches.map(match => match.id)).toEqual(['1', '2'])
    expect(week).toMatchObject({ total: 10, opened: 8, realMatches: 2, stubs: 0, wins: 1, topFive: 2, average: 5, bestMatchId: '1', team: { opened: 8, broken: 0 } })
    expect(week.drops).toEqual([{ label: "Buggy's Beachhead", count: 1 }, { label: 'Windmill Village', count: 1 }])
    expect(week.finishes).toEqual([{ label: '1st', count: 1 }, { label: '2nd to 5th', count: 1 }])
    expect(week.chestTimes).toHaveLength(2)
    expect(week.broken).toBe(2)
  })

  it('refuses a week that lacks a field the app reads', () => {
    const { week, matches } = source()
    delete week.confirmedShare
    expect(() => anonymizeDemo({ week, matches })).toThrow('confirmedShare')
  })
})

describe('leak check', () => {
  it('finds a name as a whole word in any case, and not inside a longer word', () => {
    expect(leaks({ a: 'Foe#9 → x', b: 'FOE_TWO', c: 'Foe_Twos' }, ['Foe#9', 'Foe_Two'])).toEqual(['Foe#9 → x', 'FOE_TWO'])
  })

  it('skips place names that hold a name as a word', () => {
    expect(leaks(["Buggy's Beachhead", 'Buggy'], ['Buggy'], new Set(["Buggy's Beachhead"]))).toEqual(['Buggy'])
  })
})

const published = new URL('../public/demo/', import.meta.url)
const readJson = <T>(name: string) => JSON.parse(readFileSync(new URL(name, published), 'utf8')) as T

describe('the published demo library', () => {
  const week = readJson<Week>('week.json')
  const files = readdirSync(new URL('matches/', published)).filter(name => name.endsWith('.json'))
  const matches = files.map(name => readJson<Match>(`matches/${name}`))
  const fake = /^(Player|(Squadmate|Opponent) \d+)$/
  const isFake = (detail: string) => detail.split(' → ').every(name => fake.test(name) || UNKNOWN.includes(name))

  it('has a match file for every match the week lists, and a week that adds up', () => {
    expect(week.matches.map(row => encodeURIComponent(row.id) + '.json').toSorted()).toEqual(files.toSorted())
    expect(week.total).toBe(week.matches.reduce((sum, row) => sum + row.chests, 0))
    expect(week.chestTimes).toHaveLength(week.total)
    expect(week.opened + week.broken).toBe(week.total)
    expect(week.realMatches).toBe(week.matches.filter(row => !row.stub).length)
    expect(week.wins).toBe(week.matches.filter(row => row.placement === 1).length)
  })

  it('names every person Player, Squadmate N or Opponent N, in every place a name can be', () => {
    expect(week.player).toBe('Player')
    for (const row of week.matches) for (const member of row.squad) expect(member.you ? member.name === 'Player' : /^Squadmate \d+$/.test(member.name)).toBe(true)
    for (const match of matches) {
      expect(match.player).toBe('Player')
      expect(match.track?.name).toBe('Player')
      for (const member of [...match.squad, ...match.team]) expect(fake.test(member.name), member.name).toBe(true)
      for (const event of match.events) expect(isFake(event.detail), event.detail).toBe(true)
      expect(match.clips).toEqual([])
    }
  })

  it('holds no account ids and no clip or planner data', () => {
    const text = [readFileSync(new URL('week.json', published), 'utf8'), ...files.map(name => readFileSync(new URL(`matches/${name}`, published), 'utf8'))].join('\n')
    expect(text).not.toMatch(/\b[0-9a-f]{32}\b/i)
    expect(text).not.toContain('/media/')
    expect(week).not.toHaveProperty('crew')
  })
})

// The source is the local app's own export, with real names. It is not in the repository, so these run only where
// DEMO_SRC points at it: the published files must be exactly what the script makes from it, and carry none of its names.
const sourceDir = process.env.DEMO_SRC
describe.skipIf(!sourceDir || !existsSync(`${sourceDir}/week.json`))('the published demo against its source', () => {
  const read = <T>(path: string) => JSON.parse(readFileSync(`${sourceDir}/${path}`, 'utf8')) as T
  const input = () => ({
    week: read<Record<string, unknown>>('week.json'),
    matches: readdirSync(`${sourceDir}/matches`).filter(name => name.endsWith('.json')).map(name => read<Match>(`matches/${name}`)),
  })

  /** Every name a source file carries, found by where names live in the data rather than by the anonymizer's own rules. */
  function originals({ week, matches }: DemoSource) {
    const found = new Set<string>([week.player as string])
    const add = (name: string) => { if (!UNKNOWN.includes(name)) found.add(name) }
    for (const match of matches) {
      add(match.player)
      for (const member of [...match.squad, ...match.team, ...(match.track ? [match.track] : [])]) add(member.name)
      for (const event of match.events) for (const name of event.detail.split(' → ')) add(name)
    }
    for (const row of week.matches as MatchRow[]) for (const member of row.squad) add(member.name)
    for (const crew of (week.crew as { label: string }[] | undefined) ?? []) add(crew.label)
    return found
  }

  it('carries none of the source names', () => {
    const data = input()
    const names = originals(data)
    expect(names.size).toBeGreaterThan(100)
    const output = { week: readJson<Week>('week.json'), matches: readdirSync(new URL('matches/', published)).map(name => readJson<Match>(`matches/${name}`)) }
    expect(leaks(output, names, placeNames(data))).toEqual([])
  })

  it('is what the script makes from it', () => {
    const made = anonymizeDemo(input())
    expect(readJson<Week>('week.json')).toEqual(made.week)
    for (const match of made.matches) expect(readJson<Match>(`matches/${encodeURIComponent(match.id)}.json`)).toEqual(match)
  })
})
