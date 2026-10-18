import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setActivePinia, createPinia } from '../../../modules/game-display/web/node_modules/pinia/dist/pinia.mjs';
import { EventParser } from '../../../src/core/socket/EventParser.js';
import type { AutodartsMessage, ParsedEvent } from '../../../src/types/index.js';
import { useGameDisplayStore } from '../../../modules/game-display/web/src/stores/gameDisplay.js';

// Real two player Cricket recording (names and ids anonymized)
const messages: AutodartsMessage[] = readFileSync(
  fileURLToPath(new URL('../../fixtures/cricket-2players.jsonl', import.meta.url)),
  'utf8',
)
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line).message);

const boardId = messages[0].topic.split('.')[0];

function list(r: ParsedEvent | ParsedEvent[] | null): ParsedEvent[] {
  return r === null ? [] : Array.isArray(r) ? r : [r];
}

function replay(store: ReturnType<typeof useGameDisplayStore>, upTo = messages.length): string[] {
  const parser = new EventParser(boardId);
  for (const message of messages.slice(0, upTo)) {
    for (const e of list(parser.parse(message))) store.handleEvent({ type: e.type, data: e.data });
  }
  // Fake timers keep every animation: the playing one plus the queue
  return [store.activeAnimation, ...store.animationQueue].filter(Boolean).map((a) => a!.type as string);
}

describe('game display in a Cricket match', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('knows it is a Cricket game and shows the marks per player', () => {
    const store = useGameDisplayStore();
    replay(store);

    expect(store.isCricketGame).toBe(true);
    const anna = store.gameState.players.find((p) => p.name === 'Anna')!;
    const ben = store.gameState.players.find((p) => p.name === 'Ben')!;
    expect(store.cricketMarksByIndex[anna.index]).toMatchObject({ '20': 4, '18': 1, '15': 1 });
    expect(store.cricketMarksByIndex[ben.index]).toMatchObject({ '20': 1, '18': 0 });
    expect(anna.score).toBe(20);
    expect(store.cricketDeadFields).toEqual([]);
  });

  it('plays the close animation once for the closed 20 and no X01 animations', () => {
    const store = useGameDisplayStore();
    const triggered = replay(store);

    expect(triggered.filter((t) => t === 'cricketClose')).toHaveLength(1);
    expect(triggered).not.toContain('checkout');
    expect(triggered).not.toContain('180');
    expect(triggered).not.toContain('highScore');
  });

  it('offers no checkout while playing Cricket', () => {
    const store = useGameDisplayStore();
    replay(store);
    expect(store.gameState.isCheckoutPossible).toBe(false);
  });

  it('fires the strong-turn animation once per turnId, even if the dart is reported twice', () => {
    const store = useGameDisplayStore();
    replay(store);
    const anna = store.gameState.players.find((p) => p.name === 'Anna')!;
    // Fresh turn so handleThrow starts counting darts from zero again
    store.handleEvent({ type: 'player.change', data: { playerIndex: anna.index, playerName: 'Anna', currentPlayer: 0 } });

    const game = { variant: 'Cricket', mode: 'cricket', cutThroat: false };
    const dart = { segment: { number: 20, multiplier: 1, name: 'S20' }, turnMarks: 6, turnId: 't1', game };
    store.handleEvent({ type: 'throw.detected', data: dart });
    store.handleEvent({ type: 'throw.detected', data: dart });

    const triggered = [store.activeAnimation, ...store.animationQueue].filter(Boolean).map((a) => a!.type as string);
    expect(triggered.filter((t) => t === 'cricketMarks')).toHaveLength(1);
  });

  it('ignores a cricket.closed event when the game is not Cricket', () => {
    const store = useGameDisplayStore();
    // Fresh store: no match was replayed, so the game is not Cricket
    store.handleEvent({
      type: 'cricket.closed',
      data: { matchId: 'm1', set: 1, leg: 1, field: '20', playerIndex: 0, playerName: 'Anna' },
    });

    expect(store.activeAnimation).toBeNull();
    expect(store.animationQueue).toEqual([]);
  });
});

describe('Cricket display after a reload', () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.unstubAllGlobals());

  it('draws the marks from /api/match/current before the next dart', async () => {
    vi.stubGlobal('fetch', async () => ({
      json: async () => ({
        active: true, matchId: 'm1', variant: 'Cricket', leg: 1, set: 1, round: 2, player: 1,
        players: [{ index: 0, name: 'Anna' }, { index: 1, name: 'Ben' }],
        gameScores: [20, 0], turnScore: 0, finished: false, gameFinished: false,
        settings: { gameMode: 'Cricket' }, turns: [],
        cricket: {
          matchId: 'm1', set: 1, leg: 1, mode: 'cricket', cutThroat: false,
          fields: ['20', '19', '18', '17', '16', '15', '25'], deadFields: [],
          players: [
            { index: 0, name: 'Anna', points: 20, marks: { '20': 4, '18': 1 } },
            { index: 1, name: 'Ben', points: 0, marks: { '20': 1, '18': 0 } },
          ],
        },
      }),
    }));
    const store = useGameDisplayStore();
    await store.fetchCurrentMatch();

    expect(store.isCricketGame).toBe(true);
    expect(store.cricketMarksByIndex[0]).toMatchObject({ '20': 4, '18': 1 });
    expect(store.cricketMarksByIndex[1]).toMatchObject({ '20': 1 });
  });
});

describe('disabled animations', () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.unstubAllGlobals());

  it('stay off when the slot type is "Disabled"', async () => {
    vi.stubGlobal('fetch', async () => ({
      json: async () => ({ animationCricketClose: { type: 'none' }, animationBust: { type: 'none' } }),
    }));
    const store = useGameDisplayStore();
    await store.fetchConfig();

    expect(store.getAnimationForEvent('cricketClose')).toBeNull();
    expect(store.getAnimationForEvent('bust')).toBeNull();
    expect(store.getAnimationForEvent('bull')).not.toBeNull();
  });

  it('reads the strong turn threshold from its slot', async () => {
    vi.stubGlobal('fetch', async () => ({
      json: async () => ({ animationCricketMarks: { type: 'builtin', threshold: 7 } }),
    }));
    const store = useGameDisplayStore();
    await store.fetchConfig();

    expect(store.config.cricketMarksThreshold).toBe(7);
  });
});
