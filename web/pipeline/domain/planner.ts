import type { Position, ReplayMatch } from '../../../data/types';
import { TrackFlag } from '../../../data/types';
import type { RouteChest, RouteTiming, RouteWindow, Suggestion, Zone } from './model';
import { distance, isOwnerChest, searchPosition } from './replay';

export const budgets = [120, 300, 600] as const;
export const minimumLandings = 3;
export const densityRadiusMetres = 200;
export const minimumSightings = 2;

export function median(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2 : null;
}

export function measureRouteTiming(replays: ReplayMatch[], recordings: number): RouteTiming {
  const speeds: number[] = [];
  const airborne = TrackFlag.skydiving | TrackFlag.parachute;
  const exclusions = airborne | TrackFlag.water | TrackFlag.downed | TrackFlag.vehicle;
  for (const match of replays) {
    const landed = match.timings.ownerLanded;
    if (match.meta.stub || landed === null) continue;
    const samples = match.ownerTrack?.samples ?? [];
    for (let i = 1; i < samples.length; i++) {
      const [t, x, y, z, flags, known] = samples[i];
      const [at, ax, ay, az, previousFlags, previousKnown] = samples[i - 1];
      const dt = t - at;
      if (at < landed || t > match.timings.ownerDiedOrMatchEnded || dt < 0.15 || dt > 0.75) continue;
      if (((flags | previousFlags) & exclusions) || ((known & previousKnown & airborne) !== airborne)) continue;
      if (Math.abs(z - az) / dt > 450) continue;
      const speed = Math.hypot(x - ax, y - ay) / dt / 100;
      if (speed >= 2 && speed <= 11) speeds.push(speed);
    }
  }
  const speed = median(speeds);
  const openings: number[] = [];
  if (speed !== null) for (const match of replays) {
    const landed = match.timings.ownerLanded;
    if (match.meta.stub || landed === null) continue;
    const chests = match.searches.filter(chest => isOwnerChest(chest) && chest.time >= landed &&
      chest.time <= match.timings.ownerDiedOrMatchEnded).sort((a, b) => a.time - b.time);
    for (let i = 1; i < chests.length; i++) {
      const previous = chests[i - 1];
      const chest = chests[i];
      const a = searchPosition(previous);
      const b = searchPosition(chest);
      const gap = chest.time - previous.time;
      if (previous.initialState || chest.initialState || !a || !b || gap < 0.5 || gap > 15 ||
        Math.hypot(distance(a, b), a[2] - b[2]) > 1200) continue;
      const residual = gap - distance(a, b) / 100 / speed;
      if (residual > 0) openings.push(residual);
    }
  }
  return { speed, speedSamples: speeds.length, openSeconds: median(openings), openSamples: openings.length, recordings };
}

export function planRoutes(start: Position, sites: RouteChest[], timing: RouteTiming): (Suggestion | null)[] {
  const { speed, openSeconds, recordings } = timing;
  if (!speed || !openSeconds || !recordings) return budgets.map(() => null);
  const metres = (a: Position, b: Position) => distance(a, b) / 100;
  const route: RouteChest[] = [];
  const candidates = sites.filter(site => site.appeared >= minimumSightings &&
    metres(start, site.position) / speed + openSeconds <= budgets.at(-1)!);
  const distanceOf = () => route.reduce((total, site, i) =>
    total + metres(route[i - 1]?.position ?? start, site.position), 0);
  let distanceMetres = 0;

  return budgets.map(budget => {
    while (candidates.length) {
      let best: { candidate: number; index: number; score: number } | undefined;
      for (const [candidate, site] of candidates.entries()) {
        for (let index = 0; index <= route.length; index++) {
          const a = route[index - 1]?.position ?? start;
          const b = route[index]?.position;
          const extra = metres(a, site.position) + (b ? metres(site.position, b) - metres(a, b) : 0);
          const cost = extra / speed + openSeconds;
          if ((distanceMetres + extra) / speed + openSeconds * (route.length + 1) > budget) continue;
          const score = site.appeared / cost;
          if (!best || score > best.score) best = { candidate, index, score };
        }
      }
      if (!best) break;
      route.splice(best.index, 0, candidates.splice(best.candidate, 1)[0]);
      // An open route can improve by reversing its tail without paying for a return leg.
      for (let changed = true; changed;) {
        changed = false;
        for (let i = 0; i + 1 < route.length; i++) {
          const a = route[i - 1]?.position ?? start;
          const b = route[i].position;
          for (let j = i + 1; j < route.length; j++) {
            const c = route[j].position;
            const d = route[j + 1]?.position;
            const gain = metres(a, b) - metres(a, c) + (d ? metres(c, d) - metres(b, d) : 0);
            if (gain > 0.001) {
              route.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse());
              changed = true;
              break;
            }
          }
          if (changed) break;
        }
      }
      distanceMetres = distanceOf();
    }
    return route.length ? {
      start, stops: [...route], distanceMetres, seconds: distanceMetres / speed + openSeconds * route.length,
      expectedChests: route.reduce((sum, stop) => sum + stop.appeared / recordings, 0),
    } : null;
  });
}

