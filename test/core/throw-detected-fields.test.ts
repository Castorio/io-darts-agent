import { describe, it, expect, beforeEach } from 'vitest';
import { EventParser } from '../../src/core/socket/EventParser.js';
import type { MatchThrow, MatchTurn, ParsedEvent, ThrowSegment } from '../../src/types/index.js';
import {
  MOCK_BOARD_ID,
  createMockMatchState,
  mockMatchStart,
  mockThrowMiss,
  mockThrowS20,
  mockThrowT20,
} from '../mocks/autodarts-events.js';

const T20: ThrowSegment = { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 };
const S20: ThrowSegment = { bed: 'SingleInner', multiplier: 1, name: 'S20', number: 20 };
const S1: ThrowSegment = { bed: 'SingleOuter', multiplier: 1, name: 'S1', number: 1 };
const D16: ThrowSegment = { bed: 'Double', multiplier: 2, name: 'D16', number: 16 };
const MISS: ThrowSegment = { bed: 'Outside', multiplier: 0, name: 'Miss', number: 0 };

function dart(segment: ThrowSegment, n: number): MatchThrow {
  return {
    coords: { x: 0, y: 0 },
    createdAt: '2024-03-27T12:01:00Z',
    entry: 'detected',
    id: `throw-${n}`,
    marks: null,
    segment,
    throw: n,
  };
}

function turn(segments: ThrowSegment[], busted = false): MatchTurn {
  return {
    busted,
    createdAt: '2024-03-27T12:01:00Z',
    finishedAt: '0001-01-01T00:00:00Z',
    id: 'turn-1',
    marks: null,
    playerId: 'player-1-id',
    points: 0,
    round: 1,
    score: 0,
    throws: segments.map((s, i) => dart(s, i + 1)),
    turn: 0,
  };
}

function throwsOf(result: ParsedEvent | ParsedEvent[] | null): Array<Record<string, unknown>> {
  const list = result === null ? [] : Array.isArray(result) ? result : [result];
  return list.filter((e) => e.type === 'throw.detected').map((e) => e.data as Record<string, unknown>);
}

describe('throw.detected payload from match state', () => {
  let parser: EventParser;

  beforeEach(() => {
    parser = new EventParser(MOCK_BOARD_ID);
    parser.parse(mockMatchStart);
    parser.parse(createMockMatchState({ gameScores: [501, 501], turnScore: 0 }));
  });

  it('carries the dart points and the running turn total', () => {
    const first = throwsOf(parser.parse(createMockMatchState({ gameScores: [441, 501], turnScore: 60, turns: [turn([T20])] })));
    const second = throwsOf(parser.parse(createMockMatchState({ gameScores: [381, 501], turnScore: 120, turns: [turn([T20, T20])] })));
    const third = throwsOf(parser.parse(createMockMatchState({ gameScores: [321, 501], turnScore: 180, turns: [turn([T20, T20, T20])] })));

    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ points: 60, turnPoints: 60, busted: false });
    expect(second[0]).toMatchObject({ points: 60, turnPoints: 120, busted: false });
    expect(third[0]).toMatchObject({ points: 60, turnPoints: 180, busted: false });
  });

  it('reports a single hit with its points and a miss with 0', () => {
    const single = throwsOf(parser.parse(createMockMatchState({ turnScore: 20, turns: [turn([S20])] })));
    const miss = throwsOf(parser.parse(createMockMatchState({ turnScore: 20, turns: [turn([S20, MISS])] })));
    expect(single[0]).toMatchObject({ points: 20, turnPoints: 20 });
    expect(miss[0]).toMatchObject({ points: 0, turnPoints: 20 });
  });

  it('gives each dart its own running total when several arrive in one update', () => {
    const darts = throwsOf(parser.parse(createMockMatchState({ turnScore: 81, turns: [turn([T20, S1, S20])] })));
    expect(darts.map((d) => d.turnPoints)).toEqual([60, 61, 81]);
    expect(darts.map((d) => d.points)).toEqual([60, 1, 20]);
  });

  it('marks only the dart that caused the bust', () => {
    parser.parse(createMockMatchState({ gameScores: [40, 501], turnScore: 0, turns: [turn([])] }));
    const darts = throwsOf(parser.parse(createMockMatchState({
      gameScores: [40, 501],
      turnScore: 0,
      turnBusted: true,
      turns: [turn([S20, D16], true)],
    })));
    expect(darts.map((d) => d.busted)).toEqual([false, true]);
  });
});

describe('throw.detected payload from board events', () => {
  it('carries the dart points', () => {
    const parser = new EventParser(MOCK_BOARD_ID);
    expect(throwsOf(parser.parse(mockThrowT20))[0]).toMatchObject({ points: 60 });
    expect(throwsOf(parser.parse(mockThrowS20))[0]).toMatchObject({ points: 20 });
    expect(throwsOf(parser.parse(mockThrowMiss))[0]).toMatchObject({ points: 0 });
  });
});
