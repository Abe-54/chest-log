import { describe, expect, it } from 'vitest';
import { standoutClip, type Clip, type ClipEvent } from './clips';

const event = (type: ClipEvent['type'], role: ClipEvent['role'] = 'by_owner'): ClipEvent => ({ t: 3, replayTime: 50, type, role, label: type });
const clip = (id: string, label: Clip['label'], events: ClipEvent[], localStamp = '2026-11-15T21:45:12'): Clip =>
  ({ id, label, matchId: 'm', localStamp, duration: 20, replayStart: 0, replayEnd: 20, video: '', poster: '', events });

describe('standout clip', () => {
  it('prefers a triple with a chest, then a clip with a chest and the most eliminations', () => {
    const plain = clip('plain', 'Elimination', [event('elimination'), event('elimination')]);
    const chest = clip('chest', 'Elimination', [event('chest'), event('elimination')]);
    const richer = clip('richer', 'Down', [event('rare_chest'), event('elimination'), event('elimination')]);
    const triple = clip('triple', 'Triple Elimination', [event('chest')]);
    expect(standoutClip([plain, chest, richer])).toBe(richer);
    expect(standoutClip([plain, chest, richer, triple])).toBe(triple);
  });

  it('breaks ties by the earliest recording, and returns nothing for no clips', () => {
    const later = clip('b', 'Elimination', [event('chest')], '2026-11-16T10:00:00');
    const earlier = clip('a', 'Elimination', [event('chest')], '2026-11-15T10:00:00');
    expect(standoutClip([later, earlier])).toBe(earlier);
    expect(standoutClip([])).toBeUndefined();
  });
});
