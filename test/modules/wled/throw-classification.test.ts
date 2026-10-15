import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventParser } from '../../../src/core/socket/EventParser.js';
import { WledHandler } from '../../../modules/wled/src/WledHandler.js';
import type { MatchThrow, ParsedEvent, ThrowSegment } from '../../../src/types/index.js';
import { MOCK_BOARD_ID, createMockMatchState, mockMatchStart } from '../../mocks/autodarts-events.js';

const T20: ThrowSegment = { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 };
const S20: ThrowSegment = { bed: 'SingleInner', multiplier: 1, name: 'S20', number: 20 };
const MISS: ThrowSegment = { bed: 'Outside', multiplier: 0, name: 'Miss', number: 0 };

const COLORS = {
  'throw.detected': '#00ff00',
  'throw.miss': '#0000ff',
  'throw.triple': '#ffff00',
  'throw.180': '#ff0000',
} as const;

function dart(segment: ThrowSegment, n: number): MatchThrow {
  return { createdAt: '', entry: 'detected', id: `t${n}`, marks: null, segment, throw: n };
}

function stateWith(segments: ThrowSegment[], turnScore: number) {
  return createMockMatchState({
    turnScore,
    turns: [{
      busted: false, createdAt: '', finishedAt: '', id: 'turn', marks: null, playerId: 'player-1-id',
      points: turnScore, round: 1, score: 501 - turnScore, throws: segments.map((s, i) => dart(s, i + 1)), turn: 0,
    }],
  });
}

function asList(r: ParsedEvent | ParsedEvent[] | null): ParsedEvent[] {
  return r === null ? [] : Array.isArray(r) ? r : [r];
}

describe('WLED throw classification with real parser output', () => {
  let colors: number[][];
  let handler: WledHandler;
  let parser: EventParser;

  beforeEach(() => {
    colors = [];
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { seg: Array<{ col: number[][] }> };
      colors.push(body.seg[0].col[0]);
      return { ok: true, status: 200 } as Response;
    }));
    const events = Object.fromEntries(
      Object.entries(COLORS).map(([key, color]) => [key, { actionType: 'solid' as const, color1: color }]),
    );
    handler = new WledHandler({ wledHost: '10.0.0.5', events });
    parser = new EventParser(MOCK_BOARD_ID);
    parser.parse(mockMatchStart);
    parser.parse(createMockMatchState());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function feed(r: ParsedEvent | ParsedEvent[] | null): Promise<void> {
    for (const e of asList(r).filter((x) => x.type === 'throw.detected')) {
      await handler.handleEvent(e);
    }
  }

  it('treats a single hit as a normal throw, not as a miss', async () => {
    await feed(parser.parse(stateWith([S20], 20)));
    expect(colors).toEqual([[0, 255, 0]]);
  });

  it('treats a dart outside the board as a miss', async () => {
    await feed(parser.parse(stateWith([MISS], 0)));
    expect(colors).toEqual([[0, 0, 255]]);
  });

  it('fires 180 on the third triple 20', async () => {
    await feed(parser.parse(stateWith([T20], 60)));
    await feed(parser.parse(stateWith([T20, T20], 120)));
    await feed(parser.parse(stateWith([T20, T20, T20], 180)));
    expect(colors).toEqual([[255, 255, 0], [255, 255, 0], [255, 0, 0]]);
  });

  it('derives the points from the segment when the payload has none', async () => {
    await handler.handleEvent({
      type: 'throw.detected',
      timestamp: new Date(),
      raw: {} as never,
      data: { segment: S20, throwNumber: 1 },
    } as ParsedEvent);
    expect(colors).toEqual([[0, 255, 0]]);
  });

  it('falls back to the segment action when no 180 action is configured', async () => {
    handler.updateConfig({
      wledHost: '10.0.0.5',
      events: { 'throw.triple': { actionType: 'solid', color1: COLORS['throw.triple'] } },
    });
    await feed(parser.parse(stateWith([T20, T20, T20], 180)));
    expect(colors).toEqual([[255, 255, 0], [255, 255, 0], [255, 255, 0]]);
  });

  it('falls back to the segment action for a busting dart (the UI offers no bust action)', async () => {
    parser.parse(createMockMatchState({ gameScores: [40, 501] }));
    await feed(parser.parse(createMockMatchState({
      gameScores: [40, 501],
      turnBusted: true,
      turns: [{
        busted: true, createdAt: '', finishedAt: '', id: 'turn', marks: null, playerId: 'player-1-id',
        points: 0, round: 1, score: 40, throws: [dart(T20, 1)], turn: 0,
      }],
    })));
    expect(colors).toEqual([[255, 255, 0]]);
  });
});
