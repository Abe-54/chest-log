import type { ChestRegistry, ContainerSearch, MatchRow, Position, ReplayIndex, ReplayMatch } from '../../../data/types';
import type { BestRun, Calibration, IslandLayers, MatchSummary, RouteChest, RouteTiming, Tally, WeekSummary, Zone } from './model';
import { distance, isChest, isOwnerChest, searchPosition, trackPaths, weaponRarity } from './replay';

import { budgets, densestArea, measureRouteTiming, median, planRoutes, rankZones } from './planner';

interface Run {
  row: MatchSummary;
  match: ReplayMatch;
  chests: ContainerSearch[];
  landed: number;
  position: Position;
}
interface DropGroup {
  id: string;
  name: string;
  anchor: Position;
  runs: Run[];
}
export const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: number[]) => values.length ? sum(values) / values.length : null;
export function tally(items: Iterable<string>): Tally[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
function earlyChests(run: Run, seconds: number) {
  return run.chests.filter(chest => chest.time >= run.landed && chest.time <= run.landed + seconds);
}
function dropGroups(runs: Run[], calibration: Calibration) {
  const named: DropGroup[] = calibration.pois.map(poi => ({ id: poi.id, name: poi.name, anchor: [poi.x, poi.y, 0], runs: [] }));
  const clusters: DropGroup[] = [];
  const byAnchor = (a: DropGroup, b: DropGroup, point: Position) => distance(a.anchor, point) - distance(b.anchor, point);
  for (const run of runs) {
    const nearest = named.toSorted((a, b) => byAnchor(a, b, run.position))[0];
    let group = nearest && distance(nearest.anchor, run.position) <= 23000 ? nearest :
      clusters.filter(c => distance(c.anchor, run.position) <= 24000).sort((a, b) => byAnchor(a, b, run.position))[0];
    if (!group) {
      const n = clusters.filter(c => c.name.startsWith('Near ' + (nearest?.name ?? 'the coast'))).length;
      group = { id: 'cluster-' + clusters.length, name: 'Near ' + (nearest?.name ?? 'the coast') + (n ? ' ' + (n + 1) : ''), anchor: run.position, runs: [] };
      clusters.push(group);
    }
    group.runs.push(run);
    run.row.zone = group.name;
  }
  return [...named, ...clusters].filter(group => group.runs.length);
}

function summarizeZone(group: DropGroup, sites: RouteChest[], timing: RouteTiming): Zone {
  const bestRuns = budgets.map(budget => {
    const ranked = group.runs.map(run => ({ run, chests: earlyChests(run, budget) })).sort((a, b) =>
      b.chests.length - a.chests.length ||
      (a.chests.at(-1)?.time ?? a.run.landed) - a.run.landed - ((b.chests.at(-1)?.time ?? b.run.landed) - b.run.landed));
    const { run, chests } = ranked[0];
    const best: BestRun = {
      matchId: run.row.id, landedAt: run.landed, start: run.position, count: chests.length,
      lastChest: chests.length ? chests.at(-1)!.time - run.landed : null,
      points: chests.map(searchPosition).filter(point => point !== null),
      trail: trackPaths(run.match.ownerTrack?.samples ?? [], run.landed,
        Math.min(run.landed + budget, run.match.timings.ownerDiedOrMatchEnded), 300),
    };
    return best;
  });
  const suggestions = planRoutes(bestRuns[0].start, sites, timing);
  const minutes = sum(group.runs.map(run => run.row.alive ?? 0)) / 60;
  return {
    id: group.id, name: group.name, center: bestRuns[0].start, matches: group.runs.length,
    pace: minutes ? sum(group.runs.map(r => r.chests.length)) / minutes : null,
    placement: mean(group.runs.flatMap(r => r.row.placement ?? [])),
    landings: group.runs.map(run => run.position),
    windows: budgets.map((budget, i) => ({
      budget, average: mean(group.runs.map(run => run.row.early![i])), best: bestRuns[i], suggested: suggestions[i],
    })),
  };
}

function matchSummary(row: MatchRow, match: ReplayMatch | undefined, chests: ContainerSearch[]): MatchSummary {
  const landed = match?.timings.ownerLanded ?? null;
  const first = landed === null ? null : chests.find(chest => chest.time >= landed)?.time ?? null;
  return {
    ...row,
    ownerChestCount: match ? chests.length : row.ownerChestCount,
    zone: null,
    alive: match && landed !== null ? Math.max(0, match.timings.ownerDiedOrMatchEnded - landed) : null,
    firstChest: first === null || landed === null ? null : first - landed,
    early: landed === null ? null : budgets.map(seconds => chests.filter(c => c.time >= landed && c.time - landed <= seconds).length) as MatchSummary['early'],
    distanceKm: match?.meta.distanceTravelledCm == null ? null : match.meta.distanceTravelledCm / 100000,
  };
}

export function deriveWeek(index: ReplayIndex, replays: ReplayMatch[], registry: ChestRegistry, calibration: Calibration) {
  const byId = new Map(replays.map(match => [match.meta.id, match]));
  const runs: Run[] = [];
  const allChests: ContainerSearch[] = [];
  const chestWallTimes: number[] = [];
  const teammates: string[] = [];
  const layers: IslandLayers = { trails: [], ownerChests: [], chests: [], landings: [] };
  const matches = index.matches.toSorted((a, b) => (a.startUtc ?? '').localeCompare(b.startUtc ?? '')).map(row => {
    const match = byId.get(row.id);
    const chests = (match?.searches ?? []).filter(isOwnerChest).sort((a, b) => a.time - b.time);
    const summary = matchSummary(row, match, chests);
    if (!match || row.stub || row.error) return summary;
    allChests.push(...chests);
    const recordingStart = row.startUtc ? Date.parse(row.startUtc) : NaN;
    if (Number.isFinite(recordingStart)) {
      chestWallTimes.push(...chests.map(chest => recordingStart + Math.round(chest.time * 1000)));
    }
    teammates.push(...match.searches.flatMap(s => s.role === 'teammate' && s.opener && isChest(s) ? [s.opener] : []));
    layers.trails.push(trackPaths(match.ownerTrack?.samples ?? [], match.timings.ownerLanded ?? 0, match.timings.ownerDiedOrMatchEnded, 450));
    layers.ownerChests.push(...chests.map(searchPosition).filter(p => p !== null));
    const { ownerLanded, landingPosition } = match.timings;
    if (ownerLanded !== null && landingPosition) {
      layers.landings.push(landingPosition);
      runs.push({ row: summary, match, chests, landed: ownerLanded, position: landingPosition });
    }
    return summary;
  });
  for (const chest of Object.values(registry)) {
    if (chest.position && isChest(chest)) layers.chests.push({ ...chest, position: chest.position });
  }
  const real = matches.filter(row => !row.stub && !row.error);
  const alive = sum(real.flatMap(row => row.alive ?? []));
  const total = allChests.length;
  const routeTiming = measureRouteTiming(replays, index.week.parsedMatches);
  const sites = Object.entries(registry).flatMap(([id, chest]) => chest.stableId && chest.position && isChest(chest) ? [
    { id, position: chest.position, appeared: chest.matchesAppeared, ownerSearches: chest.ownerSearches },
  ] : []);
  const zones = rankZones(dropGroups(runs, calibration).map(group => summarizeZone(group, sites, routeTiming)),
    zone => zone.windows[0].average, true, true);
  const density = densestArea(sites);
  const closest = density && calibration.pois.toSorted((a, b) =>
    distance(density.position, [a.x, a.y]) - distance(density.position, [b.x, b.y]))[0];
  const denseArea = density ? {
    count: density.count, radiusMetres: density.radiusMetres,
    zone: {
      id: 'registry-density', name: closest ? 'Near ' + closest.name : 'Registry hotspot', center: density.position,
      windows: planRoutes(density.position, sites, routeTiming).map((suggested, i) =>
        ({ budget: budgets[i], suggested, average: null, best: null })),
    },
  } : null;
  const bestId = real.toSorted((a, b) => (b.ownerChestCount ?? 0) - (a.ownerChestCount ?? 0))[0]?.id ?? null;
  const bestMatch = bestId ? byId.get(bestId) : undefined;
  const bestTrail = bestMatch ? {
    trail: trackPaths(bestMatch.ownerTrack?.samples ?? [], bestMatch.timings.ownerLanded ?? 0,
      bestMatch.timings.ownerDiedOrMatchEnded, 250),
    points: bestMatch.searches.filter(isOwnerChest).map(searchPosition).filter(point => point !== null),
  } : null;
  const loot = allChests.flatMap(chest => chest.loot.map(item => item.definition));
  const rarities = tally(loot.map(weaponRarity).filter(value => value !== null));
  const highestRarity = rarityOrder.findLast(label => rarities.some(rarity => rarity.label === label));
  const summary: WeekSummary = {
    player: replays.find(replay => replay.meta.owner)?.meta.owner ?? 'You',
    matches, total, chestWallTimes, average: real.length ? total / real.length : 0,
    pace: alive > 0 ? sum(real.filter(row => row.alive !== null).map(row => row.ownerChestCount ?? 0)) * 60 / alive : null,
    alive, bestId, bestTrail,
    wins: real.filter(m => m.placement === 1).length,
    topFive: real.filter(m => m.placement !== null && m.placement <= 5).length,
    confirmedPawn: allChests.filter(chest => chest.method === 'replicated_pawn').length,
    nearbyLoot: allChests.filter(chest => chest.lootPosition && chest.openerDistanceCm !== null && chest.openerDistanceCm <= 600).length,
    distanceKm: sum(real.flatMap(row => row.distanceKm ?? [])),
    firstChestMedian: median(real.flatMap(row => row.firstChest ?? [])),
    kinds: tally(allChests.map(chest => chest.kind)),
    classes: tally(allChests.map(chest => chest.class)),
    confidence: tally(allChests.map(chest => chest.confidence)),
    loot: tally(loot.filter(item => item !== null)),
    rarity: rarities.filter(value => value.label !== 'Unknown'),
    unknownWeaponRarity: rarities.find(value => value.label === 'Unknown')?.count ?? 0,
    rarestLoot: tally(loot.filter((item): item is string => item !== null && weaponRarity(item) === highestRarity)),
    teammates: tally(teammates), zones, routeTiming, denseArea, calibration,
  };
  return { summary, layers };
}

export interface MatchPeriod {
  label: string;
  rows: MatchSummary[];
  count: number;
}
const dayKey = (date: string) => new Date(date).toDateString();
export const localDate = (date: string | null) => date ? new Date(date).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}) : 'Unknown time';
export function localPeriods(rows: MatchSummary[], mode: 'day' | 'session'): MatchPeriod[] {
  const periods: MatchPeriod[] = [];
  let previous: string | null = null;
  for (const row of rows) {
    if (row.stub || row.error || !row.startUtc) continue;
    const newPeriod = !previous || (mode === 'day' ? dayKey(row.startUtc) !== dayKey(previous) :
      Date.parse(row.startUtc) - Date.parse(previous) - ((periods.at(-1)?.rows.at(-1)?.duration ?? 0) * 1000) > 45 * 60 * 1000);
    if (newPeriod) periods.push({
      label: mode === 'day' ? new Date(row.startUtc).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : localDate(row.startUtc),
      rows: [], count: 0,
    });
    const period = periods.at(-1)!;
    period.rows.push(row);
    period.count += row.ownerChestCount ?? 0;
    previous = row.startUtc;
  }
  return periods;
}
export function chestActivity(timestamps: number[], dates: string[] = []) {
  const days = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const hours = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
  const dayCounts = new Map<string, number>();
  const hourCounts = Array.from({ length: 24 }, () => 0);
  const allTimes = [...timestamps, ...dates.map(date => Date.parse(date))];
  if (allTimes.length) {
    const day = new Date(Math.min(...allTimes));
    day.setHours(0, 0, 0, 0);
    const last = Math.max(...allTimes);
    while (day.getTime() <= last) {
      dayCounts.set(days.format(day), 0);
      day.setDate(day.getDate() + 1);
    }
  }
  for (const time of timestamps) {
    const label = days.format(time);
    dayCounts.set(label, (dayCounts.get(label) ?? 0) + 1);
    hourCounts[new Date(time).getHours()]++;
  }
  const dayBars = Array.from(dayCounts, ([label, count]) => ({ label, count }));
  const hourBars = hourCounts.map((count, hour) => ({ label: hours.format(new Date(2000, 0, 1, hour)), count }));
  return {
    dayBars, hourBars,
    day: dayBars.reduce<Tally | undefined>((peak, entry) => entry.count > (peak?.count ?? 0) ? entry : peak, undefined),
    hour: hourBars.reduce<Tally | undefined>((peak, entry) => entry.count > (peak?.count ?? 0) ? entry : peak, undefined),
  };
}
export function persona(week: WeekSummary) {
  const early = week.matches.flatMap(match => match.early?.[0] ?? []);
  const opening = mean(early) ?? 0;
  if (opening >= 8) return { title: 'The First Mate', detail: `You averaged ${opening.toFixed(1)} chests in your first two minutes on the ground.` };
  if (week.pace !== null && week.pace >= 2) return { title: 'The Steady Raider', detail: `You kept up ${week.pace.toFixed(2)} chests per minute from touchdown to the end of your runs.` };
  return { title: 'The Island Scout', detail: `Your match stats logged ${week.distanceKm.toFixed(1)} km of island travel.` };
}

