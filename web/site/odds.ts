import { readFileSync } from 'node:fs'
import type { SourceId } from './sources.ts'

export type Treasure = { id: string; name: string; oneIn: number; hoursBoost?: number }

export const ODDS_SOURCE: SourceId = 'epic-drop-rates'

export const TREASURES = [
  { id: 'weekly-gold-outfit', name: 'Weekly Gold Outfit', oneIn: 1_562_500, hoursBoost: 7.5 },
  { id: 'pirate-shop-access', name: 'Pirate Shop Access', oneIn: 137_500, hoursBoost: 1.5 },
  { id: 'weekly-vehicle-decal', name: 'Weekly Vehicle & Decal', oneIn: 7_813, hoursBoost: 10 },
  { id: 'weekly-pickaxe-backbling', name: 'Weekly Pickaxe or Backbling', oneIn: 568 },
  { id: 'weekly-jam-track', name: 'Weekly Jam Track', oneIn: 391 },
  { id: 'weekly-loading-screen', name: 'Weekly Loading Screen', oneIn: 272 },
  { id: 'gizmo', name: 'Gizmo (any)', oneIn: 127 },
] as const satisfies readonly Treasure[]

export const ALL_TREASURES: readonly Treasure[] = TREASURES

export type TreasureId = (typeof TREASURES)[number]['id']

export const treasure = (id: TreasureId): Treasure => TREASURES.find(entry => entry.id === id)!

/**
 * Plain JavaScript shared by the build and the calculator page, so the table rendered at build time and the
 * numbers the visitor's browser recomputes come from one definition.
 * A Treasure Hours boost multiplies the per-chest chance. Epic does not spell out the formula, so this is the
 * reading the page states.
 */
export const CALC_SOURCE = `
function chanceAtLeastOne(oneIn, boost, normal, hours) {
  var p = 1 / oneIn;
  var boosted = Math.min(p * boost, 0.999999);
  return -Math.expm1(normal * Math.log1p(-p) + hours * Math.log1p(-boosted));
}
function chestsFor(target, oneIn, boost) {
  return Math.ceil(Math.log1p(-target) / Math.log1p(-(boost / oneIn)));
}
function formatPercent(chance) {
  var percent = chance * 100;
  if (percent === 0) return '0%';
  if (percent >= 99.995) return '99.99%+';
  if (percent >= 10) return percent.toFixed(1) + '%';
  if (percent >= 1) return percent.toFixed(2) + '%';
  return Number(percent.toPrecision(2)).toString() + '%';
}
function formatCount(value) {
  return Math.round(value).toLocaleString('en-US');
}
`

type CalcLib = {
  chanceAtLeastOne(oneIn: number, boost: number, normal: number, hours: number): number
  chestsFor(target: number, oneIn: number, boost: number): number
  formatPercent(chance: number): string
  formatCount(value: number): string
}

export const calc = new Function(`${CALC_SOURCE}; return { chanceAtLeastOne, chestsFor, formatPercent, formatCount }`)() as CalcLib

type DemoWeek = { total: number; team: { opened: number; broken: number }; matches: { chests: number; stub?: boolean }[] }
const demoWeek: DemoWeek = JSON.parse(readFileSync(new URL('../public/demo/week.json', import.meta.url), 'utf8'))

/**
 * The demo week the app ships with, read from its data so the landing page cannot drift from it. Treasure from a chest
 * goes to the whole squad, so the odds use the squad's chests: the player's plus the teammates' their replays saw.
 */
export const DEMO = {
  chests: demoWeek.total + demoWeek.team.opened + demoWeek.team.broken,
  bestMatch: Math.max(...demoWeek.matches.filter(match => !match.stub).map(match => match.chests)),
} as const

export const DEFAULT_CHESTS = { normal: 10_000, hours: 0 } as const

export const COMMON_COUNTS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000] as const

export const oneInText = (entry: Treasure) => `1 in ${calc.formatCount(entry.oneIn)}`

export const boostedOneIn = (entry: Treasure) => entry.oneIn / (entry.hoursBoost ?? 1)
