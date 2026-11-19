import { useMemo } from 'react'
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { Layer } from '@deck.gl/core'
import type { BestRun, Drop, Island, Planner, Px, RouteWindow, Suggestion } from '~/data'
import { IslandMap, type Bounds } from '~/features/map/island-map'
import { alpha, rgb } from '~/features/map/palette'
import { mapFrame } from '~/features/map/frame'

export type Extra = 'heat' | 'sites' | 'landings' | 'trails'
interface NumberedStop { id: string; p: Px; n: number }

const casing = { widthUnits: 'pixels', jointRounded: true, capRounded: true } as const
const ring = { radiusUnits: 'pixels', filled: false, stroked: true, lineWidthUnits: 'pixels' } as const

function boundsOf(points: Px[], pad: number): Bounds {
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]
}

function overlayLayers(island: Island, show: Set<Extra>): Layer[] {
  const layers: Layer[] = []
  if (show.has('trails')) layers.push(new PathLayer<Px[]>({ id: 'trails', data: island.trails, getPath: d => d, getColor: alpha(rgb.mist, 0.18), widthUnits: 'pixels', getWidth: 1 }))
  if (show.has('heat')) layers.push(new ScatterplotLayer<Px>({
    id: 'heat', data: island.myChests, getPosition: d => d, radiusUnits: 'pixels', getRadius: 7, getFillColor: alpha(rgb.gold, 0.22), stroked: false,
  }))
  if (show.has('sites')) layers.push(new ScatterplotLayer<Island['sites'][number]>({
    id: 'sites', data: island.sites, getPosition: d => [d[0], d[1]], radiusUnits: 'pixels', getRadius: d => 1.5 + Math.sqrt(d[2]) * 0.5,
    getFillColor: d => d[3] >= 2 ? alpha(rgb.gold, 0.85) : alpha(rgb.bone, 0.55),
  }))
  if (show.has('landings')) layers.push(new ScatterplotLayer<Px>({
    id: 'landings', data: island.landings, getPosition: d => d, ...ring, getRadius: 5, getLineWidth: 2, getLineColor: rgb.coral,
  }))
  return layers
}

function planLayers(suggestion: Suggestion, stopId?: string): Layer[] {
  const path = [suggestion.start, ...suggestion.stops.map(stop => stop.p)]
  const stops: NumberedStop[] = suggestion.stops.map((stop, i) => ({ id: stop.id, p: stop.p, n: i + 1 }))
  const selected = stops.filter(stop => stop.id === stopId)
  return [
    new PathLayer<Px[]>({ id: 'route-casing', data: [path], getPath: d => d, getColor: rgb.ink, getWidth: 7, ...casing }),
    new PathLayer<Px[]>({ id: 'route', data: [path], getPath: d => d, getColor: rgb.gold, getWidth: 3, ...casing }),
    new ScatterplotLayer<NumberedStop>({
      id: 'stops', data: stops, getPosition: d => d.p, pickable: true, radiusUnits: 'pixels', getRadius: 9,
      getFillColor: rgb.gold, stroked: true, getLineColor: rgb.ink, lineWidthUnits: 'pixels', getLineWidth: 2,
    }),
    new TextLayer<NumberedStop>({
      id: 'stop-numbers', data: stops, getPosition: d => d.p, getText: d => String(d.n),
      getSize: 11, getColor: rgb.ink, fontWeight: 800, fontFamily: 'system-ui, sans-serif', characterSet: '0123456789',
    }),
    new ScatterplotLayer<NumberedStop>({ id: 'stop-selected', data: selected, getPosition: d => d.p, ...ring, getRadius: 15, getLineWidth: 3, getLineColor: rgb.bone }),
    new ScatterplotLayer<Px>({ id: 'drop', data: [suggestion.start], getPosition: d => d, ...ring, getRadius: 11, getLineWidth: 3, getLineColor: rgb.bone }),
  ]
}

function bestLayers(best: BestRun): Layer[] {
  return [
    new PathLayer<Px[]>({ id: 'best-casing', data: best.trail, getPath: d => d, getColor: rgb.ink, getWidth: 7, ...casing }),
    new PathLayer<Px[]>({ id: 'best', data: best.trail, getPath: d => d, getColor: rgb.bone, getWidth: 3, ...casing }),
    new ScatterplotLayer<Px>({ id: 'best-chests', data: best.chests, getPosition: d => d, radiusUnits: 'pixels', getRadius: 6, getFillColor: rgb.gold, stroked: true, getLineColor: rgb.ink, lineWidthUnits: 'pixels', getLineWidth: 2 }),
    new ScatterplotLayer<Px>({ id: 'landed', data: [best.start], getPosition: d => d, ...ring, getRadius: 11, getLineWidth: 3, getLineColor: rgb.bone }),
  ]
}

function hotspotLayer(hotspot: NonNullable<Planner['hotspot']>) {
  return new ScatterplotLayer<Px>({
    id: 'hotspot', data: [hotspot.drop.center], getPosition: d => d, radiusUnits: 'common', getRadius: hotspot.radiusPx,
    filled: false, stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.5, getLineColor: alpha(rgb.kelp, 0.8),
  })
}

function framing(view: 'plan' | 'best', window: RouteWindow, drop: Drop, stopId?: string): Bounds {
  const stop = window.suggested?.stops.find(candidate => candidate.id === stopId)
  if (view === 'plan' && stop) return boundsOf([stop.p], 90)
  if (view === 'best' && window.best) return boundsOf([window.best.start, ...window.best.trail.flat()], 60)
  if (window.suggested) return boundsOf([window.suggested.start, ...window.suggested.stops.map(s => s.p)], 60)
  return boundsOf([drop.center], 60)
}

export default function RouteMap({ island, show, view, window, hotspot, drop, stopId, onStop }: {
  island?: Island; show: Set<Extra>; view: 'plan' | 'best'; window: RouteWindow
  hotspot: Planner['hotspot']; drop: Drop; stopId?: string; onStop: (id: string) => void
}) {
  const layers = useMemo(() => [
    ...(island ? overlayLayers(island, show) : []),
    ...(view === 'plan' && window.suggested ? planLayers(window.suggested, stopId) : []),
    ...(view === 'best' && window.best ? bestLayers(window.best) : []),
    ...(hotspot && drop.id === hotspot.drop.id ? [hotspotLayer(hotspot)] : []),
  ], [island, show, view, window, hotspot, drop, stopId])
  const fit = useMemo(() => framing(view, window, drop, stopId), [view, window, drop, stopId])

  return (
    <IslandMap label={`Chest route from ${drop.name}`} layers={layers} fit={fit} className={mapFrame}
      onPick={info => { const stop = info.object as NumberedStop | undefined; if (stop?.id) onStop(stop.id) }} />
  )
}