export function recapStats(week: WeekSummary) {
  const real = week.matches.filter(row => !row.stub && !row.error);
  const best = real.find(row => row.id === week.bestId);
  const drops = week.zones.toSorted((a, b) => b.matches - a.matches || a.name.localeCompare(b.name)).slice(0, 5);
  const bestOpening = Math.max(0, ...real.flatMap(row => row.early?.[0] ?? []));
  const placements = real.flatMap(row => row.placement ?? []);
  const mapWidthKm = week.calibration.imageSize / week.calibration.pxPerUu / 100000;
  return {
    total: week.total, average: week.average, matchCount: real.length, matches: real.map(row => row.ownerChestCount ?? 0),
    best, bestTrail: week.bestTrail, favourite: drops[0], drops: drops.map(zone => ({ label: zone.name, count: zone.matches })),
    activity: chestActivity(week.chestWallTimes, real.flatMap(row => row.startUtc ?? [])),
    loot: week.loot.slice(0, 5), rarity: [...week.rarity.toSorted((a, b) => rarityOrder.indexOf(a.label) - rarityOrder.indexOf(b.label)),
      ...(week.unknownWeaponRarity ? [{ label: 'Unknown', count: week.unknownWeaponRarity }] : [])], rarest: week.rarestLoot,
    firstChest: week.firstChestMedian, bestOpening, pace: week.pace, persona: persona(week),
    distanceKm: week.distanceKm, mapWidthKm, mapCrossings: week.distanceKm / mapWidthKm, crew: week.teammates.slice(0, 6),
    wins: week.wins, topFive: week.topFive, finishes: [
      { label: '1st', count: week.wins },
      { label: '2nd to 5th', count: week.topFive - week.wins },
      { label: '6th to 10th', count: placements.filter(place => place >= 6 && place <= 10).length },
      { label: '11th or later', count: placements.filter(place => place >= 11).length },
      ...(real.length > placements.length ? [{ label: 'Unrecorded', count: real.length - placements.length }] : []),
    ],
  };
}

