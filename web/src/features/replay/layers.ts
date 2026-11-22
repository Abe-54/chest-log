import { useMemo } from 'react'
import { useSelector } from '@tanstack/react-store'
import { LineLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { TripsLayer } from '@deck.gl/geo-layers'
import { DataFilterExtension, type DataFilterExtensionProps } from '@deck.gl/extensions'
import type { Match, MatchEvent, Px, Track } from '~/data'
import { alpha, rgb } from '../map/palette'
import { colorOf, layerOf, positionAt, stormAt, type LayerKey, type Member } from './model'
import type { PlaybackStore } from './playback'

interface Trip { path: Px[]; timestamps: number[] }
const trips = (track: Track | null): Trip[] => track?.segments.map(segment => ({
  path: segment.x.map((x, i) => [x, segment.y[i]] as Px),
  timestamps: segment.t,
})) ?? []
const timeFilter = new DataFilterExtension({ filterSize: 1 })

interface Runner { member: Member; segments: Trip[]; key: string }
interface Dot { p: Px; member: Member; tracked: boolean }
const label = 'Barlow, system-ui, sans-serif'

/**
 * Tracked players draw their whole trail so far, a faint ghost of the rest, and a name label. Everyone else in the
 * squad draws a short fading trail, which the Squad layer toggle hides.
 */
export function useReplayLayers(match: Match, store: PlaybackStore, visible: Set<LayerKey>, events: MatchEvent[], selected: MatchEvent | null,
  members: Member[], tracked: Set<string>) {
  const time = useSelector(store, state => state.time)
  const runners = useMemo(() => members.map((member, i): Runner => ({ member, segments: trips(member.track), key: String(i) })), [members])
  const colors = useMemo(() => new Map(members.map(member => [member.name, member.color])), [members])
  const placed = useMemo(() => events.filter(event => event.p), [events])
  const ownerEnd = match.end

  const stable = useMemo(() => {
    const ghosts = runners.filter(runner => tracked.has(runner.member.name)).map(({ member, segments, key }) => new PathLayer<Trip>({
      id: `ghost-${key}`, data: segments, getPath: d => d.path, getColor: alpha(member.you ? rgb.bone : member.color, 0.16),
      widthUnits: 'pixels', getWidth: 2, capRounded: true, jointRounded: true,
    }))
    const bus = match.bus && new LineLayer<[Px, Px]>({
      id: 'bus', data: [match.bus], getSourcePosition: d => d[0], getTargetPosition: d => d[1],
      getColor: alpha(rgb.bone, 0.5), getWidth: 1.5,
    })
    return { ghosts, bus }
  }, [match, runners, tracked])

  return useMemo(() => {
    const now = (member: Member) => member.you ? Math.min(time, ownerEnd) : time
    const shown = runners
      .filter(({ member }) => tracked.has(member.name) || member.you || visible.has('team'))
      .toSorted((a, b) => Number(tracked.has(a.member.name)) - Number(tracked.has(b.member.name)) || Number(a.member.you) - Number(b.member.you))
    const trails = shown.map(({ member, segments, key }) => {
      const whole = tracked.has(member.name)
      return new TripsLayer<Trip>({
        id: `trail-${key}`, data: segments, getPath: d => d.path, getTimestamps: d => d.timestamps,
        currentTime: now(member), trailLength: whole ? 1e6 : 45, fadeTrail: !whole,
        getColor: member.color, widthUnits: 'pixels', getWidth: whole ? (member.you ? 3.2 : 2.6) : 2, capRounded: true, jointRounded: true,
      })
    })
    const dots = shown.flatMap(({ member }): Dot[] => {
      const p = member.you && time > ownerEnd + 1 ? null : positionAt(member.track, time)
      return p ? [{ p, member, tracked: tracked.has(member.name) }] : []
    })
    const storm = visible.has('storm') ? stormAt(match.storm, time) : []
    const marks = new ScatterplotLayer<MatchEvent, DataFilterExtensionProps<MatchEvent>>({
      id: 'events', data: placed, getPosition: d => d.p!, pickable: true,
      getFillColor: d => colorOf(d, colors), getLineColor: rgb.ink, stroked: true, lineWidthUnits: 'pixels', getLineWidth: d => d.actor === 'me' ? 2 : 1.5,
      radiusUnits: 'pixels', getRadius: d => layerOf(d) === 'milestone' ? 6.5 : d.actor === 'me' ? 6 : 3.8,
      extensions: [timeFilter], getFilterValue: d => d.t, filterRange: [-1, time + 0.001],
      updateTriggers: { getFillColor: colors },
    })
    return [
      ...(visible.has('storm') ? [new ScatterplotLayer<(typeof storm)[number]>({
        id: 'storm', data: storm, getPosition: d => d.center, getRadius: d => d.radius, radiusUnits: 'common',
        filled: false, stroked: true, lineWidthUnits: 'pixels', getLineWidth: d => d.next ? 2 : 3,
        getLineColor: d => d.next ? alpha(rgb.bone, 0.7) : rgb.storm,
        updateTriggers: { getPosition: time, getRadius: time },
      })] : []),
      ...(visible.has('bus') && stable.bus ? [stable.bus] : []),
      ...stable.ghosts,
      ...trails,
      marks,
      ...(selected?.p ? [new ScatterplotLayer<Px>({
        id: 'selected', data: [selected.p], getPosition: d => d, radiusUnits: 'pixels', getRadius: 11,
        filled: false, stroked: true, lineWidthUnits: 'pixels', getLineWidth: 2.5, getLineColor: rgb.bone,
      })] : []),
      new ScatterplotLayer<Dot>({
        id: 'players', data: dots, getPosition: d => d.p, radiusUnits: 'pixels', getRadius: d => d.member.you ? 8 : d.tracked ? 7 : 5,
        getFillColor: d => d.member.you ? rgb.bone : d.member.color, stroked: true,
        getLineColor: d => d.member.you ? rgb.gold : rgb.ink, lineWidthUnits: 'pixels', getLineWidth: d => d.member.you ? 4 : 2.5,
      }),
      new TextLayer<Dot>({
        id: 'names', data: dots.filter(dot => dot.tracked), getPosition: d => d.p, getText: d => d.member.name,
        characterSet: 'auto', fontFamily: label, fontWeight: 600, getSize: 12, sizeUnits: 'pixels',
        getColor: d => d.member.color, getPixelOffset: [0, -13], getTextAnchor: 'middle', getAlignmentBaseline: 'bottom',
        background: true, getBackgroundColor: alpha(rgb.ink, 0.85), backgroundPadding: [5, 2, 5, 3], backgroundBorderRadius: 4,
      }),
    ]
  }, [time, runners, tracked, colors, placed, visible, selected, match, ownerEnd, stable])
}
