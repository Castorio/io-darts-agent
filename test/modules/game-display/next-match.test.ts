import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from '../../../modules/game-display/web/node_modules/pinia/dist/pinia.mjs';
import { EventParser } from '../../../src/core/socket/EventParser.js';
import type { AutodartsMessage, MatchPlayer, MatchStateData, ParsedEvent } from '../../../src/types/index.js';
import { MOCK_BOARD_ID, createMockMatchState } from '../../mocks/autodarts-events.js';
import { useGameDisplayStore } from '../../../modules/game-display/web/src/stores/gameDisplay.js';

const start = (id: string): AutodartsMessage => ({
  channel: 'autodarts.boards',
  topic: `${MOCK_BOARD_ID}.matches`,
  data: { event: 'start', id },
});

const player = (index: number, name: string): MatchPlayer =>
  ({ id: `p-${name}`, index, name, boardId: MOCK_BOARD_ID, userId: null }) as unknown as MatchPlayer;

function state(id: string, patch: Partial<MatchStateData>): AutodartsMessage {
  const message = createMockMatchState({ id, ...patch });
  return { ...message, topic: `${id}.state` };
}

function list(r: ParsedEvent | ParsedEvent[] | null): ParsedEvent[] {
  return r === null ? [] : Array.isArray(r) ? r : [r];
}

describe('game display after a finished match', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ active: false }) }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the player of the next match, also when it is a solo game', () => {
    const store = useGameDisplayStore();
    const parser = new EventParser(MOCK_BOARD_ID);
    const feed = (m: AutodartsMessage) => {
      for (const e of list(parser.parse(m))) store.handleEvent({ type: e.type, data: e.data });
    };
    const duo = [player(0, 'CASTORIO'), player(1, 'CHICKEN')];

    // Match A: two players, CHICKEN at the board and wins
    feed(start('match-a'));
    feed(state('match-a', { players: duo, player: 1, gameScores: [301, 40] }));
    feed(state('match-a', {
      players: duo, player: 1, gameScores: [301, 0],
      gameFinished: true, gameWinner: 1, finished: true, winner: 1,
    }));

    // Match B: LAURA alone, no match.delete in between (real sequence on the board PC)
    feed(start('match-b'));
    feed(state('match-b', { players: [player(0, 'LAURA')], player: 0, gameScores: [501], scores: [501] as never }));

    expect(store.activePlayer?.name).toBe('LAURA');
    expect(store.gameState.players.map((p) => p.name)).toEqual(['LAURA']);
    expect(store.gameState.winner).toBeNull();
  });

  it('also starts over when the match.start event was missed', () => {
    const store = useGameDisplayStore();
    const duo = [player(0, 'CASTORIO'), player(1, 'CHICKEN')];
    const send = (m: AutodartsMessage) => {
      const parser = new EventParser(MOCK_BOARD_ID);
      parser.setMatchId((m.data as MatchStateData).id);
      for (const e of list(parser.parse(m))) store.handleEvent({ type: e.type, data: e.data });
    };

    send(state('match-a', { players: duo, player: 1 }));
    send(state('match-a', { players: duo, player: 1, gameScores: [301, 0], gameFinished: true, gameWinner: 1, finished: true, winner: 1 }));
    send(state('match-b', { players: [player(0, 'LAURA')], player: 0, gameScores: [501], scores: [501] as never }));

    expect(store.activePlayer?.name).toBe('LAURA');
    expect(store.gameState.players.map((p) => p.name)).toEqual(['LAURA']);
  });

  it('keeps the winner of the same match on screen', () => {
    const store = useGameDisplayStore();
    const parser = new EventParser(MOCK_BOARD_ID);
    const feed = (m: AutodartsMessage) => {
      for (const e of list(parser.parse(m))) store.handleEvent({ type: e.type, data: e.data });
    };
    const duo = [player(0, 'CASTORIO'), player(1, 'CHICKEN')];

    feed(start('match-a'));
    feed(state('match-a', { players: duo, player: 1, gameScores: [301, 40] }));
    feed(state('match-a', { players: duo, player: 1, gameScores: [301, 0], gameFinished: true, gameWinner: 1, finished: true, winner: 1 }));

    expect(store.gameState.winner?.name).toBe('CHICKEN');
  });
});
