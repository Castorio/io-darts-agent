import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { registerDeveloperRoutes } from '../../../src/api/routes/developer.js';
import { EventParser } from '../../../src/core/socket/EventParser.js';
import type { ParsedEvent } from '../../../src/types/index.js';
import { MOCK_BOARD_ID, createMockMatchState, mockMatchStart } from '../../mocks/autodarts-events.js';

const server = {
  isAuthEnabled: () => false,
  getConfig: () => ({ developerMode: true }),
};

function startApp(): { app: ReturnType<typeof Fastify>; events: ParsedEvent[] } {
  const events: ParsedEvent[] = [];
  const app = Fastify();
  registerDeveloperRoutes(app, server as never, { emitEvent: (e) => events.push(e) });
  return { app, events };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Key set a real EventParser produces for a throw.detected event, as reference */
function realThrowDetectedKeys(): string[] {
  const parser = new EventParser(MOCK_BOARD_ID);
  parser.parse(mockMatchStart);
  parser.parse(createMockMatchState({ gameScores: [501, 501], turnScore: 0 }));
  const result = parser.parse(createMockMatchState({
    gameScores: [441, 501],
    turnScore: 60,
    turns: [
      {
        busted: false,
        createdAt: '2024-03-27T12:01:00Z',
        finishedAt: '0001-01-01T00:00:00Z',
        id: 'turn-1',
        marks: null,
        playerId: 'player-1-id',
        points: 60,
        round: 1,
        score: 441,
        throws: [
          {
            coords: { x: 0.05, y: -0.02 },
            createdAt: '2024-03-27T12:01:00Z',
            entry: 'detected',
            id: 'throw-1',
            marks: null,
            segment: { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 },
            throw: 1,
          },
        ],
        turn: 0,
      },
    ],
  }));
  const list = Array.isArray(result) ? result : result ? [result] : [];
  const throwEvent = list.find((e) => e.type === 'throw.detected')!;
  return Object.keys(throwEvent.data as Record<string, unknown>).sort();
}

/** Key set a real EventParser produces for a player.change event, as reference */
function realPlayerChangeKeys(): string[] {
  const parser = new EventParser(MOCK_BOARD_ID);
  parser.parse(mockMatchStart);
  parser.parse(createMockMatchState({ player: 0, round: 1 }));
  const result = parser.parse(createMockMatchState({ player: 1, round: 1 }));
  const list = Array.isArray(result) ? result : result ? [result] : [];
  const event = list.find((e) => e.type === 'player.change')!;
  return Object.keys(event.data as Record<string, unknown>).sort();
}

/** Key set a real EventParser produces for a turn.finished event (round change path), as reference */
function realTurnFinishedKeys(): string[] {
  const parser = new EventParser(MOCK_BOARD_ID);
  parser.parse(mockMatchStart);
  parser.parse(createMockMatchState({ player: 0, round: 1, turnScore: 26 }));
  const result = parser.parse(createMockMatchState({ player: 1, round: 2 }));
  const list = Array.isArray(result) ? result : result ? [result] : [];
  const event = list.find((e) => e.type === 'turn.finished')!;
  return Object.keys(event.data as Record<string, unknown>).sort();
}

/** Key set a real EventParser produces for a game.finished event, as reference */
function realGameFinishedKeys(): string[] {
  const parser = new EventParser(MOCK_BOARD_ID);
  parser.parse(mockMatchStart);
  parser.parse(createMockMatchState({ gameFinished: false }));
  const result = parser.parse(createMockMatchState({
    gameFinished: true,
    gameWinner: 0,
    gameScores: [0, 301],
  }));
  const list = Array.isArray(result) ? result : result ? [result] : [];
  const event = list.find((e) => e.type === 'game.finished')!;
  return Object.keys(event.data as Record<string, unknown>).sort();
}

/** Key sets a real EventParser produces for match.finished and match.result, as reference */
function realMatchEndKeys(): { matchFinished: string[]; matchResult: string[] } {
  const parser = new EventParser(MOCK_BOARD_ID);
  parser.parse(mockMatchStart);
  parser.parse(createMockMatchState({ finished: false }));
  const result = parser.parse(createMockMatchState({
    finished: true,
    winner: 0,
    gameScores: [0, 301],
  }));
  const list = Array.isArray(result) ? result : result ? [result] : [];
  return {
    matchFinished: Object.keys(list.find((e) => e.type === 'match.finished')!.data as Record<string, unknown>).sort(),
    matchResult: Object.keys(list.find((e) => e.type === 'match.result')!.data as Record<string, unknown>).sort(),
  };
}

describe('developer simulator match state', () => {
  it('sends the remaining score in gameScores and the darts of the turn, like Autodarts', async () => {
    const { app, events } = startApp();
    await app.ready();

    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/start', payload: {} });
    await app.inject({ method: 'POST', url: '/api/developer/simulate/throw', payload: { number: 20, multiplier: 3 } });
    await app.close();

    const state = events.filter((e) => e.type === 'match.state').at(-1)!.data as Record<string, any>;
    expect(state.gameScores[0]).toBe(441);
    expect(state.scores[0]).toEqual({ legs: 0, sets: 0 });
    expect(state.turns.at(-1).throws.map((t: any) => t.segment.name)).toEqual(['T20']);
  });
});

describe('developer simulator event shapes match the real EventParser output', () => {
  it('throw.detected carries segment.name, turnId and game, with the same key set as the real parser', async () => {
    const { app, events } = startApp();
    await app.ready();

    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/start', payload: {} });
    await app.inject({ method: 'POST', url: '/api/developer/simulate/throw', payload: { number: 20, multiplier: 3 } });
    await app.close();

    const throwEvent = events.find((e) => e.type === 'throw.detected')!;
    const data = throwEvent.data as Record<string, any>;

    expect(data.segment.name).toBe('T20');
    expect(data.turnId).toBeTruthy();
    expect(data.game).toEqual({ variant: 'X01', mode: 'x01', cutThroat: false });
    expect(Object.keys(data).sort()).toEqual(realThrowDetectedKeys());
  });

  it('player.change carries playerIndex and game, with the same key set as the real parser', async () => {
    const { app, events } = startApp();
    await app.ready();

    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/start', payload: {} });
    await app.inject({ method: 'POST', url: '/api/developer/simulate/turn/end', payload: {} });
    await delay(700);
    await app.close();

    const playerChange = events.find((e) => e.type === 'player.change')!;
    const data = playerChange.data as Record<string, any>;

    expect(data.playerIndex).toBe(1);
    expect(data.previousPlayer).toBe(0);
    expect(data.currentPlayer).toBe(1);
    expect(data.game).toEqual({ variant: 'X01', mode: 'x01', cutThroat: false });
    expect(Object.keys(data).sort()).toEqual(realPlayerChangeKeys());
  });

  it('turn.finished from /simulate/turn/end carries game, with the same key set as the real parser', async () => {
    const { app, events } = startApp();
    await app.ready();

    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/start', payload: {} });
    await app.inject({ method: 'POST', url: '/api/developer/simulate/turn/end', payload: {} });
    await app.close();

    const turnFinished = events.find((e) => e.type === 'turn.finished')!;
    const data = turnFinished.data as Record<string, any>;

    expect(data.game).toEqual({ variant: 'X01', mode: 'x01', cutThroat: false });
    expect(Object.keys(data).sort()).toEqual(realTurnFinishedKeys());
  });

  it('match.state carries a game context', async () => {
    const { app, events } = startApp();
    await app.ready();

    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/start', payload: {} });
    await app.inject({ method: 'POST', url: '/api/developer/simulate/throw', payload: { number: 20, multiplier: 3 } });
    await app.close();

    const state = events.filter((e) => e.type === 'match.state').at(-1)!.data as Record<string, any>;
    expect(state.game).toEqual({ variant: 'X01', mode: 'x01', cutThroat: false });
  });

  it('checkout scenario emits turn.finished with remaining 0 before game.finished', async () => {
    const { app, events } = startApp();
    await app.ready();

    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/start', payload: {} });
    await app.inject({ method: 'POST', url: '/api/developer/scenarios/checkout/run' });
    await app.close();

    const types = events.map((e) => e.type);
    const turnFinishedIdx = types.indexOf('turn.finished');
    const gameFinishedIdx = types.indexOf('game.finished');

    expect(turnFinishedIdx).toBeGreaterThanOrEqual(0);
    expect(gameFinishedIdx).toBeGreaterThan(turnFinishedIdx);
    expect((events[turnFinishedIdx].data as Record<string, any>).remaining).toBe(0);
  });

  it('simulate/match/end sends match.finished then match.finish', async () => {
    const { app, events } = startApp();
    await app.ready();

    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/start', payload: {} });
    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/end', payload: { winner: 0 } });
    await app.close();

    const types = events.map((e) => e.type);
    const finishedIdx = types.indexOf('match.finished');
    const finishIdx = types.indexOf('match.finish');

    expect(finishedIdx).toBeGreaterThanOrEqual(0);
    expect(finishIdx).toBeGreaterThan(finishedIdx);
    const finishedMatchId = (events[finishedIdx].data as Record<string, any>).matchId;
    const finishMatchId = (events[finishIdx].data as Record<string, any>).matchId;
    expect(finishMatchId).toBe(finishedMatchId);
  });

  it('checkout scenario\'s game.finished carries winnerPlayerIndex, scores and legsWon/setsWon, with the same key set as the real parser', async () => {
    const { app, events } = startApp();
    await app.ready();

    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/start', payload: {} });
    await app.inject({ method: 'POST', url: '/api/developer/scenarios/checkout/run' });
    await app.close();

    const gameFinished = events.find((e) => e.type === 'game.finished')!;
    const data = gameFinished.data as Record<string, any>;

    expect(data.winnerPlayerIndex).toBe(0);
    expect(data.scores).toEqual([{ legs: 0, sets: 0 }, { legs: 0, sets: 0 }]);
    expect(data.legsWon).toBeTruthy();
    expect(data.setsWon).toBeTruthy();
    expect(Object.keys(data).sort()).toEqual(realGameFinishedKeys());
  });

  it('simulate/match/end: match.finished carries winnerPlayerIndex and scores, and is followed by match.result, both with the same key sets as the real parser', async () => {
    const { app, events } = startApp();
    await app.ready();

    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/start', payload: {} });
    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/end', payload: { winner: 0 } });
    await app.close();

    const types = events.map((e) => e.type);
    const finishedIdx = types.indexOf('match.finished');
    const resultIdx = types.indexOf('match.result');
    const finishIdx = types.indexOf('match.finish');

    expect(resultIdx).toBeGreaterThan(finishedIdx);
    expect(finishIdx).toBeGreaterThan(resultIdx);

    const finishedData = events[finishedIdx].data as Record<string, any>;
    const resultData = events[resultIdx].data as Record<string, any>;

    expect(finishedData.winnerPlayerIndex).toBe(0);
    expect(finishedData.scores).toEqual([{ legs: 0, sets: 0 }, { legs: 0, sets: 0 }]);

    const realKeys = realMatchEndKeys();
    expect(Object.keys(finishedData).sort()).toEqual(realKeys.matchFinished);
    expect(Object.keys(resultData).sort()).toEqual(realKeys.matchResult);
  });
});
