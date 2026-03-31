import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MatchStatusService,
  createMatchStatusService,
  getMatchStatusService,
  type MatchStatus,
} from './MatchStatusService.js';
import type { ParsedEvent, MatchStateData } from '../../types/index.js';

describe('MatchStatusService', () => {
  let service: MatchStatusService;

  beforeEach(() => {
    service = createMatchStatusService();
  });

  describe('initial state', () => {
    it('should return empty status when no match is active', () => {
      const status = service.getStatus();

      expect(status.active).toBe(false);
      expect(status.matchId).toBeNull();
      expect(status.players).toEqual([]);
      expect(status.lastUpdated).toBeNull();
    });

    it('should report no active match', () => {
      expect(service.isMatchActive()).toBe(false);
      expect(service.hasMatch()).toBe(false);
      expect(service.getMatchId()).toBeNull();
    });
  });

  describe('handleEvent', () => {
    const mockMatchState: MatchStateData = {
      id: 'test-match-123',
      createdAt: '2024-01-01T00:00:00Z',
      finished: false,
      gameFinished: false,
      gameWinner: null,
      hasReferee: false,
      leg: 1,
      set: 1,
      round: 3,
      type: 'Local',
      variant: 'X01',
      winner: null,
      settings: {
        baseScore: 501,
        bullMode: 'Double',
        inMode: 'Straight',
        maxRounds: 50,
        outMode: 'Double',
      },
      state: 'Active',
      scores: [0, 0],
      chalkboards: [],
      gameScores: [301, 421],
      stats: {
        legStats: [
          { average: 45.5, averageUntil170: 45.5, checkoutPercent: 0, checkoutPoints: 0, checkoutPointsAverage: 0, checkouts: 0, checkoutsHit: 0, dartsThrown: 9, dartsUntil170: 9, first9Average: 45.5, first9Score: 200, less60: 1, plus60: 2, plus100: 0, plus140: 0, plus170: 0, score: 200, scoreUntil170: 200, total180: 0 },
          { average: 26.7, averageUntil170: 26.7, checkoutPercent: 0, checkoutPoints: 0, checkoutPointsAverage: 0, checkouts: 0, checkoutsHit: 0, dartsThrown: 6, dartsUntil170: 6, first9Average: 26.7, first9Score: 80, less60: 2, plus60: 0, plus100: 0, plus140: 0, plus170: 0, score: 80, scoreUntil170: 80, total180: 0 },
        ],
        matchStats: [
          { average: 45.5, averageUntil170: 45.5, checkoutPercent: 0, checkoutPoints: 0, checkoutPointsAverage: 0, checkouts: 0, checkoutsHit: 0, dartsThrown: 9, dartsUntil170: 9, first9Average: 45.5, first9Score: 200, less60: 1, plus60: 2, plus100: 0, plus140: 0, plus170: 0, score: 200, scoreUntil170: 200, total180: 0 },
          { average: 26.7, averageUntil170: 26.7, checkoutPercent: 0, checkoutPoints: 0, checkoutPointsAverage: 0, checkouts: 0, checkoutsHit: 0, dartsThrown: 6, dartsUntil170: 6, first9Average: 26.7, first9Score: 80, less60: 2, plus60: 0, plus100: 0, plus140: 0, plus170: 0, score: 80, scoreUntil170: 80, total180: 0 },
        ],
      },
      turnBusted: false,
      turnScore: 60,
      turns: [],
      player: 0,
      players: [
        { id: 'player-1', index: 0, name: 'Max', boardId: 'board-1', userId: null },
        { id: 'player-2', index: 1, name: 'Anna', boardId: 'board-1', userId: null },
      ],
      host: null,
    };

    it('should update status on match.state event', () => {
      const event: ParsedEvent = {
        type: 'match.state',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: mockMatchState },
        data: {},
      };

      service.handleEvent(event);
      const status = service.getStatus();

      expect(status.active).toBe(true);
      expect(status.matchId).toBe('test-match-123');
      expect(status.currentPlayerIndex).toBe(0);
      expect(status.currentPlayerName).toBe('Max');
      expect(status.players).toHaveLength(2);
      expect(status.gameScores).toEqual([301, 421]);
    });

    it('should clear status on match.finish event', () => {
      // First set up a match
      const stateEvent: ParsedEvent = {
        type: 'match.state',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: mockMatchState },
        data: {},
      };
      service.handleEvent(stateEvent);
      expect(service.hasMatch()).toBe(true);

      // Then finish it
      const finishEvent: ParsedEvent = {
        type: 'match.finish',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: { matchId: 'test-match-123' } },
        data: { matchId: 'test-match-123' },
      };
      service.handleEvent(finishEvent);

      expect(service.hasMatch()).toBe(false);
      expect(service.getMatchId()).toBeNull();
    });

    it('should clear status on match.delete event', () => {
      // First set up a match
      const stateEvent: ParsedEvent = {
        type: 'match.state',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: mockMatchState },
        data: {},
      };
      service.handleEvent(stateEvent);

      // Then delete it
      const deleteEvent: ParsedEvent = {
        type: 'match.delete',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: { matchId: 'test-match-123' } },
        data: { matchId: 'test-match-123' },
      };
      service.handleEvent(deleteEvent);

      expect(service.hasMatch()).toBe(false);
    });
  });

  describe('listeners', () => {
    it('should notify listeners on status change', () => {
      const listener = vi.fn();
      service.addListener(listener);

      const event: ParsedEvent = {
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: { matchId: 'test-123' },
      };

      service.handleEvent(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        active: false, // No full state yet
        matchId: null,
      }));
    });

    it('should allow removing listeners', () => {
      const listener = vi.fn();
      const unsubscribe = service.addListener(listener);

      unsubscribe();

      const event: ParsedEvent = {
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: { matchId: 'test-123' },
      };

      service.handleEvent(event);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('player color resolver', () => {
    it('should use color resolver for player colors', () => {
      const mockMatchState: MatchStateData = {
        id: 'test-match',
        createdAt: '2024-01-01T00:00:00Z',
        finished: false,
        gameFinished: false,
        gameWinner: null,
        hasReferee: false,
        leg: 1,
        set: 1,
        round: 1,
        type: 'Local',
        variant: 'X01',
        winner: null,
        settings: {
          baseScore: 501,
          bullMode: 'Double',
          inMode: 'Straight',
          maxRounds: 50,
          outMode: 'Double',
        },
        state: 'Active',
        scores: [0],
        chalkboards: [],
        gameScores: [501],
        stats: {
          legStats: [{ average: 0 } as any],
          matchStats: [{ average: 0 } as any],
        },
        turnBusted: false,
        turnScore: 0,
        turns: [],
        player: 0,
        players: [{ id: 'p1', index: 0, name: 'TestPlayer', boardId: 'b1', userId: null }],
        host: null,
      };

      service.setPlayerColorResolver((name) => {
        if (name === 'TestPlayer') return '#ff0000';
        return undefined;
      });

      const event: ParsedEvent = {
        type: 'match.state',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: mockMatchState },
        data: {},
      };

      service.handleEvent(event);

      const player = service.getPlayer(0);
      expect(player?.color).toBe('#ff0000');
    });
  });

  describe('helper methods', () => {
    const mockMatchState: MatchStateData = {
      id: 'test-match',
      createdAt: '2024-01-01T00:00:00Z',
      finished: false,
      gameFinished: false,
      gameWinner: null,
      hasReferee: false,
      leg: 1,
      set: 1,
      round: 5,
      type: 'Local',
      variant: 'X01',
      winner: null,
      settings: {
        baseScore: 501,
        bullMode: 'Double',
        inMode: 'Straight',
        maxRounds: 50,
        outMode: 'Double',
      },
      state: 'Active',
      scores: [0],
      chalkboards: [],
      gameScores: [301],
      stats: {
        legStats: [{ average: 40 } as any],
        matchStats: [{ average: 40 } as any],
      },
      turnBusted: false,
      turnScore: 60,
      turns: [],
      player: 0,
      players: [{ id: 'p1', index: 0, name: 'SoloPlayer', boardId: 'b1', userId: null }],
      host: null,
    };

    beforeEach(() => {
      const event: ParsedEvent = {
        type: 'match.state',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: mockMatchState },
        data: {},
      };
      service.handleEvent(event);
    });

    it('should detect single player mode', () => {
      expect(service.isSinglePlayer()).toBe(true);
      expect(service.getPlayerCount()).toBe(1);
    });

    it('should return current player score', () => {
      expect(service.getCurrentPlayerScore()).toBe(301);
    });

    it('should return player by index', () => {
      const player = service.getPlayer(0);
      expect(player?.name).toBe('SoloPlayer');
      expect(player?.score).toBe(301);
    });

    it('should return null for invalid player index', () => {
      expect(service.getPlayer(99)).toBeNull();
      expect(service.getPlayer(-1)).toBeNull();
    });
  });

  describe('singleton', () => {
    it('should return same instance from getMatchStatusService', () => {
      const instance1 = getMatchStatusService();
      const instance2 = getMatchStatusService();
      expect(instance1).toBe(instance2);
    });
  });
});
