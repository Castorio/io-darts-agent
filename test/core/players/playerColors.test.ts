import { describe, it, expect } from 'vitest';
import { assignPlayerColors, DEFAULT_PLAYER_COLORS } from '../../../src/core/players/playerColors.js';

const profiles: Record<string, string> = { castorio: '#ef4444' };
const match = async (name: string) => (profiles[name.toLowerCase()] ? { color: profiles[name.toLowerCase()] } : null);

describe('assignPlayerColors', () => {
  it('uses the profile color of known players', async () => {
    const colors = await assignPlayerColors([{ name: 'castorio', index: 1 }], match);
    expect(colors).toEqual(['#ef4444']);
  });

  it('gives a player without profile the same color in every leg, whatever the array order', async () => {
    const leg1 = await assignPlayerColors([{ name: 'fjk', index: 0 }, { name: 'castorio', index: 1 }], match);
    const leg2 = await assignPlayerColors([{ name: 'castorio', index: 1 }, { name: 'fjk', index: 0 }], match);
    expect(leg1[0]).toBe(leg2[1]);
  });

  it('never gives a player without profile a color a known player already has', async () => {
    // Red is the default for the second slot, but castorio owns red
    const colors = await assignPlayerColors([{ name: 'castorio', index: 0 }, { name: 'fjk', index: 1 }], match);
    expect(colors[0]).toBe('#ef4444');
    expect(colors[1]).not.toBe('#ef4444');
    expect(DEFAULT_PLAYER_COLORS).toContain(colors[1]);
  });

  it('keeps a color Autodarts already sent and survives a failing lookup', async () => {
    const failing = async () => { throw new Error('db down'); };
    const colors = await assignPlayerColors([{ name: 'anna', index: 0, color: '#123456' }, { name: 'ben', index: 1 }], failing);
    expect(colors[0]).toBe('#123456');
    expect(DEFAULT_PLAYER_COLORS).toContain(colors[1]);
  });

  it('ignores a color that is not a string instead of throwing', async () => {
    const colors = await assignPlayerColors([{ name: 'anna', index: 0, color: 42 as unknown as string }], match);
    expect(DEFAULT_PLAYER_COLORS).toContain(colors[0]);
  });
});
