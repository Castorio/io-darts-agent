import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from '../../../modules/game-display/web/node_modules/pinia/dist/pinia.mjs';
import { EventParser } from '../../../src/core/socket/EventParser.js';
import type { MatchThrow, ParsedEvent, ThrowSegment } from '../../../src/types/index.js';
import { MOCK_BOARD_ID, createMockMatchState, mockMatchStart } from '../../mocks/autodarts-events.js';
import { useGameDisplayStore } from '../../../modules/game-display/web/src/stores/gameDisplay.js';

const T20: ThrowSegment = { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 };

function dart(segment: ThrowSegment, n: number): MatchThrow {
  return { createdAt: '', entry: 'detected', id: `t${n}`, marks: null, segment, throw: n };
}

function stateAfter(darts: number) {
  const turnScore = 60 * darts;
  return createMockMatchState({
    turnScore,
    gameScores: [501 - turnScore],
    turns: [{
      busted: false, createdAt: '', finishedAt: '', id: 'turn-1', marks: null, playerId: 'player-1-id',
      points: turnScore, round: 1, score: 501 - turnScore, throws: Array.from({ length: darts }, (_, i) => dart(T20, i + 1)), turn: 0,
    }],
  });
}

function list(r: ParsedEvent | ParsedEvent[] | null): ParsedEvent[] {
  return r === null ? [] : Array.isArray(r) ? r : [r];
}

describe('game display remaining score while throwing', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('counts every dart once, also between throw.detected and match.state', () => {
    const store = useGameDisplayStore();
    const parser = new EventParser(MOCK_BOARD_ID);
    const shown: Array<[string, number]> = [];
    const feed = (events: ParsedEvent[]) => {
      for (const e of events) {
        store.handleEvent({ type: e.type, data: e.data });
        shown.push([e.type, store.remainingScore]);
      }
    };

    feed(list(parser.parse(mockMatchStart)));
    feed(list(parser.parse(createMockMatchState({ gameScores: [501] }))));
    for (let n = 1; n <= 3; n++) {
      feed(list(parser.parse(stateAfter(n))));
    }

    // Never below the real remaining score after the darts thrown so far
    const realAfter = [501, 441, 381, 321];
    let darts = 0;
    for (const [type, value] of shown) {
      if (type === 'throw.detected') darts++;
      expect(value, `${type} after ${darts} darts`).toBeGreaterThanOrEqual(realAfter[darts]);
    }
    expect(store.remainingScore).toBe(321);
  });

  it('takes the remaining score only from Autodarts, a throw event alone changes nothing', () => {
    const store = useGameDisplayStore();
    const parser = new EventParser(MOCK_BOARD_ID);
    for (const e of list(parser.parse(mockMatchStart))) store.handleEvent({ type: e.type, data: e.data });
    for (const e of list(parser.parse(createMockMatchState({ gameScores: [501] })))) store.handleEvent({ type: e.type, data: e.data });

    store.handleEvent({ type: 'throw.detected', data: { segment: T20, throwNumber: 1, points: 60 } });
    store.handleEvent({ type: 'throw.detected', data: { segment: T20, throwNumber: 1, points: 60 } });

    expect(store.remainingScore).toBe(501);
    expect(store.currentDarts).toHaveLength(0);
  });
});
