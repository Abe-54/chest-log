import type { ChestRegistryEntry, MatchRow, Position } from '../../../data/types';

export type Point = [x: number, y: number];
export interface Calibration {
  imageSize: number;
  pxPerUu: number;
  offsetX: number;
  offsetY: number;
  pois: { name: string; id: string; x: number; y: number }[];
}
export interface Tally { label: string; count: number }
export interface MatchSummary extends MatchRow {
  zone: string | null;
  alive: number | null;
  firstChest: number | null;
  early: [number, number, number] | null;
  distanceKm: number | null;
}
export interface RouteDrop {
  id: string;
  name: string;
  center: Position;
  windows: RouteWindow[];
}
export interface Zone extends RouteDrop {
  matches: number;
  pace: number | null;
  placement: number | null;
  landings: Position[];
}
export interface RouteWindow {
  budget: number;
  average: number | null;
  suggested: Suggestion | null;
  best: BestRun | null;
}
export interface RouteChest {
  id: string;
  position: Position;
  appeared: number;
  ownerSearches: number;
}
export interface Suggestion {
  start: Position;
  stops: RouteChest[];
  seconds: number;
  distanceMetres: number;
  expectedChests: number;
}
export interface BestRun {
  matchId: string;
  landedAt: number;
  start: Position;
  trail: Point[][];
  points: Position[];
  count: number;
  lastChest: number | null;
}
export interface RouteTiming {
  speed: number | null;
  speedSamples: number;
  openSeconds: number | null;
  openSamples: number;
  recordings: number;
}
export interface DenseArea {
  zone: RouteDrop;
  count: number;
  radiusMetres: number;
}
export interface ChestTrail {
  trail: Point[][];
  points: Position[];
}
export interface WeekSummary {
  player: string;
  matches: MatchSummary[];
  total: number;
  chestWallTimes: number[];
  average: number;
  pace: number | null;
  alive: number;
  wins: number;
  topFive: number;
  confirmedPawn: number;
  nearbyLoot: number;
  distanceKm: number;
  firstChestMedian: number | null;
  bestId: string | null;
  bestTrail: ChestTrail | null;
  kinds: Tally[];
  classes: Tally[];
  confidence: Tally[];
  loot: Tally[];
  rarity: Tally[];
  unknownWeaponRarity: number;
  rarestLoot: Tally[];
  teammates: Tally[];
  zones: Zone[];
  routeTiming: RouteTiming;
  denseArea: DenseArea | null;
  calibration: Calibration;
}
export interface IslandLayers {
  trails: Point[][][];
  ownerChests: Position[];
  chests: (Pick<ChestRegistryEntry, 'matchesAppeared' | 'ownerSearches' | 'teammateSearches' | 'enemySearches' | 'unattributedSearches'> & { position: Position })[];
  landings: Position[];
}

