import { describe, expect, it } from 'vitest'
import type { Clip, ClipEvent } from '~/data'
import { captionWindow, galleryGroups, hasChest, matchSiblings } from './model'

const event = (kind: ClipEvent['kind'], t = 5): ClipEvent => ({ t, kind, mine: true, caption: kind })
const clip = (id: string, matchId: string, replayStart: number, label = 'Elimination', events: ClipEvent[] = []): Clip => ({
  id, label, matchId, localStamp: `2026-11-1${matchId}T20:00:00`, duration: 20, replayStart, replayEnd: replayStart + 20, video: '', poster: '', events,
})

const clips = [
  clip('a2', '1', 200, 'Down', [event('chest')]),
  clip('a1', '1', 100),
  clip('b1', '2', 50, 'Elimination', [event('ammo_box')]),
]

describe('clip gallery', () => {
  it('groups clips by match, newest match first and each match in replay order', () => {
    expect(galleryGroups(clips).map(group => [group.matchId, group.clips.map(c => c.id)])).toEqual([['2', ['b1']], ['1', ['a1', 'a2']]])
  })

  it('filters by label and by whether the clip holds a chest opening', () => {
    expect(galleryGroups(clips, { kind: 'Down' }).flatMap(group => group.clips.map(c => c.id))).toEqual(['a2'])
    expect(galleryGroups(clips, { chests: true }).flatMap(group => group.clips.map(c => c.id))).toEqual(['a2'])
    expect(hasChest(clips[2])).toBe(false)
  })
})

describe('clip timeline', () => {
  it('finds a clip’s neighbours inside its own match only', () => {
    const [first, second] = [clips[1], clips[0]]
    expect(matchSiblings(clips, first)).toMatchObject({ index: 0, count: 2, previous: undefined, next: second })
    expect(matchSiblings(clips, second)).toMatchObject({ index: 1, count: 2, previous: first, next: undefined })
  })

  it('keeps a caption window inside the clip', () => {
    expect(captionWindow(event('chest', 1), 3, 20)).toEqual({ start: 0, end: 4 })
    expect(captionWindow(event('chest', 19), 0, 20)).toEqual({ start: 19, end: 20 })
  })
})
