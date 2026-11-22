import type { ContainerSearch, MatchRow, Position, ReplayIndex, ReplayMatch } from '../../../data/types';
import type { Calibration, MatchSummary, Tally, WeekSummary, Zone } from './model';
import { distance, isOwnerChest, weaponRarity } from './replay';

/** Seconds after landing that the first-chests counts cover. */
const earlyWindows = [120, 300, 600] as const;

interface Run {
  row: MatchSummary;
  position: Position;
}
interface DropGroup {
  name: string;
  anchor: Position;
  runs: Run[];
}
export const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
function median(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2 : null;
}
export function tally(items: Iterable<string>): Tally[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
function dropGroups(runs: Run[], calibration: Calibration) {
  const named: DropGroup[] = calibration.pois.map(poi => ({ name: poi.name, anchor: [poi.x, poi.y, 0], runs: [] }));
  const clusters: DropGroup[] = [];
  const byAnchor = (a: DropGroup, b: DropGroup, point: Position) => distance(a.anchor, point) - distance(b.anchor, point);
  for (const run of runs) {
    const nearest = named.toSorted((a, b) => byAnchor(a, b, run.position))[0];
    let group = nearest && distance(nearest.anchor, run.position) <= 23000 ? nearest :
      clusters.filter(c => distance(c.anchor, run.position) <= 24000).sort((a, b) => byAnchor(a, b, run.position))[0];
    if (!group) {
      const n = clusters.filter(c => c.name.startsWith('Near ' + (nearest?.name ?? 'the coast'))).length;
      group = { name: 'Near ' + (nearest?.name ?? 'the coast') + (n ? ' ' + (n + 1) : ''), anchor: run.position, runs: [] };
      clusters.push(group);
    }
    group.runs.push(run);
    run.row.zone = group.name;
  }
  return [...named, ...clusters].filter(group => group.runs.length);
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
    early: landed === null ? null : earlyWindows.map(seconds => chests.filter(c => c.time >= landed && c.time - landed <= seconds).length) as MatchSummary['early'],
    distanceKm: match?.meta.distanceTravelledCm == null ? null : match.meta.distanceTravelledCm / 100000,
  };
}

export function deriveWeek(index: ReplayIndex, replays: ReplayMatch[], calibration: Calibration): WeekSummary {
  const byId = new Map(replays.map(match => [match.meta.id, match]));
  const runs: Run[] = [];
  const allChests: ContainerSearch[] = [];
  const chestWallTimes: number[] = [];
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
    const { ownerLanded, landingPosition } = match.timings;
    if (ownerLanded !== null && landingPosition) runs.push({ row: summary, position: landingPosition });
    return summary;
  });
  const real = matches.filter(row => !row.stub && !row.error);
  const alive = sum(real.flatMap(row => row.alive ?? []));
  const total = allChests.length;
  const zones: Zone[] = dropGroups(runs, calibration).map(group => ({ name: group.name, matches: group.runs.length }));
  const bestId = real.toSorted((a, b) => (b.ownerChestCount ?? 0) - (a.ownerChestCount ?? 0))[0]?.id ?? null;
  const loot = allChests.flatMap(chest => chest.loot.map(item => item.definition));
  const rarities = tally(loot.map(weaponRarity).filter(value => value !== null));
  return {
    player: replays.find(replay => replay.meta.owner)?.meta.owner ?? 'You',
    matches, total, chestWallTimes, average: real.length ? total / real.length : 0,
    pace: alive > 0 ? sum(real.filter(row => row.alive !== null).map(row => row.ownerChestCount ?? 0)) * 60 / alive : null,
    alive, bestId,
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
    zones, calibration,
  };
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

export function weekStats(week: WeekSummary) {
  const real = week.matches.filter(row => !row.stub && !row.error);
  const drops = week.zones.toSorted((a, b) => b.matches - a.matches || a.name.localeCompare(b.name)).slice(0, 5);
  const bestOpening = Math.max(0, ...real.flatMap(row => row.early?.[0] ?? []));
  const placements = real.flatMap(row => row.placement ?? []);
  const mapWidthKm = week.calibration.imageSize / week.calibration.pxPerUu / 100000;
  return {
    drops: drops.map(zone => ({ label: zone.name, count: zone.matches })),
    rarity: [...week.rarity.toSorted((a, b) => rarityOrder.indexOf(a.label) - rarityOrder.indexOf(b.label)),
      ...(week.unknownWeaponRarity ? [{ label: 'Unknown', count: week.unknownWeaponRarity }] : [])],
    bestOpening, mapWidthKm, mapCrossings: week.distanceKm / mapWidthKm,
    finishes: [
      { label: '1st', count: week.wins },
      { label: '2nd to 5th', count: week.topFive - week.wins },
      { label: '6th to 10th', count: placements.filter(place => place >= 6 && place <= 10).length },
      { label: '11th or later', count: placements.filter(place => place >= 11).length },
      ...(real.length > placements.length ? [{ label: 'Unrecorded', count: real.length - placements.length }] : []),
    ],
  };
}
