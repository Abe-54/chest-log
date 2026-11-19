import type { CombatEvent, ContainerSearch, Position, TrackSample } from '../../../data/types';
import type { Calibration, Point } from './model';

export const isChest = ({ kind }: { kind: string }) => kind === 'chest' || kind === 'rare_chest';
export const isOwnerChest = (search: ContainerSearch) => search.role === 'owner' && isChest(search);
export const searchPosition = (search: ContainerSearch) => search.lootPosition ?? search.estimatedContainerPosition ?? search.openerPosition;
export const distance = (a: Point | Position, b: Point | Position) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const samplePosition = (sample: TrackSample): Position => [sample[1], sample[2], sample[3]];
export const project = ([x, y]: Point | Position, map: Calibration): Point => [x * map.pxPerUu + map.offsetX, y * map.pxPerUu + map.offsetY];
export const squadCombat = (event: CombatEvent) => event.ownerInvolved || event.teammateInvolved;

export function mapBounds(points: (Point | Position)[], padding = 0) {
  if (!points.length) return null;
  let minX = points[0][0], maxX = minX, minY = points[0][1], maxY = minY;
  for (const [x, y] of points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { x: minX - padding, y: minY - padding, width: maxX - minX + 2 * padding, height: maxY - minY + 2 * padding };
}

export function trackPaths(samples: TrackSample[], start = 0, end = Infinity, spacing = 0): Point[][] {
  const paths: Point[][] = [];
  let path: Point[] = [];
  let previous: TrackSample | undefined;
  for (const sample of samples) {
    if (sample[0] < start) continue;
    if (sample[0] > end) break;
    const point: Point = [sample[1], sample[2]];
    if (!previous || sample[0] - previous[0] > 5 || distance(point, [previous[1], previous[2]]) > 9500) {
      path = [point];
      paths.push(path);
    } else if (!spacing || distance(point, path[path.length - 1]) >= spacing) {
      path.push(point);
    }
    previous = sample;
  }
  return paths;
}

export function atTime(samples: TrackSample[], time: number): Position | null {
  let lo = 0;
  let hi = samples.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (samples[mid][0] <= time) lo = mid + 1;
    else hi = mid;
  }
  const prev = samples[lo - 1];
  if (!prev || time - prev[0] > 5) return null;
  const next = samples[lo];
  if (!next || next[0] - prev[0] > 5 || distance(samplePosition(prev), samplePosition(next)) > 9500) {
    return samplePosition(prev);
  }
  const progress = (time - prev[0]) / (next[0] - prev[0]);
  return [1, 2, 3].map(i => prev[i] + (next[i] - prev[i]) * progress) as Position;
}

const labels: Record<string, string> = {
  Tiered_Chest_Athena_C: 'Standard chest',
  AlwaysSpawn_NormalChest_C: 'Always-spawn chest',
  AlwaysSpawn_RareChest_C: 'Always-spawn rare chest',
  B_TieredChest_Relics_C: 'Relic chest',
  B_Athena_BuriedChest_Chest_C: 'Buried chest',
  Tiered_Chest_5_Child_C: 'Tier 5 chest',
  B_Delilah_TieredChest_Relics_Variant1_C: 'Relic chest variant',
  AthenaAmmoDataBulletsLight: 'Light ammo',
  AthenaAmmoDataBulletsMedium: 'Medium ammo',
  AthenaAmmoDataBulletsHeavy: 'Heavy ammo',
  AthenaAmmoDataShells: 'Shotgun shells',
  WID_Paprika_ShieldPot: 'Shield potion',
  WID_Paprika_ShieldSmall: 'Small shield potion',
  WID_Paprika_MedBox: 'Medkit',
  WID_Paprika_Bandage: 'Bandage',
  WID_Delilah_Slingshot_HarmlessThrift_Athena_UR: 'Slingshot',
  chest: 'Chest', rare_chest: 'Rare chest', ammo_box: 'Ammo box', other_container: 'Other container',
  high: 'High', medium: 'Medium', low: 'Low',
};
export const itemLabel = (value: string | null) => value === null ? 'Unresolved item' : labels[value] ??
  value.replace(/^(WID_|AGID_|Athena_)/, '').replace(/_Ore_T\d+$/, '')
    .replace(/_(C|UC|R|VR|SR|UR|M|L)$/, '').replace(/_Athena/g, '').replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');

export const rarityNames: Record<string, string> = { C: 'Common', UC: 'Uncommon', R: 'Rare', VR: 'Epic', SR: 'Legendary', UR: 'Mythic' };
export function weaponRarity(definition: string | null) {
  if (!definition || !/^WID_(Assault|Pistol|Shotgun|SMG|Sniper|LMG|Launcher|Rifle|Bow|Explosive|Melee|Delilah_Slingshot)_/i.test(definition)) return null;
  const code = definition.match(/_(UC|VR|SR|UR|C|R)(?:_|$)/)?.[1];
  return code ? rarityNames[code] : 'Unknown';
}

