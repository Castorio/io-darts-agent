import { describe, it, expect, vi, afterEach } from 'vitest';
import { WledHandler } from '../../../modules/wled/src/WledHandler.js';
import type { ParsedEvent } from '../../../src/types/index.js';

const CRICKET_GAME = { variant: 'cricket', mode: 'cricket', cutThroat: false };
const X01_GAME = { variant: 'x01', mode: 'x01', cutThroat: false };
const T20 = { multiplier: 3, number: 20 };
const S19 = { multiplier: 1, number: 19 };

function buildEvents(colors: Record<string, string>): Record<string, { actionType: 'solid'; color1: string }> {
  return Object.fromEntries(
    Object.entries(colors).map(([key, color]) => [key, { actionType: 'solid' as const, color1: color }]),
  );
}

function throwEvent(data: Record<string, unknown>): ParsedEvent {
  return { type: 'throw.detected', timestamp: new Date(), data } as unknown as ParsedEvent;
}

function cricketClosedEvent(data: Record<string, unknown> = {}): ParsedEvent {
  return { type: 'cricket.closed', timestamp: new Date(), data } as unknown as ParsedEvent;
}

function matchStartEvent(): ParsedEvent {
  return { type: 'match.start', timestamp: new Date(), data: {} } as unknown as ParsedEvent;
}

describe('WLED Cricket reactions', () => {
  let colors: number[][];

  function setup(
    events: Record<string, { actionType: 'solid'; color1: string }>,
    extraConfig: Record<string, unknown> = {},
  ): WledHandler {
    colors = [];
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { seg: Array<{ col: number[][] }> };
        colors.push(body.seg[0].col[0]);
        return { ok: true, status: 200 } as Response;
      }),
    );
    return new WledHandler({ wledHost: '10.0.0.5', events, ...extraConfig });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fires the cricket.closed action when a field is closed', async () => {
    const handler = setup(buildEvents({ 'cricket.closed': '#00ffff' }));
    await handler.handleEvent(
      cricketClosedEvent({ matchId: 'm1', set: 1, leg: 1, field: '20', playerIndex: 0, playerName: 'A' }),
    );
    expect(colors).toEqual([[0, 255, 255]]);
  });

  it('fires cricket.marks once per turnId once the threshold is reached, then falls back to the normal throw action', async () => {
    const handler = setup(buildEvents({ 'cricket.marks': '#ff00ff', 'throw.triple': '#ffff00' }));
    await handler.handleEvent(throwEvent({ turnMarks: 6, turnId: 't1', game: CRICKET_GAME, segment: T20 }));
    await handler.handleEvent(throwEvent({ turnMarks: 7, turnId: 't1', game: CRICKET_GAME, segment: T20 }));
    expect(colors).toEqual([
      [255, 0, 255],
      [255, 255, 0],
    ]);
  });

  it('uses the normal throw action when no cricket.marks action is configured', async () => {
    const handler = setup(buildEvents({ 'throw.triple': '#ffff00' }));
    await handler.handleEvent(throwEvent({ turnMarks: 6, turnId: 't1', game: CRICKET_GAME, segment: T20 }));
    expect(colors).toEqual([[255, 255, 0]]);
  });

  it('respects a configured cricketMarksThreshold', async () => {
    const handler = setup(buildEvents({ 'cricket.marks': '#ff00ff', 'throw.triple': '#ffff00' }), {
      cricketMarksThreshold: 7,
    });
    await handler.handleEvent(throwEvent({ turnMarks: 6, turnId: 't1', game: CRICKET_GAME, segment: T20 }));
    expect(colors).toEqual([[255, 255, 0]]);
  });

  it('does not fire cricket.marks without a turnId', async () => {
    const handler = setup(buildEvents({ 'cricket.marks': '#ff00ff', 'throw.triple': '#ffff00' }));
    await handler.handleEvent(throwEvent({ turnMarks: 9, game: CRICKET_GAME, segment: T20 }));
    expect(colors).toEqual([[255, 255, 0]]);
  });

  it('uses throw.triple instead of throw.180 for a Cricket 180', async () => {
    const handler = setup(buildEvents({ 'throw.180': '#ff0000', 'throw.triple': '#ffff00' }));
    await handler.handleEvent(throwEvent({ turnPoints: 180, game: CRICKET_GAME, segment: T20 }));
    expect(colors).toEqual([[255, 255, 0]]);
  });

  it('does not use the bust color for a busted Cricket throw', async () => {
    const handler = setup(buildEvents({ 'throw.bust': '#ff0000', 'throw.detected': '#00ff00' }));
    await handler.handleEvent(throwEvent({ busted: true, game: CRICKET_GAME, segment: S19 }));
    expect(colors).toEqual([[0, 255, 0]]);
  });

  it('keeps X01 behavior unchanged: turnPoints 180 fires throw.180', async () => {
    const handler = setup(buildEvents({ 'throw.180': '#ff0000', 'throw.triple': '#ffff00' }));
    await handler.handleEvent(throwEvent({ turnPoints: 180, game: X01_GAME, segment: T20 }));
    expect(colors).toEqual([[255, 0, 0]]);
  });

  it('clears the strong-turn dedup on match.start, so a repeated turnId can fire again next match', async () => {
    const handler = setup(buildEvents({ 'cricket.marks': '#ff00ff' }));
    await handler.handleEvent(throwEvent({ turnMarks: 6, turnId: 't1', game: CRICKET_GAME, segment: T20 }));
    await handler.handleEvent(matchStartEvent());
    await handler.handleEvent(throwEvent({ turnMarks: 6, turnId: 't1', game: CRICKET_GAME, segment: T20 }));
    expect(colors).toEqual([
      [255, 0, 255],
      [255, 0, 255],
    ]);
  });

  it('falls back to 6 for an invalid cricketMarksThreshold config', async () => {
    const handler = setup(buildEvents({ 'cricket.marks': '#ff00ff', 'throw.triple': '#ffff00' }), {
      cricketMarksThreshold: 'not-a-number',
    });
    await handler.handleEvent(throwEvent({ turnMarks: 6, turnId: 't1', game: CRICKET_GAME, segment: T20 }));
    expect(colors).toEqual([[255, 0, 255]]);
  });
});
