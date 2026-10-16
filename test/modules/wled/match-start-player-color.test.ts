import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WledHandler } from '../../../modules/wled/src/WledHandler.js';
import type { ParsedEvent } from '../../../src/types/index.js';

// Same shape as the stored config on the board PC
const events = {
  'match.started': { actionType: 'solid' as const, color1: '#3cc421', duration: 1000, fadeTime: 500 },
  'player.changed': { actionType: 'solid' as const, color1: '#22c55e', usePlayerColor: true, fadeTime: 500 },
};

function event(type: string, data: Record<string, unknown> = {}): ParsedEvent {
  return { type, timestamp: Date.now(), data } as unknown as ParsedEvent;
}

const soloState = event('match.state', { player: 0, players: [{ name: 'castorio', index: 0 }] });

describe('WLED player color at match start (single player)', () => {
  let sentColors: number[][];

  beforeEach(() => {
    vi.useFakeTimers();
    sentColors = [];
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { seg?: Array<{ col?: number[][] }> };
      if (body.seg?.[0]?.col) sentColors.push(body.seg[0].col[0]);
      return { ok: true, status: 200 } as Response;
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('applies the player color when the first match state arrives late', async () => {
    const handler = new WledHandler({ wledHost: '10.0.0.5', events, playerColors: ['#3b82f6', '#ef4444'] });

    await handler.handleEvent(event('match.start'));
    await vi.advanceTimersByTimeAsync(8000); // the board sends the first state with the first dart
    await handler.handleEvent(soloState);
    await vi.advanceTimersByTimeAsync(100);

    expect(sentColors.at(-1)).toEqual([59, 130, 246]); // #3b82f6, player 1
  });

  it('applies it once, not on every following match state', async () => {
    const handler = new WledHandler({ wledHost: '10.0.0.5', events, playerColors: ['#3b82f6', '#ef4444'] });

    await handler.handleEvent(event('match.start'));
    await vi.advanceTimersByTimeAsync(1500);
    await handler.handleEvent(soloState);
    await vi.advanceTimersByTimeAsync(100);
    const afterFirst = sentColors.length;
    await handler.handleEvent(soloState);
    await vi.advanceTimersByTimeAsync(100);

    expect(sentColors.length).toBe(afterFirst);
  });
});
