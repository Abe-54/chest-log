import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { standoutClip, type ClipIndex } from './clips';

const { clips } = JSON.parse(
  readFileSync(new URL('../../../data/clips.json', import.meta.url), 'utf8'),
) as ClipIndex;

describe('standout clip', () => {
  it('prefers a triple with a chest and otherwise uses an elimination-rich chest clip', () => {
    const picked = standoutClip(clips);
    expect(picked?.id).toBe('2026.11.15_21.45.12_49');
    const preferred = { ...picked!, id: 'triple-with-chest', label: 'Triple Elimination' as const, events: [
      { t: 3, replayTime: 50, type: 'rare_chest' as const, role: 'by_owner' as const, label: 'Medkit' },
    ] };
    expect(standoutClip([...clips, preferred])).toBe(preferred);
    expect(standoutClip([])).toBeUndefined();
  });
});