export function densestArea(sites: RouteChest[]) {
  const radius = densityRadiusMetres * 100;
  const turn = 2 * Math.PI;
  const normalize = (angle: number) => (angle + turn) % turn;
  let best: { position: Position; count: number; radiusMetres: number } | null = null;
  for (const { position: [x, y, z] } of sites) {
    const edges: { angle: number; change: number }[] = [];
    let count = 0;
    // A maximal circle can move until a site touches its boundary. Sweep the candidate centers around that site.
    for (const { position: [a, b] } of sites) {
      const separation = Math.hypot(a - x, b - y);
      if (separation === 0) { count++; continue; }
      if (separation > radius * 2) continue;
      const bearing = Math.atan2(b - y, a - x);
      const arc = Math.acos(separation / (2 * radius));
      const enter = normalize(bearing - arc);
      const exit = normalize(bearing + arc);
      if (exit < enter) count++;
      edges.push({ angle: enter, change: 1 }, { angle: exit, change: -1 });
    }
    if (!best || count > best.count) best = { position: [x + radius, y, z], count, radiusMetres: densityRadiusMetres };
    edges.sort((a, b) => a.angle - b.angle || b.change - a.change);
    for (const { angle, change } of edges) {
      count += change;
      if (count > best.count) {
        best = { position: [x + radius * Math.cos(angle), y + radius * Math.sin(angle), z], count, radiusMetres: densityRadiusMetres };
      }
    }
  }
  return best;
}

export function recommendDrop(zones: Zone[], budgetIndex: number) {
  return rankZones(zones, zone => zone.windows[budgetIndex].average, true, true)
    .find(zone => zone.matches >= minimumLandings) ?? null;
}

export function rankZones(zones: Zone[], value: (zone: Zone) => string | number | null, descending: boolean, sampleFirst: boolean) {
  return zones.toSorted((a, b) => {
    if (sampleFirst) {
      const sampleOrder = Number(a.matches < minimumLandings) - Number(b.matches < minimumLandings);
      if (sampleOrder) return sampleOrder;
    }
    const first = value(a);
    const second = value(b);
    if (first === null || second === null) return Number(first === null) - Number(second === null);
    const order = typeof first === 'string' ? first.localeCompare(String(second)) : first - Number(second);
    return (descending ? -order : order) || b.matches - a.matches || a.name.localeCompare(b.name);
  });
}

export function compareRoute({ average, best, suggested }: RouteWindow) {
  if (average === null || !best || !suggested) return null;
  const comparison = (recorded: number, label: string) => {
    const difference = suggested.expectedChests - recorded;
    return Math.abs(difference) < .05 ? `even with your ${label}` :
      `${Math.abs(difference).toFixed(1)} chests ${difference > 0 ? 'above' : 'below'} your ${label}`;
  };
  return `The estimate is ${comparison(average, 'average')} and ${comparison(best.count, 'best')}.`;
}
