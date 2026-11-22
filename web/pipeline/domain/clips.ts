import type { ContainerKind } from '../../../data/types';
import { isChest, itemLabel } from './replay';

export const clipLabels = ['Elimination', 'Down', 'Eliminated', 'Double Elimination', 'Triple Elimination', 'Multi Elimination'] as const;
export type ClipLabel = typeof clipLabels[number];

export interface ClipEvent {
  t: number;
  replayTime: number;
  type: ContainerKind | 'knock' | 'elimination' | 'death';
  role: 'by_owner' | 'on_owner';
  label: string;
}

export interface Clip {
  id: string;
  label: ClipLabel;
  matchId: string;
  localStamp: string;
  duration: number;
  replayStart: number;
  replayEnd: number;
  video: string;
  poster: string;
  events: ClipEvent[];
}

export interface ClipIndex {
  alignmentToleranceSeconds: number;
  clips: Clip[];
}

export const hasChestOpening = (clip: Clip) => clip.events.some(event => isChest({ kind: event.type }));

export function eventCaption(event: ClipEvent, player: string) {
  if (event.type === 'death') return player + ' was eliminated';
  if (event.type === 'knock' || event.type === 'elimination') {
    const [actor, target] = event.label.split(' → ');
    const verb = event.type === 'knock' ? 'knocked' : 'eliminated';
    return `${actor || 'Unknown player'} ${verb} ${target || 'an unknown player'}`;
  }
  const container = itemLabel(event.type);
  if (event.label.endsWith('_C')) return `${container} opened · No matched loot`;
  return `${container} opened · ${event.label.split(', ').map(itemLabel).join(', ')}`;
}
