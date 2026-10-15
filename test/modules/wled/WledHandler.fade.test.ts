import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WledHandler, type WledConfig } from '../../../modules/wled/src/WledHandler.js';
import type { ParsedEvent } from '../../../src/types/index.js';

type Payload = Record<string, unknown>;

function event(type: string, data: Record<string, unknown> = {}): ParsedEvent {
  return { type, timestamp: new Date(), raw: {} as never, data } as unknown as ParsedEvent;
}

const matchState = event('match.state', {
  player: 0,
  playerName: 'Anna',
  players: [{ name: 'Anna', index: 0, color: '#00ff00' }],
});

describe('WledHandler fade and duration handling', () => {
  let payloads: Payload[];

  beforeEach(() => {
    payloads = [];
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      payloads.push(JSON.parse(init.body) as Payload);
      return { ok: true, status: 200 } as Response;
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function handler(config: WledConfig): WledHandler {
    return new WledHandler({ wledHost: '10.0.0.5', ...config });
  }

  it('sends a legacy "5s" per-action fade as 50 transition units (5 s)', async () => {
    const h = handler({ events: { 'turn.started': { actionType: 'solid', color1: '#ff0000', fadeTime: 50 } } });
    await h.handleEvent(event('turn.started'));
    expect(payloads).toHaveLength(1);
    expect(payloads[0].tt).toBe(50);
  });

  it('sends a millisecond per-action fade as round(ms / 100)', async () => {
    const h = handler({
      fadeTimeUnit: 'ms',
      events: { 'turn.started': { actionType: 'solid', color1: '#ff0000', fadeTime: 2000 } },
    });
    await h.handleEvent(event('turn.started'));
    expect(payloads[0].tt).toBe(20);
  });

  it('uses the per-call tt field and never changes the persistent device transition', async () => {
    const h = handler({
      fadeTimeUnit: 'ms',
      events: { 'turn.started': { actionType: 'preset', presetId: 3, fadeTime: 1000 } },
    });
    await h.handleEvent(event('turn.started'));
    expect(payloads[0]).toEqual({ ps: 3, tt: 10 });
    expect('transition' in payloads[0]).toBe(false);
  });

  it('falls back to the global fadeTime in milliseconds', async () => {
    const h = handler({ fadeTime: 700, events: { 'turn.started': { actionType: 'solid', color1: '#ff0000' } } });
    await h.handleEvent(event('turn.started'));
    expect(payloads[0].tt).toBe(7);
  });

  it('sends tt 0 when the action explicitly asks for an instant change', async () => {
    const h = handler({
      fadeTime: 700,
      fadeTimeUnit: 'ms',
      events: { 'turn.started': { actionType: 'solid', color1: '#ff0000', fadeTime: 0 } },
    });
    await h.handleEvent(event('turn.started'));
    expect(payloads[0].tt).toBe(0);
  });

  it('omits tt for a legacy config that only carries the old default fadeTime 0', async () => {
    const h = handler({ fadeTime: 0, events: { 'turn.started': { actionType: 'solid', color1: '#ff0000' } } });
    await h.handleEvent(event('turn.started'));
    expect('tt' in payloads[0]).toBe(false);
  });

  it('omits tt when no fade is configured anywhere', async () => {
    const h = handler({ events: { 'turn.started': { actionType: 'solid', color1: '#ff0000' } } });
    await h.handleEvent(event('turn.started'));
    expect('tt' in payloads[0]).toBe(false);
  });

  it('migrates legacy values again when updateConfig receives an unmarked config', async () => {
    const h = handler({});
    h.updateConfig({ wledHost: '10.0.0.5', events: { 'turn.started': { actionType: 'solid', color1: '#ff0000', fadeTime: 10 } } });
    await h.handleEvent(event('turn.started'));
    expect(payloads[0].tt).toBe(10);
  });

  it('restores the player color after the action duration', async () => {
    vi.useFakeTimers();
    const h = handler({
      fadeTimeUnit: 'ms',
      events: {
        'player.changed': { actionType: 'solid', usePlayerColor: true },
        'throw.triple': { actionType: 'solid', color1: '#ff0000', duration: 2000 },
      },
    });
    await h.handleEvent(matchState);
    await h.handleEvent(event('throw.detected', { segment: { multiplier: 3, number: 20 }, points: 60 }));
    expect(payloads).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(payloads).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(payloads).toHaveLength(2);
    expect((payloads[1].seg as Array<{ col: number[][] }>)[0].col[0]).toEqual([0, 255, 0]);
  });

  it('restores the player color after an intent action with a duration', async () => {
    vi.useFakeTimers();
    const h = handler({ events: { 'player.changed': { actionType: 'solid', usePlayerColor: true } } });
    await h.handleEvent(matchState);
    await h.executeIntentAction(
      { id: 'x', source: 'other', payload: {} },
      { type: 'effect', config: { effectId: 9, duration: 1500 } },
    );
    expect(payloads).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(payloads).toHaveLength(2);
    expect((payloads[1].seg as Array<{ col: number[][] }>)[0].col[0]).toEqual([0, 255, 0]);
  });

  it('flashes without fading even when a global fade is configured', async () => {
    vi.useFakeTimers();
    const h = handler({ fadeTime: 1000 });
    const done = h.executeIntentAction(
      { id: 'x', source: 'other', payload: {} },
      { type: 'flash', config: { color: '#ffffff', duration: 200, count: 1 } },
    );
    await vi.advanceTimersByTimeAsync(200);
    await done;
    expect(payloads).toHaveLength(2);
    expect(payloads.every((p) => p.tt === 0)).toBe(true);
  });
});
