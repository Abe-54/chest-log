import type { Actor, EventKind, Match, MatchEvent, Px, StormFrame, Track } from '~/data'
import { rgb, squadColors, type Rgb } from '../map/palette'

export interface Member { name: string; you: boolean; color: Rgb; track: Track | null }

/** The squad in its display order, each with a color of their own and their movement track when the replay has one. */
export function squadMembers(match: Match): Member[] {
  const people = match.squad.length ? match.squad : [{ name: match.player, you: true }, ...match.team.map(track => ({ name: track.name, you: false }))]
  return people.map((person, i) => ({
    name: person.name,
    you: person.you,
    color: squadColors[i] ?? rgb.mist,
    track: person.you ? match.track : match.team.find(track => track.name === person.name) ?? null,
  }))
}

/** Who is tracked when the link names nobody: the recorder. */
export const defaultTracked = (members: Member[]) => members.filter(member => member.you).map(member => member.name)

export const layerKeys = ['mine', 'team', 'others', 'containers', 'combat', 'storm', 'bus'] as const
export type LayerKey = typeof layerKeys[number]
export const layerInfo: Record<LayerKey, { label: string; color: Rgb }> = {
  mine: { label: 'My chests', color: rgb.gold },
  team: { label: 'Squad', color: rgb.kelp },
  others: { label: 'Other chests', color: rgb.coral },
  containers: { label: 'Ammo & other', color: rgb.mist },
  combat: { label: 'Fights', color: rgb.coral },
  storm: { label: 'Storm', color: rgb.storm },
  bus: { label: 'Bus', color: rgb.bone },
}

const containerKinds = new Set<EventKind>(['chest', 'rare_chest', 'ammo_box', 'container'])
const chestKinds = new Set<EventKind>(['chest', 'rare_chest'])
export const isChestEvent = (event: MatchEvent) => chestKinds.has(event.kind)
export const isMyChest = (event: MatchEvent) => isChestEvent(event) && event.actor === 'me'

const chestLayer: Record<Actor, LayerKey> = { me: 'mine', team: 'team', enemy: 'others', unknown: 'others' }

/** Which toggle owns an event; milestones are always shown. */
export function layerOf(event: MatchEvent): LayerKey | 'milestone' {
  if (chestKinds.has(event.kind)) return chestLayer[event.actor]
  if (containerKinds.has(event.kind)) return 'containers'
  if (event.kind === 'knock' || event.kind === 'elimination') return 'combat'
  if (event.kind === 'bus' || event.kind === 'jump') return 'bus'
  return 'milestone'
}

const actorColor: Record<Actor, Rgb> = { me: rgb.gold, team: rgb.kelp, enemy: rgb.coral, unknown: rgb.dim }
/** A squadmate's chest takes that squadmate's color when `colors` (name to color) is given. */
export function colorOf(event: MatchEvent, colors?: Map<string, Rgb>): Rgb {
  if (event.kind === 'knock' || event.kind === 'elimination') return event.actor === 'enemy' ? rgb.coral : rgb.bone
  if (event.kind === 'ammo_box' || event.kind === 'container') return rgb.mist
  if (event.kind === 'death') return rgb.coral
  if (layerOf(event) === 'milestone' || layerOf(event) === 'bus') return rgb.bone
  if (event.actor === 'team') return colors?.get(event.detail) ?? actorColor.team
  return actorColor[event.actor]
}
export const isSquad = (event: MatchEvent) => event.actor === 'me' || event.actor === 'team'

/** Index of the last event at or before time, or -1. Events are sorted by time. */
export function lastAtOrBefore(times: ArrayLike<number>, time: number) {
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (times[mid] <= time) lo = mid + 1
    else hi = mid
  }
  return lo - 1
}

export function positionAt(track: Track | null, time: number): Px | null {
  if (!track) return null
  for (const segment of track.segments) {
    const { t, x, y } = segment
    if (time < t[0] || time > t[t.length - 1] + 2) continue
    const i = lastAtOrBefore(t, time)
    if (i < 0) return null
    if (i >= t.length - 1) return [x[i], y[i]]
    const f = (time - t[i]) / (t[i + 1] - t[i])
    return [x[i] + (x[i + 1] - x[i]) * f, y[i] + (y[i + 1] - y[i]) * f]
  }
  return null
}

export interface Circle { center: Px; radius: number; next: boolean }
export function stormAt(frames: StormFrame[], time: number): Circle[] {
  const frame = frames.findLast(candidate => candidate.t <= time)
  if (!frame?.from) return []
  const { from, to, shrinkStart, shrinkEnd } = frame
  const f = shrinkStart !== null && shrinkEnd !== null && shrinkEnd > shrinkStart
    ? Math.max(0, Math.min(1, (time - shrinkStart) / (shrinkEnd - shrinkStart))) : 0
  const mix = (a: number, b: number) => a + (b - a) * f
  const current: Circle = to
    ? { center: [mix(from[0], to[0]), mix(from[1], to[1])], radius: mix(from[2], to[2]), next: false }
    : { center: [from[0], from[1]], radius: from[2], next: false }
  return to ? [current, { center: [to[0], to[1]], radius: to[2], next: true }] : [current]
}

export function chestTimes(match: Match) {
  return match.events.filter(isMyChest).map(event => event.t)
}
