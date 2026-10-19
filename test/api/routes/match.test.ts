import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerMatchRoutes } from '../../../src/api/routes/match.js';
import type { MatchStateData } from '../../../src/types/index.js';

// Mock APIServer
const mockServer = {
  isAuthEnabled: vi.fn().mockReturnValue(false),
};

function createMockMatchState(overrides: Partial<MatchStateData> = {}): MatchStateData {
  return {
    id: 'match-123',
    createdAt: '2024-01-01T12:00:00.000Z',
    finished: false,
    gameFinished: false,
    gameWinner: null,
    hasReferee: false,
    leg: 1,
    set: 1,
    round: 3,
    type: 'X01',
    variant: '501',
    winner: null,
    settings: {
      baseScore: 501,
      bullMode: 'single',
      inMode: 'straight',
      maxRounds: 0,
      outMode: 'double',
    },
    state: 'playing',
    // Real Autodarts shape: legs/sets won per player; remaining points in gameScores
    scores: [{ legs: 0, sets: 0 }, { legs: 1, sets: 0 }],
    chalkboards: [],
    gameScores: [301, 342],
    stats: {
      legStats: [
        {
          average: 66.67,
          averageUntil170: 66.67,
          checkoutPercent: 0,
          checkoutPoints: 0,
          checkoutPointsAverage: 0,
          checkouts: 0,
          checkoutsHit: 0,
          dartsThrown: 9,
          dartsUntil170: 9,
          first9Average: 66.67,
          first9Score: 200,
          less60: 1,
          plus60: 1,
          plus100: 1,
          plus140: 0,
          plus170: 0,
          score: 200,
          scoreUntil170: 200,
          total180: 0,
        },
        {
          average: 53.0,
          averageUntil170: 53.0,
          checkoutPercent: 0,
          checkoutPoints: 0,
          checkoutPointsAverage: 0,
          checkouts: 0,
          checkoutsHit: 0,
          dartsThrown: 9,
          dartsUntil170: 9,
          first9Average: 53.0,
          first9Score: 159,
          less60: 2,
          plus60: 1,
          plus100: 0,
          plus140: 0,
          plus170: 0,
          score: 159,
          scoreUntil170: 159,
          total180: 0,
        },
      ],
      matchStats: [
        {
          average: 66.67,
          averageUntil170: 66.67,
          checkoutPercent: 0,
          checkoutPoints: 0,
          checkoutPointsAverage: 0,
          checkouts: 0,
          checkoutsHit: 0,
          dartsThrown: 9,
          dartsUntil170: 9,
          first9Average: 66.67,
          first9Score: 200,
          less60: 1,
          plus60: 1,
          plus100: 1,
          plus140: 0,
          plus170: 0,
          score: 200,
          scoreUntil170: 200,
          total180: 0,
        },
        {
          average: 53.0,
          averageUntil170: 53.0,
          checkoutPercent: 0,
          checkoutPoints: 0,
          checkoutPointsAverage: 0,
          checkouts: 0,
          checkoutsHit: 0,
          dartsThrown: 9,
          dartsUntil170: 9,
          first9Average: 53.0,
          first9Score: 159,
          less60: 2,
          plus60: 1,
          plus100: 0,
          plus140: 0,
          plus170: 0,
          score: 159,
          scoreUntil170: 159,
          total180: 0,
        },
      ],
    },
    turnBusted: false,
    turnScore: 45,
    turns: [],
    player: 0,
    players: [
      {
        id: 'player-1',
        index: 0,
        name: 'Player One',
        boardId: 'board-1',
        userId: 'user-1',
      },
      {
        id: 'player-2',
        index: 1,
        name: 'Player Two',
        boardId: 'board-1',
        userId: 'user-2',
      },
    ],
    host: null,
    ...overrides,
  };
}

