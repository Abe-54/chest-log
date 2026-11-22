import { readFileSync } from 'node:fs'
import { esc } from './html.ts'

/**
 * The home hero: the best demo match drawn on the real island map, from the same replay data the app ships.
 * Positions are in the map image's own 2048px space, so the route and the chests land on the island without a map library.
 */

type Segment = { t: number[]; x: number[]; y: number[] }
type MatchEvent = { t: number; kind: string; actor: string; p: [number, number] | null }
type DemoMatch = { id: string; chests: number; placement: number; landed: number; track: { segments: Segment[] }; events: MatchEvent[] }
type DemoWeek = { bestMatchId: string }

const demo = (path: string) => new URL(`../public/demo/${path}`, import.meta.url)
const week: DemoWeek = JSON.parse(readFileSync(demo('week.json'), 'utf8'))
const match: DemoMatch = JSON.parse(readFileSync(demo(`matches/${week.bestMatchId}.json`), 'utf8'))

/** The square of the 2048px map the hero shows: the whole main island with ocean on every side. */
export const MAP_VIEW = { x: 470, y: 520, size: 1220 } as const
const MAP_PX = 2048

/** How long the route takes to draw on load. Each chest appears when the route reaches the moment it was opened. */
const DRAW_SECONDS = 3.2
const MIN_STEP = 7

type Point = { t: number; x: number; y: number; at: number }

function routePoints() {
  const runs: Point[][] = []
  let travelled = 0
  for (const segment of match.track.segments) {
    const run: Point[] = []
    for (let i = 0; i < segment.t.length; i++) {
      if (segment.t[i] < match.landed) continue
      const point = { t: segment.t[i], x: segment.x[i], y: segment.y[i], at: travelled }
      const last = run.at(-1)
      if (last) {
        const step = Math.hypot(point.x - last.x, point.y - last.y)
        if (step < MIN_STEP && i < segment.t.length - 1) continue
        travelled += step
        point.at = travelled
      }
      run.push(point)
    }
    if (run.length > 1) runs.push(run)
  }
  return { runs, length: travelled }
}

const round = (value: number) => Math.round(value * 10) / 10

export function mapHero(image: { small: string; large: string }) {
  const { runs, length } = routePoints()
  const points = runs.flat()
  const progressAt = (t: number) => {
    let best = points[0]
    for (const point of points) if (Math.abs(point.t - t) < Math.abs(best.t - t)) best = point
    return best.at / length
  }
  const path = runs.map(run => `M${run.map(point => `${round(point.x)} ${round(point.y)}`).join('L')}`).join('')
  const chests = match.events.filter(event => (event.kind === 'chest' || event.kind === 'rare_chest') && event.actor === 'me' && event.p)
  const pins = chests
    .map(event => `<g transform="translate(${round(event.p![0])} ${round(event.p![1])})"><polygon class="map-pin${event.kind === 'rare_chest' ? ' is-rare' : ''}" points="0,-12 12,0 0,12 -12,0" style="--d:${(progressAt(event.t) * DRAW_SECONDS).toFixed(2)}s"/></g>`)
    .join('')
  const end = points.at(-1)!
  const place = match.placement === 1 ? 'a win' : `${ordinal(match.placement)} place`
  const label = `${match.chests} chests, ${place}`
  const { x, y, size } = MAP_VIEW
  // The label reads away from the nearer edge of the view, so it never runs off the map.
  const labelLeft = end.x > x + size / 2
  const crop = `width:${round((MAP_PX / size) * 100)}%;left:${round((-x / size) * 100)}%;top:${round((-y / size) * 100)}%`
  return `<div class="hero-map" role="img" aria-label="${esc(`The Fortnite island map with one demo match's route drawn on it and a pin for each of its ${match.chests} chests`)}">
<img src="${image.small}" srcset="${image.small} 1024w, ${image.large} 2048w" sizes="(max-width: 767px) 180vw, 1400px" width="${MAP_PX}" height="${MAP_PX}" alt="" fetchpriority="high" decoding="async" style="${crop}">
<svg viewBox="${x} ${y} ${size} ${size}" aria-hidden="true" focusable="false" style="--draw:${DRAW_SECONDS}s">
<path class="map-route" d="${path}" pathLength="1"/>
${pins}
<g class="map-end" transform="translate(${round(end.x)} ${round(end.y)})" style="--d:${DRAW_SECONDS}s"><circle r="11"/><text ${labelLeft ? 'x="-24" text-anchor="end"' : 'x="24"'} y="14">${esc(label)}</text></g>
</svg>
</div>`
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

export const MAP_SOURCES = { small: 'island-1024.webp', large: 'island-2048.webp' } as const
export const mapSource = (file: string) => new URL(`../public/map/${file}`, import.meta.url)
