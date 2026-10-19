import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WledHandler } from '../../../modules/wled/src/WledHandler.js';
import type { ParsedEvent } from '../../../src/types/index.js';

const events = {
  'player.changed': { actionType: 'solid' as const, color1: '#22c55e', usePlayerColor: true, fadeTime: 500 },
};

function event(type: string, data: Record<string, unknown> = {}): ParsedEvent {
  return { type, timestamp: Date.now(), data } as unknown as ParsedEvent;
}

describe('WLED player color after the players rotate for the next leg', () => {
  let sentColors: number[][];

  beforeEach(() => {
    sentColors = [];
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { seg?: Array<{ col?: number[][] }> };
      if (body.seg?.[0]?.col) sentColors.push(body.seg[0].col[0]);
      return { ok: true, status: 200 } as Response;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the color of the named player, not of whoever held that array position before', async () => {
    const handler = new WledHandler({ wledHost: '10.0.0.5', events });
    // Leg 1 order, enriched by the hub: fjk blue, castorio red
    await handler.handleEvent(event('match.state', {
      player: 0,
      players: [{ name: 'fjk', index: 0, color: '#3b82f6' }, { name: 'castorio', index: 1, color: '#ef4444' }],
    }));
    sentColors = [];
    // Leg 2: castorio starts at array position 0; the player change arrives
    // before the next match state, so the stored list still has the old order
    await handler.handleEvent(event('player.change', { currentPlayer: 0, playerIndex: 1, playerName: 'castorio' }));

    expect(sentColors.at(-1)).toEqual([239, 68, 68]);
  });
});
