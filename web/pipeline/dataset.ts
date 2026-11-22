import type { ContainerSearch, Position, ReplayIndex, ReplayMatch, TrackSample } from '../../data/types'
import type * as Out from '../src/data'
import type { Calibration, Point } from './domain/model'
import type { ClipIndex } from './domain/clips'
import { eventCaption } from './domain/clips'
import { atTime, distance, isChest, itemLabel, mapBounds, searchPosition, trackPaths } from './domain/replay'
import { deriveWeek, weekStats } from './domain/stats'

export interface DatasetInput {
  index: ReplayIndex
  calibration: Calibration
  /** One per index row without an error. */
  replays: ReplayMatch[]
  /** Video clips lined up with replays. Only the local build has them. */
  clipIndex?: ClipIndex
  generatedAt: string
}

export interface Dataset {
  week: Out.Week
  clips: Out.Clips
  matches: Out.Match[]
}

/** Everything the app shows, derived from the extractor's output. Runs in Node for the local build and in the browser for the hosted one. */
export function buildDataset({ index, calibration, replays, clipIndex = { clips: [], alignmentToleranceSeconds: 0 }, generatedAt }: DatasetInput): Dataset {
  const summary = deriveWeek(index, replays, calibration)
  if (summary.total !== index.week.ownerChests) throw Error(`chest total ${summary.total} disagrees with index ${index.week.ownerChests}`)
  const stats = weekStats(summary)
  const player = summary.player

  const r1 = (value: number) => Math.round(value * 10) / 10
  const r2 = (value: number) => Math.round(value * 100) / 100
  const px = ([x, y]: Point | Position): Out.Px => [r1(x * calibration.pxPerUu + calibration.offsetX), r1(y * calibration.pxPerUu + calibration.offsetY)]
  const pxOrNull = (point: Position | null): Out.Px | null => point ? px(point) : null
  const radius = (value: number) => r1(value * calibration.pxPerUu)

  function track(name: string, samples: TrackSample[]): Out.Track {
    const segments: Out.Track['segments'] = []
    let previous: TrackSample | undefined
    for (const sample of samples) {
      const gap = !previous || sample[0] - previous[0] > 5 || distance([sample[1], sample[2]], [previous[1], previous[2]]) > 9500
      if (gap) segments.push({ t: [], x: [], y: [] })
      const segment = segments.at(-1)!
      const [x, y] = px([sample[1], sample[2]])
      segment.t.push(r2(sample[0]))
      segment.x.push(x)
      segment.y.push(y)
      previous = sample
    }
    return { name, segments: segments.filter(segment => segment.t.length > 1) }
  }

  const searchKind = (search: ContainerSearch): Out.EventKind =>
    search.kind === 'other_container' ? 'container' : search.kind
  const actorOf = (role: ContainerSearch['role']): Out.Actor =>
    role === 'owner' ? 'me' : role === 'teammate' ? 'team' : role === 'enemy' ? 'enemy' : 'unknown'

  function matchEvents(match: ReplayMatch): Out.MatchEvent[] {
    const samples = match.ownerTrack?.samples ?? []
    const owner = match.meta.owner ?? player
    const events: Out.MatchEvent[] = match.searches.map(search => ({
      t: r2(search.time),
      kind: searchKind(search),
      actor: actorOf(search.role),
      label: itemLabel(search.kind),
      detail: search.opener ?? 'Unknown opener',
      p: pxOrNull(searchPosition(search)),
      loot: search.loot.map(item => itemLabel(item.definition) + (item.count && item.count > 1 ? ` ×${item.count}` : '')),
      confidence: search.confidence,
    }))
    for (const event of match.combat) events.push({
      t: r2(event.time),
      kind: event.kind,
      actor: event.ownerInvolved ? 'me' : event.teammateInvolved ? 'team' : 'enemy',
      label: event.kind === 'knock' ? 'Knock' : 'Elimination',
      detail: [event.killer ?? '?', event.victim ?? '?'].join(' → '),
      p: pxOrNull(event.position),
    })
    const { timings } = match
    const milestone = (kind: Out.EventKind, t: number | null, label: string, p: Position | null) => {
      if (t !== null) events.push({ t: r2(t), kind, actor: 'me', label, detail: owner, p: pxOrNull(p) })
    }
    milestone('bus', timings.busLaunch, 'Bus launched', null)
    milestone('jump', timings.ownerLeftBus, 'Jumped', timings.ownerLeftBus === null ? null : atTime(samples, timings.ownerLeftBus))
    milestone('landed', timings.ownerLanded, 'Landed', timings.landingPosition)
    for (const t of timings.ownerReboots) milestone('reboot', t, 'Rebooted', atTime(samples, t))
    milestone('death', timings.ownerDied, 'Eliminated', timings.ownerDied === null ? null : atTime(samples, timings.ownerDied))
    milestone('end', timings.matchEnded, 'Match ended', null)
    return events.sort((a, b) => a.t - b.t)
  }

  function squadOf(match: ReplayMatch | undefined, ownerChests: number): Out.SquadMember[] {
    if (!match) return []
    const mates = new Map(match.teammateTracks.map(teammate => [teammate.name, 0]))
    for (const search of match.searches) {
      if (search.role === 'teammate' && search.opener && isChest(search)) mates.set(search.opener, (mates.get(search.opener) ?? 0) + 1)
    }
    return [
      { name: match.meta.owner ?? player, you: true, chests: ownerChests },
      ...[...mates].map(([name, chests]) => ({ name, you: false, chests })).sort((a, b) => b.chests - a.chests || a.name.localeCompare(b.name)),
    ]
  }

  const replayById = new Map(replays.map(match => [match.meta.id, match]))
  const clipsByMatch = Map.groupBy(clipIndex.clips, clip => clip.matchId)
  const media = (path: string) => '/media/' + path.replace(/^clips\//, '')

  function matchPack(match: ReplayMatch): Out.Match {
    const summaryRow = summary.matches.find(row => row.id === match.meta.id)!
    const { timings, meta } = match
    const trail = trackPaths(match.ownerTrack?.samples ?? [], timings.ownerLeftBus ?? timings.ownerLanded ?? 0, timings.ownerDiedOrMatchEnded)
    const bounds = mapBounds(trail.flat(), 3500)
    const [minX, minY] = bounds ? px([bounds.x, bounds.y]) : [0, 0]
    const [maxX, maxY] = bounds ? px([bounds.x + bounds.width, bounds.y + bounds.height]) : [0, 0]
    const circle = (center: Position | null, size: number | null): [number, number, number] | null =>
      center && size !== null ? [...px(center), radius(size)] : null
    return {
      id: meta.id,
      player: meta.owner ?? player,
      startUtc: meta.startUtc ?? '',
      duration: r2(meta.duration),
      placement: meta.placement,
      kills: meta.kills,
      chests: summaryRow.ownerChestCount ?? 0,
      zone: summaryRow.zone,
      stub: meta.stub,
      squad: squadOf(match, summaryRow.ownerChestCount ?? 0),
      playerCount: meta.playerCount,
      damageDealt: meta.damageDealt,
      landed: timings.ownerLanded,
      leftBus: timings.ownerLeftBus,
      end: r2(timings.ownerDiedOrMatchEnded),
      track: match.ownerTrack ? track(match.ownerTrack.name, match.ownerTrack.samples) : null,
      team: match.teammateTracks.map(teammate => track(teammate.name, teammate.samples)),
      events: matchEvents(match),
      storm: match.stormCircles.map(frame => ({
        t: r2(frame.time),
        from: circle(frame.lastCenter, frame.lastRadius),
        to: circle(frame.nextCenter, frame.nextRadius),
        shrinkStart: frame.shrinkStart,
        shrinkEnd: frame.shrinkEnd,
      })),
      bus: match.battleBus?.end ? [px(match.battleBus.start), px(match.battleBus.end)] : null,
      clips: (clipsByMatch.get(meta.id) ?? []).toSorted((a, b) => a.replayStart - b.replayStart).map(clip => ({
        id: clip.id, label: clip.label, start: clip.replayStart, end: clip.replayEnd, poster: media(clip.poster),
        chestCount: clip.events.filter(event => isChest({ kind: event.type })).length,
      })),
      focus: bounds ? [minX, minY, maxX, maxY] : null,
    }
  }

  const real = summary.matches.filter(row => !row.stub && !row.error)
  const realIds = new Set(real.map(row => row.id))
  const squadChests = replays.filter(match => realIds.has(match.meta.id)).flatMap(match => match.searches.filter(isChest))
  const tally = (role: 'owner' | 'teammate', broken: boolean) => squadChests.filter(search => search.role === role && search.broken === broken).length
  const week: Out.Week = {
    player,
    generatedAt,
    total: summary.total,
    opened: tally('owner', false),
    broken: tally('owner', true),
    team: { opened: tally('teammate', false), broken: tally('teammate', true) },
    average: r2(summary.average),
    realMatches: real.length,
    stubs: summary.matches.filter(row => row.stub).length,
    wins: summary.wins,
    topFive: summary.topFive,
    pace: summary.pace === null ? null : r2(summary.pace),
    distanceKm: r1(summary.distanceKm),
    mapCrossings: r1(stats.mapCrossings),
    firstChestMedian: summary.firstChestMedian === null ? null : r1(summary.firstChestMedian),
    bestOpening: stats.bestOpening,
    ammoBoxes: index.week.otherOwnerContainers.ammo_box ?? 0,
    otherContainers: index.week.otherOwnerContainers.other_container ?? 0,
    confirmedShare: summary.total ? r2(summary.confirmedPawn / summary.total) : 0,
    bestMatchId: summary.bestId,
    matches: summary.matches.filter(row => !row.error && row.startUtc).map(row => ({
      id: row.id,
      startUtc: row.startUtc!,
      duration: r2(row.duration ?? 0),
      placement: row.placement,
      kills: row.kills,
      chests: row.ownerChestCount ?? 0,
      zone: row.zone,
      alive: row.alive === null ? null : Math.round(row.alive),
      firstChest: row.firstChest === null ? null : r1(row.firstChest),
      early: row.early,
      distanceKm: row.distanceKm === null ? null : r2(row.distanceKm),
      stub: row.stub ?? false,
      clips: clipsByMatch.get(row.id)?.length ?? 0,
      squad: squadOf(replayById.get(row.id), row.ownerChestCount ?? 0),
    })),
    chestTimes: summary.chestWallTimes,
    loot: summary.loot.slice(0, 12).map(entry => ({ label: itemLabel(entry.label), count: entry.count })),
    rarity: stats.rarity,
    drops: stats.drops,
    finishes: stats.finishes,
    clipCount: clipIndex.clips.length,
  }

  const clips: Out.Clips = {
    tolerance: clipIndex.alignmentToleranceSeconds,
    clips: clipIndex.clips.map(clip => ({
      id: clip.id, label: clip.label, matchId: clip.matchId, localStamp: clip.localStamp, duration: clip.duration,
      replayStart: clip.replayStart, replayEnd: clip.replayEnd, video: media(clip.video), poster: media(clip.poster),
      events: clip.events.map(event => ({
        t: event.t,
        kind: event.type === 'other_container' ? 'container' : event.type,
        mine: event.role === 'by_owner',
        caption: eventCaption(event, player),
      })),
    })),
  }

  return { week, clips, matches: replays.map(matchPack) }
}
