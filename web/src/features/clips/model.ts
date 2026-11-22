import type { Clip, ClipEvent } from '~/data'

export const isChestEvent = (event: ClipEvent) => event.kind === 'chest' || event.kind === 'rare_chest'
export const hasChest = (clip: Clip) => clip.events.some(isChestEvent)

export interface GalleryFilter { kind?: string; chests?: true }

/** Clips grouped by the match they came from, newest match first, each match's clips in the order they happened. */
export function galleryGroups(clips: Clip[], { kind, chests }: GalleryFilter = {}) {
  const shown = clips.filter(clip => (!kind || clip.label === kind) && (!chests || hasChest(clip)))
  return [...Map.groupBy(shown, clip => clip.matchId)]
    .map(([matchId, group]) => ({ matchId, clips: group.toSorted((a, b) => a.replayStart - b.replayStart) }))
    .toSorted((a, b) => b.clips[0].localStamp.localeCompare(a.clips[0].localStamp))
}

/** The span of a clip's timeline where an event's caption shows. Clips line up with the replay to within `tolerance` seconds. */
export function captionWindow(event: ClipEvent, tolerance: number, duration: number) {
  return { start: Math.max(0, event.t - tolerance), end: Math.min(duration, event.t + Math.max(tolerance, 2)) }
}

/** Where a clip sits among the clips of its own match, with its neighbours. */
export function matchSiblings(clips: Clip[], clip: Clip) {
  const ordered = clips.filter(other => other.matchId === clip.matchId).toSorted((a, b) => a.replayStart - b.replayStart)
  const index = ordered.findIndex(other => other.id === clip.id)
  return { index, count: ordered.length, previous: ordered[index - 1], next: ordered[index + 1] }
}
