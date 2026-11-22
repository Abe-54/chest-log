import type { MatchRow } from '../../../data/types';

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
/** A place the player landed, named for the nearest point of interest. */
export interface Zone {
  name: string;
  matches: number;
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
  kinds: Tally[];
  classes: Tally[];
  confidence: Tally[];
  loot: Tally[];
  rarity: Tally[];
  unknownWeaponRarity: number;
  zones: Zone[];
  calibration: Calibration;
}
