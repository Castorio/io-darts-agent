import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventParser } from '../../../src/core/socket/EventParser.js';
import { GameDisplayHandler, type AnimationTrigger } from '../../../modules/game-display/src/index.js';
import type { MatchThrow, ParsedEvent, ThrowSegment } from '../../../src/types/index.js';
import { MOCK_BOARD_ID, createMockMatchState, mockMatchStart } from '../../mocks/autodarts-events.js';

const T20: ThrowSegment = { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 };
const T19: ThrowSegment = { bed: 'Triple', multiplier: 3, name: 'T19', number: 19 };

function dart(segment: ThrowSegment, n: number): MatchThrow {
  return { createdAt: '', entry: 'detected', id: `t${n}`, marks: null, segment, throw: n };
}

function stateWith(segments: ThrowSegment[], extra: Record<string, unknown> = {}) {
  const turnScore = segments.reduce((sum, s) => sum + s.number * s.multiplier, 0);
  return createMockMatchState({
    turnScore,
    turns: [{
      busted: false, createdAt: '', finishedAt: '', id: 'turn', marks: null, playerId: 'player-1-id',
      points: turnScore, round: 1, score: 501 - turnScore, throws: segments.map((s, i) => dart(s, i + 1)), turn: 0,
    }],
    ...extra,
  });
}

function asList(r: ParsedEvent | ParsedEvent[] | null): ParsedEvent[] {
  return r === null ? [] : Array.isArray(r) ? r : [r];
}

describe('Game Display high score animation', () => {
  let triggers: AnimationTrigger[];
  let handler: GameDisplayHandler;
  let parser: EventParser;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    triggers = [];
    handler = new GameDisplayHandler({
      animations: { enabled: true, highScore: { enabled: true, threshold: 100 } },
    } as never);
    handler.onEvent((_e, trigger) => { if (trigger) triggers.push(trigger); });
    parser = new EventParser(MOCK_BOARD_ID);
    parser.parse(mockMatchStart);
    parser.parse(createMockMatchState());
  });

  afterEach(() => vi.restoreAllMocks());

  async function feed(r: ParsedEvent | ParsedEvent[] | null): Promise<void> {
    for (const e of asList(r)) await handler.handleEvent(e);
  }

  it('fires once per turn even when the running total passes the threshold before the third dart', async () => {
    await feed(parser.parse(stateWith([T20])));
    await feed(parser.parse(stateWith([T20, T20])));
    await feed(parser.parse(stateWith([T20, T20, T19])));
    const highScores = triggers.filter((t) => t.type === 'highScore');
    expect(highScores).toHaveLength(1);
  });

  it('does not fire for a turn below the threshold', async () => {
    const S1: ThrowSegment = { bed: 'SingleInner', multiplier: 1, name: 'S1', number: 1 };
    await feed(parser.parse(stateWith([T20])));
    await feed(parser.parse(stateWith([T20, S1])));
    await feed(parser.parse(stateWith([T20, S1, S1])));
    expect(triggers.filter((t) => t.type === 'highScore')).toHaveLength(0);
  });

  it('keeps the 180 animation and does not add a high score for it', async () => {
    await feed(parser.parse(stateWith([T20])));
    await feed(parser.parse(stateWith([T20, T20])));
    await feed(parser.parse(stateWith([T20, T20, T20])));
    expect(triggers.map((t) => t.type).filter((t) => t === '180' || t === 'highScore')).toEqual(['180']);
  });
});
