import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../../src/core/auth/AuthService.js';
import { SocketService } from '../../src/core/socket/SocketService.js';
import { EventBus } from '../../src/core/events/EventBus.js';
import { EventParser } from '../../src/core/socket/EventParser.js';
import { ConfigService } from '../../src/core/config/ConfigService.js';
import type { AuthConfig, HubConfig, ParsedEvent } from '../../src/types/index.js';
import {
  MOCK_BOARD_ID,
  MOCK_MATCH_ID,
  mockMatchStart,
  mockThrowT20,
  mockTakeoutStarted,
  mockTakeoutFinished,
  createMockMatchState,
} from '../mocks/autodarts-events.js';

// Mock JWT token
const MOCK_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJleHAiOjE3MTEyOTM2MDB9.fake-signature';

describe('Integration: Hub Core Components', () => {
  describe('AuthService + ConfigService', () => {
    let authService: AuthService;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should authenticate using config credentials', async () => {
      const config: AuthConfig = {
        email: 'test@example.com',
        password: 'password123',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      };

      authService = new AuthService(config);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: MOCK_JWT,
            refresh_token: 'mock-refresh',
            expires_in: 300,
            token_type: 'Bearer',
          }),
      });

      const token = await authService.login();

      expect(token).toBe(MOCK_JWT);
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.getUserId()).toBe('test-user-id');
    });
  });

  describe('EventParser + EventBus', () => {
    let eventParser: EventParser;
    let eventBus: EventBus;

    beforeEach(() => {
      eventParser = new EventParser(MOCK_BOARD_ID);
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.clear();
    });

    it('should parse and emit match start event', async () => {
      const handler = vi.fn();
      eventBus.on('match.start', handler);

      const event = eventParser.parse(mockMatchStart);
      if (event && !Array.isArray(event)) {
        await eventBus.emit(event);
      }

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].data).toMatchObject({
        matchId: MOCK_MATCH_ID,
        boardId: MOCK_BOARD_ID,
      });
    });

    it('should parse and emit throw detected event (board throw outside a match)', async () => {
      const handler = vi.fn();
      eventBus.on('throw.detected', handler);

      // During a match throws come from the match state (one event per dart);
      // the board event path only reports throws outside a match
      const event = eventParser.parse(mockThrowT20);
      if (event && !Array.isArray(event)) {
        await eventBus.emit(event);
      }

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].data).toMatchObject({
        segment: {
          name: 'T20',
          multiplier: 3,
          number: 20,
        },
        throwNumber: 1,
      });
    });

    it('should detect player change from match state', async () => {
      const playerChangeHandler = vi.fn();
      const matchStateHandler = vi.fn();

      eventBus.on('player.change', playerChangeHandler);
      eventBus.on('match.state', matchStateHandler);

      eventParser.setMatchId(MOCK_MATCH_ID);

      // First state update - player 0
      const state1 = createMockMatchState({ player: 0 });
      const events1 = eventParser.parse(state1);
      if (events1) {
        const eventArray = Array.isArray(events1) ? events1 : [events1];
        for (const e of eventArray) {
          await eventBus.emit(e);
        }
      }

      // Second state update - player 1
      const state2 = createMockMatchState({ player: 1 });
      const events2 = eventParser.parse(state2);
      if (events2) {
        const eventArray = Array.isArray(events2) ? events2 : [events2];
        for (const e of eventArray) {
          await eventBus.emit(e);
        }
      }

      expect(playerChangeHandler).toHaveBeenCalled();
      expect(playerChangeHandler.mock.calls[0][0].data).toMatchObject({
        previousPlayer: 0,
        currentPlayer: 1,
      });
    });

    it('should handle full turn sequence', async () => {
      const events: ParsedEvent[] = [];
      eventBus.on('*', (e) => events.push(e));

      eventParser.setMatchId(MOCK_MATCH_ID);

      // Simulate turn sequence
      const sequence = [
        mockThrowT20,
        createMockMatchState({ gameScores: [441, 501], turnScore: 60 }),
        mockTakeoutStarted,
        mockTakeoutFinished,
        createMockMatchState({ player: 1, gameScores: [441, 501] }),
      ];

      for (const msg of sequence) {
        const parsed = eventParser.parse(msg);
        if (parsed) {
          const eventArray = Array.isArray(parsed) ? parsed : [parsed];
          for (const e of eventArray) {
            await eventBus.emit(e);
          }
        }
      }

      const eventTypes = events.map((e) => e.type);
      // The board throw during a match is passed on as board.event only
      expect(eventTypes).toContain('board.event');
      expect(eventTypes).not.toContain('throw.detected');
      expect(eventTypes).toContain('match.state');
      expect(eventTypes).toContain('takeout.started');
      expect(eventTypes).toContain('takeout.finished');
      expect(eventTypes).toContain('player.change');
    });
  });

  describe('Full Flow: Auth -> Socket -> EventBus', () => {
    let authService: AuthService;
    let eventBus: EventBus;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const config: AuthConfig = {
        email: 'test@example.com',
        password: 'password123',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      };

      authService = new AuthService(config);
      eventBus = new EventBus();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      authService.logout();
      eventBus.clear();
    });

    it('should authenticate and prepare for socket connection', async () => {
      // Mock login
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: MOCK_JWT,
            refresh_token: 'mock-refresh',
            expires_in: 300,
            token_type: 'Bearer',
          }),
      });

      const token = await authService.login();
      expect(token).toBeTruthy();
      expect(authService.isAuthenticated()).toBe(true);

      // At this point, SocketService would be created and connected
      // We can't test actual WebSocket connection without mocking ws
      const socketService = new SocketService(MOCK_BOARD_ID, eventBus);
      expect(socketService.getConnectionState()).toBe('disconnected');
    });

    it('should handle token refresh and maintain session', async () => {
      // Initial login
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: MOCK_JWT,
            refresh_token: 'mock-refresh',
            expires_in: 300,
            token_type: 'Bearer',
          }),
      });

      await authService.login();

      // Simulate token refresh
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-' + MOCK_JWT,
            refresh_token: 'new-mock-refresh',
            expires_in: 300,
            token_type: 'Bearer',
          }),
      });

      const newToken = await authService.refresh();
      expect(newToken).toBe('new-' + MOCK_JWT);
      expect(authService.isAuthenticated()).toBe(true);
    });
  });

  describe('Event Flow Scenarios', () => {
    let eventParser: EventParser;
    let eventBus: EventBus;

    beforeEach(() => {
      eventParser = new EventParser(MOCK_BOARD_ID);
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.clear();
    });

    it('should handle 180 (three T20s)', async () => {
      const throws: ParsedEvent[] = [];
      eventBus.on('throw.detected', (e) => throws.push(e));

      // Three T20 throws from the board (outside a match)
      for (let i = 1; i <= 3; i++) {
        const throwMsg = {
          ...mockThrowT20,
          data: {
            ...mockThrowT20.data,
            throwNumber: i,
          },
        };

        const event = eventParser.parse(throwMsg);
        if (event && !Array.isArray(event)) {
          await eventBus.emit(event);
        }
      }

      expect(throws).toHaveLength(3);
      const totalScore = throws.reduce((sum, t) => {
        const data = t.data as { segment: { multiplier: number; number: number } };
        return sum + data.segment.multiplier * data.segment.number;
      }, 0);
      expect(totalScore).toBe(180);
    });

    it('should handle game finish', async () => {
      const finishedHandler = vi.fn();
      eventBus.on('game.finished', finishedHandler);

      eventParser.setMatchId(MOCK_MATCH_ID);

      // First update - not finished
      eventParser.parse(createMockMatchState({ player: 0 }));

      // Game finished
      const finishedState = createMockMatchState({
        gameFinished: true,
        gameWinner: 0,
        gameScores: [0, 123],
      });

      const events = eventParser.parse(finishedState);
      if (events) {
        const eventArray = Array.isArray(events) ? events : [events];
        for (const e of eventArray) {
          await eventBus.emit(e);
        }
      }

      expect(finishedHandler).toHaveBeenCalled();
      expect(finishedHandler.mock.calls[0][0].data).toMatchObject({
        winner: 0,
        winnerName: 'player-one',
      });
    });

    it('should handle match finish', async () => {
      const matchFinishedHandler = vi.fn();
      eventBus.on('match.finished', matchFinishedHandler);

      eventParser.setMatchId(MOCK_MATCH_ID);

      // First update
      eventParser.parse(createMockMatchState({ player: 0 }));

      // Match finished
      const finishedState = createMockMatchState({
        finished: true,
        winner: 1,
        gameFinished: true,
        gameWinner: 1,
      });

      const events = eventParser.parse(finishedState);
      if (events) {
        const eventArray = Array.isArray(events) ? events : [events];
        for (const e of eventArray) {
          await eventBus.emit(e);
        }
      }

      expect(matchFinishedHandler).toHaveBeenCalled();
      expect(matchFinishedHandler.mock.calls[0][0].data).toMatchObject({
        winner: 1,
        winnerName: 'laura',
      });

      // Match ID should be cleared
      expect(eventParser.getMatchId()).toBeNull();
    });
  });
});
