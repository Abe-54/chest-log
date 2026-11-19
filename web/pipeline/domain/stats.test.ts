import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { ChestRegistry, ReplayIndex, ReplayMatch } from '../../../data/types';
import type { Calibration, RouteChest } from './model';
import { chestActivity, deriveWeek, localPeriods, persona, recapStats } from './stats';
import { compareRoute, densestArea, planRoutes, recommendDrop } from './planner';
import { atTime, distance, isChest, project, trackPaths } from './replay';

const json = <T,>(path: string) => JSON.parse(readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')) as T;
// The numbers below were checked against the replays recorded before this cutoff. The tracker keeps adding
// matches to data/, so the tests read only those replays and new games can't move them.
const ARCHIVE_END = '2026-11-18T12:00:00Z';
const full = json<ReplayIndex>('data/index.json');
const archived = full.matches.filter(row => (row.startUtc ?? '') < ARCHIVE_END);
const realRows = archived.filter(row => !row.stub && !row.error);
const archivedChests = realRows.reduce((sum, row) => sum + (row.ownerChestCount ?? 0), 0);
const index: ReplayIndex = {
  ...full,
  matches: archived,
  week: {
    ...full.week,
    matches: archived.length,
    parsedMatches: archived.filter(row => !row.error).length,
    realMatches: realRows.length,
    stubs: archived.filter(row => row.stub).length,
    ownerChests: archivedChests,
    averagePerRealMatch: Math.round((archivedChests / realRows.length) * 1000) / 1000,
  },
};
const map = json<Calibration>('map/calibration.json');
const replays = index.matches.map(row => json<ReplayMatch>(`data/matches/${row.id}.json`));
const registry = json<ChestRegistry>('data/chests.json');
const { summary, layers } = deriveWeek(index, replays, registry, map);

describe('week from the replay archive', () => {
  test('the total and every match reconcile with the replay index', () => {
    expect(summary.total).toBe(index.week.ownerChests);
    expect(summary.total).toBe(1828);
    expect(summary.average.toFixed(2)).toBe('34.49');
    expect(summary.matches.map(row => [row.id, row.ownerChestCount]).sort())
      .toEqual(index.matches.map(row => [row.id, row.ownerChestCount]).sort());
    expect(summary.matches.find(row => row.stub)).toMatchObject({ ownerChestCount: 0, alive: null, zone: null, firstChest: null });
  });
  test('the record and attribution labels match the replay evidence', () => {
    expect(summary.matches.find(row => row.id === summary.bestId)).toMatchObject({ ownerChestCount: 81, placement: 2 });
    expect(summary.confirmedPawn).toBe(1827);
    expect(summary.nearbyLoot).toBe(1691);
    expect(summary.confidence).toEqual([{label: 'high', count: 1257}, {label: 'medium', count: 434}, {label: 'low', count: 137}]);
    expect(summary.loot[0]).toEqual({ label: 'AthenaAmmoDataBulletsLight', count: 558 });
    expect(persona(summary).title).toBe('The Steady Raider');
    expect(summary.chestWallTimes).toHaveLength(1828);
  });
  test('both time chart views preserve totals and leave the stub out', () => {
    for (const mode of ['day', 'session'] as const) {
      const groups = localPeriods(summary.matches, mode);
      expect(groups.flatMap(group => group.rows)).toHaveLength(53);
      expect(groups.reduce((total, group) => total + group.count, 0)).toBe(1828);
    }
  });
  test('landings are covered once and a real best run points back to its match', () => {
    expect(layers.landings).toHaveLength(53);
    expect(layers.trails).toHaveLength(53);
    expect(summary.zones.reduce((total, zone) => total + zone.matches, 0)).toBe(53);
    expect(summary.routeTiming.speed).toBeCloseTo(7.39, 2);
    expect(summary.routeTiming.openSeconds).toBeCloseTo(2.83, 2);
    for (const zone of summary.zones) {
      let previousStops = 0;
      for (const [i, { best, budget, suggested, average }] of zone.windows.entries()) {
        const matches = summary.matches.filter(row => row.zone === zone.name);
        const counts = matches.map(row => row.early?.[i] ?? 0);
        expect(best?.count).toBe(Math.max(...counts));
        expect(average).toBe(counts.reduce((sum, count) => sum + count, 0) / matches.length);
        expect(matches.some(row => row.id === best?.matchId)).toBe(true);
        expect(suggested?.seconds).toBeLessThanOrEqual(budget);
        expect(suggested?.stops.length).toBeGreaterThanOrEqual(previousStops);
        expect(suggested?.stops.every(stop => stop.appeared >= 2)).toBe(true);
        previousStops = suggested!.stops.length;
      }
    }
  });
});

const candidate = (id: string, x: number, appeared: number): RouteChest =>
  ({ id, position: [x, 0, 0], appeared, ownerSearches: 1 });

test('a route visits each chest once, avoids backtracking, and accounts for travel and opening time', () => {
  const timing = { speed: 5, openSeconds: 3, recordings: 6, speedSamples: 10, openSamples: 5 };
  const options = [candidate('B', 10000, 5), candidate('A', 7000, 4), candidate('C', 20000, 3)];
  const [route] = planRoutes([0, 0, 0], options, timing);
  expect(route?.stops.map(stop => stop.id)).toEqual(['A', 'B', 'C']);
  expect(route?.distanceMetres).toBeCloseTo(200);
  expect(route?.seconds).toBeCloseTo(49);
  expect(route?.expectedChests).toBeCloseTo(2);
  expect(planRoutes([0, 0, 0], options, { ...timing, openSeconds: null })).toEqual([null, null, null]);
});

test('repeated sightings get priority when a time budget can only reach one stop', () => {
  const options = [candidate('often', 10000, 5), candidate('rarely', -10000, 2)];
  const timing = { speed: 1, openSeconds: 10, recordings: 6, speedSamples: 1, openSamples: 1 };
  const [short, medium, long] = planRoutes([0, 0, 0], options, timing);
  expect(short?.stops.map(stop => stop.id)).toEqual(['often']);
  expect(medium?.stops).toHaveLength(1);
  expect(long?.stops).toHaveLength(2);
});

test('the measured drop is the best eligible performer at each budget', () => {
  for (let i = 0; i < 3; i++) {
    const drop = recommendDrop(summary.zones, i);
    expect(drop?.name).toBe('Windmill Village');
    expect(drop?.matches).toBe(8);
    expect(drop?.windows[i].average).toBe(Math.max(...summary.zones
      .filter(zone => zone.matches >= 3).map(zone => zone.windows[i].average!)));
  }
  expect(summary.zones.slice(0, 7).every(zone => zone.matches >= 3)).toBe(true);
  const windmill = recommendDrop(summary.zones, 0)!;
  expect(compareRoute(windmill.windows[0])).toMatch(/below your average and .* below your best/);
});

test('the registry density circle may have a center between mapped chest sites', () => {
  const dense = densestArea([candidate('a', 0, 5), candidate('b', 35000, 5), candidate('c', 100000, 5)]);
  expect(dense?.count).toBe(2);
  expect(dense?.radiusMetres).toBe(200);
  const archive = summary.denseArea!;
  expect(Object.values(registry).filter(chest => isChest(chest) && chest.stableId && chest.position &&
    distance(chest.position, archive.zone.center) <= 20000.000001)).toHaveLength(archive.count);
  expect(archive.zone.windows[0].average).toBeNull();
  expect(archive.zone.windows[0].suggested?.stops.length).toBeGreaterThan(0);
});

test('recap matches the week totals and its charts account for the same observations', () => {
  const recap = recapStats(summary);
  expect(recap.total).toBe(index.week.ownerChests);
  expect(recap.average).toBeCloseTo(index.week.averagePerRealMatch!, 3);
  expect(recap.matchCount).toBe(index.week.realMatches);
  expect(recap.matches.reduce((sum, count) => sum + count, 0)).toBe(index.week.ownerChests);
  expect(recap.best?.ownerChestCount).toBe(81);
  expect(recap.bestTrail?.points).toHaveLength(77);
  expect(recap.favourite?.name).toBe('Arlong Park');
  expect(recap.favourite?.landings).toHaveLength(9);
  expect(recap.activity.dayBars).toHaveLength(6);
  expect(recap.activity.dayBars.reduce((sum, row) => sum + row.count, 0)).toBe(recap.total);
  expect(recap.activity.hourBars.reduce((sum, row) => sum + row.count, 0)).toBe(recap.total);
  expect(recap.bestOpening).toBe(14);
  expect(recap.rarest.reduce((sum, row) => sum + row.count, 0)).toBe(5);
  expect(recap.crew[0]).toEqual({ label: 'CrackvDende', count: 228 });
  expect(recap.wins).toBe(7);
  expect(recap.topFive).toBe(48);
  expect(recap.finishes.map(row => row.count)).toEqual([7, 41, 3, 2]);
  expect(recap.distanceKm).toBeCloseTo(197.6, 1);
  expect(recap.mapCrossings * recap.mapWidthKm).toBeCloseTo(recap.distanceKm);
});

test('chests across midnight count toward the day and hour they were opened', () => {
  const first = new Date(2026, 10, 16, 23, 59);
  const second = new Date(2026, 10, 17, 0, 1);
  const result = chestActivity([first.getTime(), second.getTime(), second.getTime() + 3000]);
  expect(result.hourBars).toHaveLength(24);
  expect(result.day).toEqual({ label: second.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), count: 2 });
  expect(result.hour).toEqual({ label: second.toLocaleTimeString(undefined, {hour:'numeric'}), count: 2 });
});

test('the map calibration keeps the axes and playback leaves replay gaps open', () => {
  expect(project([1000, 2000], map)).toEqual([1000 * map.pxPerUu + map.offsetX, 2000 * map.pxPerUu + map.offsetY]);
  const samples: NonNullable<ReplayMatch['ownerTrack']>['samples'] = [[0, 0, 0, 0, 0, 0], [2, 200, 400, 0, 0, 0], [15, 900, 1500, 0, 0, 0]];
  expect(atTime(samples, 1)).toEqual([100, 200, 0]);
  expect(atTime(samples, 10)).toBeNull();
  expect(trackPaths(samples)).toEqual([[[0, 0], [200, 400]], [[900, 1500]]]);
});
