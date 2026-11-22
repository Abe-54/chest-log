import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { ReplayIndex, ReplayMatch } from '../../../data/types';
import type { Calibration } from './model';
import { deriveWeek, localPeriods, weekStats } from './stats';
import { atTime, project, trackPaths } from './replay';

const json = <T,>(path: string) => JSON.parse(readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')) as T;
const map = json<Calibration>('map/calibration.json');

// The archive is this PC's own replays and is not in the repository, so its tests run only where data/ exists.
// The numbers below were checked against the replays recorded before this cutoff. The tracker keeps adding
// matches to data/, so the tests read only those replays and new games can't move them.
const archive = existsSync(new URL('../../../data/index.json', import.meta.url)) ? (() => {
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
  const replays = index.matches.map(row => json<ReplayMatch>(`data/matches/${row.id}.json`));
  return { index, summary: deriveWeek(index, replays, map) };
})() : null;

describe.skipIf(!archive)('week from the replay archive', () => {
  test('the total and every match reconcile with the replay index', () => {
    const { index, summary } = archive!;
    expect(summary.total).toBe(index.week.ownerChests);
    expect(summary.total).toBe(1828);
    expect(summary.average.toFixed(2)).toBe('34.49');
    expect(summary.matches.map(row => [row.id, row.ownerChestCount]).sort())
      .toEqual(index.matches.map(row => [row.id, row.ownerChestCount]).sort());
    expect(summary.matches.find(row => row.stub)).toMatchObject({ ownerChestCount: 0, alive: null, zone: null, firstChest: null });
  });
  test('the record and attribution labels match the replay evidence', () => {
    const { summary } = archive!;
    expect(summary.matches.find(row => row.id === summary.bestId)).toMatchObject({ ownerChestCount: 81, placement: 2 });
    expect(summary.confirmedPawn).toBe(1827);
    expect(summary.nearbyLoot).toBe(1691);
    expect(summary.confidence).toEqual([{label: 'high', count: 1257}, {label: 'medium', count: 434}, {label: 'low', count: 137}]);
    expect(summary.loot[0]).toEqual({ label: 'AthenaAmmoDataBulletsLight', count: 558 });
    expect(summary.chestWallTimes).toHaveLength(1828);
  });
  test('both time chart views preserve totals and leave the stub out', () => {
    const { summary } = archive!;
    for (const mode of ['day', 'session'] as const) {
      const groups = localPeriods(summary.matches, mode);
      expect(groups.flatMap(group => group.rows)).toHaveLength(53);
      expect(groups.reduce((total, group) => total + group.count, 0)).toBe(1828);
    }
  });
  test('every landing falls in exactly one drop zone, and each match names its zone', () => {
    const { summary } = archive!;
    expect(summary.zones.reduce((total, zone) => total + zone.matches, 0)).toBe(53);
    for (const zone of summary.zones) {
      expect(summary.matches.filter(row => row.zone === zone.name)).toHaveLength(zone.matches);
    }
  });
  test('the week stats account for the same matches as the totals', () => {
    const { summary } = archive!;
    const stats = weekStats(summary);
    expect(stats.bestOpening).toBe(14);
    expect(summary.wins).toBe(7);
    expect(summary.topFive).toBe(48);
    expect(stats.finishes.map(row => row.count)).toEqual([7, 41, 3, 2]);
    expect(summary.distanceKm).toBeCloseTo(197.6, 1);
    expect(stats.mapCrossings * stats.mapWidthKm).toBeCloseTo(summary.distanceKm);
  });
});

test('the map calibration keeps the axes and playback leaves replay gaps open', () => {
  expect(project([1000, 2000], map)).toEqual([1000 * map.pxPerUu + map.offsetX, 2000 * map.pxPerUu + map.offsetY]);
  const samples: NonNullable<ReplayMatch['ownerTrack']>['samples'] = [[0, 0, 0, 0, 0, 0], [2, 200, 400, 0, 0, 0], [15, 900, 1500, 0, 0, 0]];
  expect(atTime(samples, 1)).toEqual([100, 200, 0]);
  expect(atTime(samples, 10)).toBeNull();
  expect(trackPaths(samples)).toEqual([[[0, 0], [200, 400]], [[900, 1500]]]);
});
