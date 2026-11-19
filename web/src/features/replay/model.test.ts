import { describe, expect, it } from 'vitest'
import type { Match, MatchEvent, Track } from '~/data'
import { rgb, squadColors } from '../map/palette'
import { colorOf, defaultTracked, squadMembers } from './model'

const track = (name: string): Track => ({ name, segments: [] })
const match = (overrides: Partial<Match>) => ({
  player: 'LabRat124', track: track('LabRat124'), team: [track('Crack'), track('Gene')], squad: [], ...overrides,
}) as Match

describe('squad members', () => {
  it('gives each player their own color and track, you first', () => {
    const members = squadMembers(match({
      squad: [{ name: 'LabRat124', you: true, chests: 60 }, { name: 'Gene', you: false, chests: 17 }, { name: 'Ghost', you: false, chests: 2 }],
    }))
    expect(members.map(member => [member.name, member.color, member.track?.name ?? null])).toEqual([
      ['LabRat124', squadColors[0], 'LabRat124'],
      ['Gene', squadColors[1], 'Gene'],
      ['Ghost', squadColors[2], null],
    ])
    expect(defaultTracked(members)).toEqual(['LabRat124'])
  })

  it('falls back to the recorded tracks when a match has no squad list', () => {
    expect(squadMembers(match({})).map(member => member.name)).toEqual(['LabRat124', 'Crack', 'Gene'])
  })

  it('colors a squadmate’s chest with that squadmate’s color', () => {
    const chest = { kind: 'chest', actor: 'team', detail: 'Gene' } as MatchEvent
    expect(colorOf(chest, new Map([['Gene', squadColors[2]]]))).toEqual(squadColors[2])
    expect(colorOf(chest)).toEqual(rgb.kelp)
  })
})