describe('Match Routes', () => {
  let fastify: FastifyInstance;
  let getCurrentMatch: ReturnType<typeof vi.fn>;
  let getLastMatchUpdate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getCurrentMatch = vi.fn().mockReturnValue(null);
    getLastMatchUpdate = vi.fn().mockReturnValue(null);

    fastify = Fastify();
    registerMatchRoutes(fastify, mockServer as any, {
      getCurrentMatch,
      getLastMatchUpdate,
    });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    vi.clearAllMocks();
  });

  describe('GET /api/match/current', () => {
    it('should return inactive state when no match', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.active).toBe(false);
      expect(body.matchId).toBeNull();
      expect(body.players).toEqual([]);
    });

    it('should return current match state', async () => {
      const mockMatch = createMockMatchState();
      const mockDate = new Date('2024-01-01T12:05:00.000Z');
      getCurrentMatch.mockReturnValue(mockMatch);
      getLastMatchUpdate.mockReturnValue(mockDate);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.active).toBe(true);
      expect(body.matchId).toBe('match-123');
      expect(body.variant).toBe('501');
      expect(body.type).toBe('X01');
      expect(body.leg).toBe(1);
      expect(body.set).toBe(1);
      expect(body.round).toBe(3);
      expect(body.player).toBe(0);
      expect(body.scores).toEqual([{ legs: 0, sets: 0 }, { legs: 1, sets: 0 }]);
      expect(body.gameScores).toEqual([301, 342]);
      expect(body.turnScore).toBe(45);
      expect(body.turnBusted).toBe(false);
      expect(body.finished).toBe(false);
      expect(body.lastUpdated).toBe('2024-01-01T12:05:00.000Z');
    });

    it('includes the Cricket state and the current turn, so a reloaded display can draw them', async () => {
      const segments = { '20': [4, 1], '25': [0, 0] };
      const turns = [{ id: 'turn-1' }, { id: 'turn-2' }] as unknown as MatchStateData['turns'];
      getCurrentMatch.mockReturnValue(createMockMatchState({ variant: 'Cricket', state: { segments }, turns }));

      const response = await fastify.inject({ method: 'GET', url: '/api/match/current' });
      const body = JSON.parse(response.body);

      expect(body.cricket).toMatchObject({
        mode: 'cricket',
        fields: ['20', '25'],
        players: [
          expect.objectContaining({ index: 0, marks: expect.objectContaining({ '20': 4 }) }),
          expect.objectContaining({ index: 1, marks: expect.objectContaining({ '20': 1 }) }),
        ],
      });
      expect(body.turns).toEqual([{ id: 'turn-2' }]);
      expect(body.segments).toBeUndefined();
    });

    it('returns the legs and sets needed to win, so a reloaded display shows the format', async () => {
      getCurrentMatch.mockReturnValue(createMockMatchState({ legs: 3, sets: null as never }));
      const response = await fastify.inject({ method: 'GET', url: '/api/match/current' });
      const body = JSON.parse(response.body);
      expect(body.legs).toBe(3);
      expect(body.sets).toBeNull();
    });

    it('returns the legs and sets won as counted by the hub', async () => {
      const app = Fastify();
      registerMatchRoutes(app, mockServer as any, {
        getCurrentMatch: () => createMockMatchState(),
        getLastMatchUpdate: () => null,
        getWonCounts: () => ({ legsWon: { 0: 1, 1: 0 }, setsWon: { 0: 0, 1: 0 } }),
      });
      await app.ready();
      const body = JSON.parse((await app.inject({ method: 'GET', url: '/api/match/current' })).body);
      await app.close();
      expect(body.legsWon).toEqual({ 0: 1, 1: 0 });
      expect(body.setsWon).toEqual({ 0: 0, 1: 0 });
    });

    it('should include player info with scores and averages', async () => {
      const mockMatch = createMockMatchState();
      getCurrentMatch.mockReturnValue(mockMatch);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current',
      });

      const body = JSON.parse(response.body);
      expect(body.players).toHaveLength(2);

      expect(body.players[0].id).toBe('player-1');
      expect(body.players[0].name).toBe('Player One');
      expect(body.players[0].score).toBe(301);
      expect(body.players[0].average).toBe(66.67);

      expect(body.players[1].id).toBe('player-2');
      expect(body.players[1].name).toBe('Player Two');
      expect(body.players[1].score).toBe(342);
      expect(body.players[1].average).toBe(53.0);
    });

    it('should return inactive when match is finished', async () => {
      const mockMatch = createMockMatchState({ finished: true, winner: 0 });
      getCurrentMatch.mockReturnValue(mockMatch);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current',
      });

      const body = JSON.parse(response.body);
      expect(body.active).toBe(false);
      expect(body.finished).toBe(true);
      expect(body.winner).toBe(0);
    });

    it('should include leg stats', async () => {
      const mockMatch = createMockMatchState();
      getCurrentMatch.mockReturnValue(mockMatch);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current',
      });

      const body = JSON.parse(response.body);
      expect(body.stats.legStats).toHaveLength(2);
      expect(body.stats.matchStats).toHaveLength(2);
    });
  });

  describe('GET /api/match/current/players', () => {
    it('should return inactive when no match', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current/players',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.active).toBe(false);
      expect(body.players).toEqual([]);
    });

    it('should return players only', async () => {
      const mockMatch = createMockMatchState();
      getCurrentMatch.mockReturnValue(mockMatch);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current/players',
      });

      const body = JSON.parse(response.body);
      expect(body.active).toBe(true);
      expect(body.players).toHaveLength(2);
      expect(body.players[0].name).toBe('Player One');
      expect(body.players[1].name).toBe('Player Two');
    });

    it('should return inactive for finished match', async () => {
      const mockMatch = createMockMatchState({ finished: true });
      getCurrentMatch.mockReturnValue(mockMatch);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current/players',
      });

      const body = JSON.parse(response.body);
      expect(body.active).toBe(false);
    });
  });

  describe('GET /api/match/current/scores', () => {
    it('should return inactive when no match', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current/scores',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.active).toBe(false);
      expect(body.scores).toEqual([]);
    });

    it('should return scores only', async () => {
      const mockMatch = createMockMatchState();
      getCurrentMatch.mockReturnValue(mockMatch);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current/scores',
      });

      const body = JSON.parse(response.body);
      expect(body.active).toBe(true);
      expect(body.scores).toEqual([{ legs: 0, sets: 0 }, { legs: 1, sets: 0 }]);
      expect(body.gameScores).toEqual([301, 342]);
      expect(body.turnScore).toBe(45);
      expect(body.currentPlayer).toBe(0);
    });
  });

  describe('Authentication', () => {
    beforeEach(() => {
      mockServer.isAuthEnabled.mockReturnValue(true);
    });

    afterEach(() => {
      mockServer.isAuthEnabled.mockReturnValue(false);
    });

    it('should return 401 for /api/match/current when auth enabled', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for /api/match/current/players when auth enabled', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current/players',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for /api/match/current/scores when auth enabled', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/match/current/scores',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
