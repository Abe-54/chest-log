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
const DRAW_SECONDS = 2.4
/** The pause between the map fading in and the route starting, shared by the CSS and the counter. */
export const ROUTE_START = 0.35
const CHIP_PAD = 18
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
  // One path per run of the track, each drawn in its own slice of the timeline, so the route reads in match order.
  const paths = runs
    .map(run => {
      const from = run[0].at / length
      const span = (run.at(-1)!.at - run[0].at) / length
      return `<path class="map-route" d="M${run.map(point => `${round(point.x)} ${round(point.y)}`).join('L')}" pathLength="1" style="--s:${(from * DRAW_SECONDS).toFixed(2)}s;--t:${Math.max(span * DRAW_SECONDS, 0.05).toFixed(2)}s"/>`
    })
    .join('')
  const chests = match.events.filter(event => (event.kind === 'chest' || event.kind === 'rare_chest') && event.actor === 'me' && event.p)
  const delays = chests.map(event => progressAt(event.t) * DRAW_SECONDS)
  const pins = chests
    .map((event, i) => `<g transform="translate(${round(event.p![0])} ${round(event.p![1])})"><polygon class="map-pin${event.kind === 'rare_chest' ? ' is-rare' : ''}" points="0,-12 12,0 0,12 -12,0" style="--d:${delays[i].toFixed(2)}s"/></g>`)
    .join('')
  const end = points.at(-1)!
  const place = match.placement === 1 ? 'Won the match' : `Finished ${ordinal(match.placement)}`
  const { x, y, size } = MAP_VIEW
  // The label reads away from the nearer edge of the view, so it never runs off the map.
  const labelLeft = end.x > x + size / 2
  // SVG text cannot be measured at build time; the display face runs about half an em per character.
  const chipWidth = Math.round(place.length * 44 * 0.56 + CHIP_PAD * 2)
  const crop = `width:${round((MAP_PX / size) * 100)}%;left:${round((-x / size) * 100)}%;top:${round((-y / size) * 100)}%`
  const times = delays.map(delay => Math.round(delay * 1000)).sort((a, b) => a - b).join(',')
  return `<div class="hero-visual" data-hero-map style="--route-start:${ROUTE_START}s">
<div class="hero-map" role="img" aria-label="${esc(`The Fortnite island map with one demo match's route drawn on it and a pin for each of its ${match.chests} chests`)}">
<img src="${image.small}" srcset="${image.small} 1024w, ${image.large} 2048w" sizes="(max-width: 767px) 180vw, 1400px" width="${MAP_PX}" height="${MAP_PX}" alt="" fetchpriority="high" decoding="async" style="${crop}">
<svg viewBox="${x} ${y} ${size} ${size}" aria-hidden="true" focusable="false">
${paths}
${pins}
<g class="map-end" transform="translate(${round(end.x)} ${round(end.y)})" style="--d:${DRAW_SECONDS}s"><circle r="11"/><g transform="translate(${labelLeft ? -(chipWidth + 22) : 22} -30)"><rect class="map-chip" width="${chipWidth}" height="60" rx="10"/><text x="${CHIP_PAD}" y="43">${esc(place)}</text></g></g>
</svg>
</div>
<p class="map-count" aria-hidden="true"><span class="map-count-n" data-times="${times}">${match.chests}</span><span class="map-count-l">chests one demo player opened in this match</span></p>
</div>`
}

/**
 * Some chests have no position in the replay, so there are fewer pins than chests; the counter scales to land on the real total.
 * Holds the hero animation until the map image is decoded, then starts the route, the pins and the counter together.
 * Without JavaScript the hero shows its finished state, because the paused rule only applies under html.js.
 */
export const mapHeroScript = `(function(){var root=document.querySelector('[data-hero-map]');if(!root)return;var img=root.querySelector('img');var n=root.querySelector('.map-count-n');var done=false;
var times=n.dataset.times.split(',').map(Number),total=times.length,chests=Number(n.textContent);var still=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!still)n.textContent='0';
function go(instant){if(done)return;done=true;if(instant||still){root.classList.add('is-ready','is-instant');n.textContent=String(chests);return}root.classList.add('is-ready');var start=performance.now()+${Math.round(ROUTE_START * 1000)};
(function tick(now){var t=now-start,c=0;while(c<total&&times[c]<=t)c++;n.textContent=String(Math.round(c*chests/total));if(c<total)requestAnimationFrame(tick)})(performance.now())}
(img.complete?Promise.resolve():img.decode()).catch(function(){}).then(function(){go(false)});setTimeout(function(){go(true)},4000)})()`

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

export const MAP_SOURCES = { small: 'island-1024.webp', large: 'island-2048.webp' } as const
export const mapSource = (file: string) => new URL(`../public/map/${file}`, import.meta.url)
