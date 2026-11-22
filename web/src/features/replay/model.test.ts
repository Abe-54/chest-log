import { describe, expect, it } from 'vitest'
import type { Match, MatchEvent, Track } from '~/data'
import { rgb, squadColors } from '../map/palette'
import { colorOf, defaultTracked, squadMembers } from './model'

const track = (name: string): Track => ({ name, segments: [] })
const match = (overrides: Partial<Match>) => ({
  player: 'Player', track: track('Player'), team: [track('Squadmate 1'), track('Squadmate 2')], squad: [], ...overrides,
}) as Match

describe('squad members', () => {
  it('gives each player their own color and track, you first', () => {
    const members = squadMembers(match({
      squad: [{ name: 'Player', you: true, chests: 60 }, { name: 'Squadmate 2', you: false, chests: 17 }, { name: 'Ghost', you: false, chests: 2 }],
    }))
    expect(members.map(member => [member.name, member.color, member.track?.name ?? null])).toEqual([
      ['Player', squadColors[0], 'Player'],
      ['Squadmate 2', squadColors[1], 'Squadmate 2'],
      ['Ghost', squadColors[2], null],
    ])
    expect(defaultTracked(members)).toEqual(['Player'])
  })

  it('falls back to the recorded tracks when a match has no squad list', () => {
    expect(squadMembers(match({})).map(member => member.name)).toEqual(['Player', 'Squadmate 1', 'Squadmate 2'])
  })

  it('colors a squadmate’s chest with that squadmate’s color', () => {
    const chest = { kind: 'chest', actor: 'team', detail: 'Squadmate 2' } as MatchEvent
    expect(colorOf(chest, new Map([['Squadmate 2', squadColors[2]]]))).toEqual(squadColors[2])
    expect(colorOf(chest)).toEqual(rgb.kelp)
  })
})
