import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from '../../../modules/game-display/web/node_modules/pinia/dist/pinia.mjs';
import { EventParser } from '../../../src/core/socket/EventParser.js';
import type { AutodartsMessage, MatchPlayer, MatchStateData, ParsedEvent } from '../../../src/types/index.js';
import { MOCK_BOARD_ID, createMockMatchState } from '../../mocks/autodarts-events.js';
import { useGameDisplayStore } from '../../../modules/game-display/web/src/stores/gameDisplay.js';

// Real sequence of an online match (2026-10-19): Bull-off, X01 leg 1 won by
// fjk, leg 2 with rotated players started by castorio
const MATCH = 'online-match';
const fjk = { id: 'p-fjk', index: 0, name: 'fjk', boardId: 'other', userId: null } as unknown as MatchPlayer;
const castorio = { id: 'p-cas', index: 1, name: 'castorio', boardId: MOCK_BOARD_ID, userId: null } as unknown as MatchPlayer;
const settings = { baseScore: 501, bullMode: '25/50', inMode: 'Straight', maxRounds: 50, outMode: 'Double' };

function state(patch: Partial<MatchStateData>): AutodartsMessage {
  const message = createMockMatchState({ id: MATCH, legs: 2, sets: null as never, settings, ...patch });
  return { ...message, topic: `${MATCH}.state` };
}
const list = (r: ParsedEvent | ParsedEvent[] | null) => (r === null ? [] : Array.isArray(r) ? r : [r]);
const noLegs = [{ legs: 0, sets: 0 }, { legs: 0, sets: 0 }] as never;

describe('game display in an online match', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ active: false }) }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function play() {
    const store = useGameDisplayStore();
    const parser = new EventParser(MOCK_BOARD_ID);
    const feed = (m: AutodartsMessage) => {
      for (const e of list(parser.parse(m))) store.handleEvent({ type: e.type, data: e.data });
    };
    feed({ channel: 'autodarts.boards', topic: `${MOCK_BOARD_ID}.matches`, data: { event: 'start', id: MATCH } });
    feed(state({ variant: 'Bull-off', players: [fjk, castorio], player: 0, gameScores: [0, 0], scores: noLegs }));
    feed(state({ variant: 'Bull-off', players: [fjk, castorio], player: 0, gameScores: [0, 0], scores: noLegs, gameFinished: true, gameWinner: 0 }));
    feed(state({ variant: 'X01', players: [fjk, castorio], player: 0, gameScores: [501, 501], scores: noLegs }));
    feed(state({ variant: 'X01', players: [fjk, castorio], player: 1, gameScores: [441, 501], scores: noLegs }));
    feed(state({ variant: 'X01', players: [fjk, castorio], player: 0, gameScores: [40, 141], scores: noLegs }));
    feed(state({
      variant: 'X01', players: [fjk, castorio], player: 0, gameScores: [0, 141],
      scores: [{ legs: 1, sets: 0 }, { legs: 0, sets: 0 }] as never, gameFinished: true, gameWinner: 0,
    }));
    vi.advanceTimersByTime(10000);
    feed(state({
      variant: 'X01', players: [castorio, fjk], player: 0, leg: 2, gameScores: [501, 501],
      scores: [{ legs: 0, sets: 0 }, { legs: 1, sets: 0 }] as never,
    }));
    return store;
  }

  it('shows castorio at the start of leg 2 although the players rotated', () => {
    const store = play();
    expect(store.activePlayer?.name).toBe('castorio');
    expect(store.remainingScore).toBe(501);
  });

  it('counts the leg fjk won', () => {
    const store = play();
    expect(store.gameState.players.find((p) => p.name === 'fjk')?.legsWon).toBe(1);
    expect(store.gameState.players.find((p) => p.name === 'castorio')?.legsWon).toBe(0);
  });

  it('shows the real match format in the game info', () => {
    const store = play();
    expect(store.gameState.legsToWin).toBe(2);
    expect(store.gameState.gameInfo?.legsToWin).toBe(2);
  });
});
