import { describe, it, expect, beforeEach } from 'vitest';
import {
  EventParser,
  getLastThrow,
  calculateSegmentScore,
  isHighValueSegment,
  isMiss,
} from './EventParser.js';
import type {
  AutodartsMessage,
  BoardStateData,
  BoardEventData,
  MatchStateData,
  ThrowSegment,
} from '../../types/index.js';

const BOARD_ID = 'test-board-id';
const MATCH_ID = 'test-match-id';

describe('EventParser', () => {
  let parser: EventParser;

  beforeEach(() => {
    parser = new EventParser(BOARD_ID);
  });

  describe('Board State Events', () => {
    it('should parse board state events', () => {
      const raw: AutodartsMessage = {
        channel: 'autodarts.boards',
        topic: `${BOARD_ID}.state`,
        data: {
          connected: true,
          event: 'Started',
          numThrows: 0,
          status: 'Throw',
        } satisfies BoardStateData,
      };

      const event = parser.parse(raw);

      expect(event).not.toBeNull();
      expect(Array.isArray(event) ? event[0].type : event!.type).toBe('board.state');
    });
  });

  describe('Match Start/Delete Events', () => {
    it('should parse match start event', () => {
      const raw: AutodartsMessage = {
        channel: 'autodarts.boards',
        topic: `${BOARD_ID}.matches`,
        data: { event: 'start', id: MATCH_ID },
      };

      const event = parser.parse(raw);

      expect(event).not.toBeNull();
      if (!Array.isArray(event)) {
        expect(event!.type).toBe('match.start');
        expect(event!.data).toEqual({
          matchId: MATCH_ID,
          boardId: BOARD_ID,
        });
      }
    });

    it('should track match ID after start', () => {
      const raw: AutodartsMessage = {
        channel: 'autodarts.boards',
        topic: `${BOARD_ID}.matches`,
        data: { event: 'start', id: MATCH_ID },
      };

      parser.parse(raw);
      expect(parser.getMatchId()).toBe(MATCH_ID);
    });

    it('should parse match delete event', () => {
      const raw: AutodartsMessage = {
        channel: 'autodarts.boards',
        topic: `${BOARD_ID}.matches`,
        data: { event: 'delete', id: MATCH_ID },
      };

      // First set a match
      parser.setMatchId(MATCH_ID);

      const event = parser.parse(raw);

      expect(event).not.toBeNull();
      if (!Array.isArray(event)) {
        expect(event!.type).toBe('match.delete');
      }
      expect(parser.getMatchId()).toBeNull();
    });
  });

  describe('Board Events (Throws)', () => {
    it('should parse throw detected event', () => {
      const raw: AutodartsMessage = {
        channel: 'autodarts.boards',
        topic: `${BOARD_ID}.events`,
        data: {
          boardId: BOARD_ID,
          event: 'Throw detected',
          throw: {
            coords: { x: 0.1, y: 0.2 },
            segment: {
              bed: 'Triple',
              multiplier: 3,
              name: 'T20',
              number: 20,
            },
          },
          throwNumber: 1,
        } satisfies BoardEventData,
      };

      const event = parser.parse(raw);

      expect(event).not.toBeNull();
      if (!Array.isArray(event)) {
        expect(event!.type).toBe('throw.detected');
        expect(event!.data).toMatchObject({
          segment: {
            bed: 'Triple',
            multiplier: 3,
            name: 'T20',
            number: 20,
          },
          throwNumber: 1,
        });
      }
    });

    it('should parse takeout started event', () => {
      const raw: AutodartsMessage = {
        channel: 'autodarts.boards',
        topic: `${BOARD_ID}.events`,
        data: {
          boardId: BOARD_ID,
          event: 'Takeout started',
          throw: { segment: { bed: '', multiplier: 0, name: '', number: 0 } },
        } satisfies BoardEventData,
      };

      const event = parser.parse(raw);

      expect(event).not.toBeNull();
      if (!Array.isArray(event)) {
        expect(event!.type).toBe('takeout.started');
      }
    });

    it('should parse takeout finished event', () => {
      const raw: AutodartsMessage = {
        channel: 'autodarts.boards',
        topic: `${BOARD_ID}.events`,
        data: {
          boardId: BOARD_ID,
          event: 'Takeout finished',
          throw: { segment: { bed: '', multiplier: 0, name: '', number: 0 } },
        } satisfies BoardEventData,
      };

      const event = parser.parse(raw);

      expect(event).not.toBeNull();
      if (!Array.isArray(event)) {
        expect(event!.type).toBe('takeout.finished');
      }
    });
  });

  describe('Match State Events', () => {
    const createMatchState = (overrides: Partial<MatchStateData> = {}): MatchStateData => ({
      id: MATCH_ID,
      createdAt: '2024-03-27T12:00:00Z',
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
        bullMode: '25/50',
        inMode: 'Straight',
        maxRounds: 50,
        outMode: 'Double',
      },
      state: 'playing',
      scores: [501, 501],
      chalkboards: [],
      gameScores: [501, 501],
      stats: { legStats: [], matchStats: [] },
      turnBusted: false,
      turnScore: 0,
      turns: [],
      player: 0,
      players: [
        {
          id: 'player-1',
          index: 0,
          name: 'Player 1',
          boardId: BOARD_ID,
          userId: 'user-1',
        },
        {
          id: 'player-2',
          index: 1,
          name: 'Player 2',
          boardId: BOARD_ID,
          userId: null,
        },
      ],
      host: null,
      ...overrides,
    });

    beforeEach(() => {
      parser.setMatchId(MATCH_ID);
    });

    it('should parse match state event', () => {
      const matchState = createMatchState({ gameScores: [441, 501], turnScore: 60 });
      const raw: AutodartsMessage = {
        channel: 'autodarts.matches',
        topic: `${MATCH_ID}.state`,
        data: matchState,
      };

      const event = parser.parse(raw);
      const events = Array.isArray(event) ? event : [event];
      const stateEvent = events.find((e) => e?.type === 'match.state');

      expect(stateEvent).toBeDefined();
      expect(stateEvent!.data).toMatchObject({
        matchId: MATCH_ID,
        player: 0,
        playerName: 'Player 1',
        gameScores: [441, 501],
        turnScore: 60,
      });
    });

    it('passes the variant and the game context with the match state, no segments', () => {
      const segments = { '15': [0, 0], '16': [0, 0], '17': [0, 0], '18': [1, 0], '19': [0, 0], '20': [4, 1], '25': [0, 0] };
      const event = parser.parse({
        channel: 'autodarts.matches',
        topic: `${MATCH_ID}.state`,
        data: createMatchState({ variant: 'Cricket', state: { segments }, gameScores: [20, 0] }),
      });
      const events = Array.isArray(event) ? event : [event];
      const stateEvent = events.find((e) => e?.type === 'match.state');

      expect(stateEvent!.data).toMatchObject({
        variant: 'Cricket',
        game: { variant: 'Cricket', mode: 'cricket', cutThroat: false },
      });
      expect(stateEvent!.data).not.toHaveProperty('segments');
    });

    it('names the cricket leg winner from gameWinner, not from a zero score', () => {
      // In Cricket gameScores are points: the loser may well sit at 0
      const event = parser.parse({
        channel: 'autodarts.matches',
        topic: `${MATCH_ID}.state`,
        data: createMatchState({
          variant: 'Cricket',
          gameScores: [45, 0],
          gameFinished: true,
          gameWinner: 0,
        }),
      });
      const events = Array.isArray(event) ? event : [event];
      const finished = events.find((e) => e?.type === 'game.finished');

      expect(finished!.data).toMatchObject({ winnerName: 'Player 1', winnerPlayerIndex: 0 });
    });

    it('should detect player change', () => {
      // First update - player 0
      const state1 = createMatchState({ player: 0 });
      parser.parse({
        channel: 'autodarts.matches',
        topic: `${MATCH_ID}.state`,
        data: state1,
      });

      // Second update - player 1
      const state2 = createMatchState({ player: 1 });
      const raw: AutodartsMessage = {
        channel: 'autodarts.matches',
        topic: `${MATCH_ID}.state`,
        data: state2,
      };

      const event = parser.parse(raw);
      const events = Array.isArray(event) ? event : [event];
      const changeEvent = events.find((e) => e?.type === 'player.change');

      expect(changeEvent).toBeDefined();
      expect(changeEvent!.data).toMatchObject({
        previousPlayer: 0,
        currentPlayer: 1,
        playerName: 'Player 2',
      });
    });

    it('should detect game finished', () => {
      const matchState = createMatchState({
        gameFinished: true,
        gameWinner: 0,
      });
      const raw: AutodartsMessage = {
        channel: 'autodarts.matches',
        topic: `${MATCH_ID}.state`,
        data: matchState,
      };

      const event = parser.parse(raw);
      const events = Array.isArray(event) ? event : [event];
      const finishedEvent = events.find((e) => e?.type === 'game.finished');

      expect(finishedEvent).toBeDefined();
      expect(finishedEvent!.data).toMatchObject({
        matchId: MATCH_ID,
        winner: 0,
        winnerName: 'Player 1',
      });
    });

    it('should detect match finished', () => {
      const matchState = createMatchState({
        finished: true,
        winner: 1,
      });
      const raw: AutodartsMessage = {
        channel: 'autodarts.matches',
        topic: `${MATCH_ID}.state`,
        data: matchState,
      };

      const event = parser.parse(raw);
      const events = Array.isArray(event) ? event : [event];
      const finishedEvent = events.find((e) => e?.type === 'match.finished');

      expect(finishedEvent).toBeDefined();
      expect(finishedEvent!.data).toMatchObject({
        matchId: MATCH_ID,
        winner: 1,
        winnerName: 'Player 2',
      });
      expect(parser.getMatchId()).toBeNull();
    });

    it('should NOT emit duplicate turn.finished on round change after bust (bug fix)', () => {
      // This test verifies the fix for the bug where bust was announced twice
      // when the last player busted and then the round changed.
      //
      // Scenario: 2 players, player 1 (index 1) busts, round changes to next round
      // Expected: Only ONE turn.finished event with busted=true

      // Initial state: player 0 finishes, player 1 is up
      const state1 = createMatchState({
        player: 1,
        round: 1,
        turnScore: 0,
        turnBusted: false,
        gameScores: [441, 501],
      });
      parser.parse({
        channel: 'autodarts.matches',
        topic: `${MATCH_ID}.state`,
        data: state1,
      });

      // Player 1 busts - turnBusted becomes true
      const state2 = createMatchState({
        player: 1,
        round: 1,
        turnScore: 0,
        turnBusted: true,
        gameScores: [441, 501], // Score unchanged due to bust
        turns: [{ playerId: 'player-2', throws: [{ segment: { name: 'T19', multiplier: 3, number: 19, bed: 'Triple' }, throw: 1 }] }],
      });
      const bustEvent = parser.parse({
        channel: 'autodarts.matches',
        topic: `${MATCH_ID}.state`,
        data: state2,
      });

      const bustEvents = Array.isArray(bustEvent) ? bustEvent : [bustEvent];
      const bustTurnFinished = bustEvents.filter((e) => e?.type === 'turn.finished');

      // Should have exactly ONE turn.finished event for the bust
      expect(bustTurnFinished.length).toBe(1);
      expect(bustTurnFinished[0]!.data.busted).toBe(true);

      // Now the round changes (takeout finished, player 0 is up again)
      const state3 = createMatchState({
        player: 0,
        round: 2, // Round changed!
        turnScore: 0,
        turnBusted: false, // New player, not busted
        gameScores: [441, 501],
      });
      const roundChangeEvent = parser.parse({
        channel: 'autodarts.matches',
        topic: `${MATCH_ID}.state`,
        data: state3,
      });

      const roundChangeEvents = Array.isArray(roundChangeEvent) ? roundChangeEvent : [roundChangeEvent];
      const roundChangeTurnFinished = roundChangeEvents.filter((e) => e?.type === 'turn.finished');

      // Should NOT have another turn.finished event - the bust was already announced!
      expect(roundChangeTurnFinished.length).toBe(0);
    });

    describe('Cricket reconnect gap (markGap)', () => {
      const cricketState = (segments: Record<string, number[]>, overrides: Partial<MatchStateData> = {}): MatchStateData =>
        createMatchState({ variant: 'Cricket', state: { segments }, player: 0, ...overrides });

      it('should not emit cricket.closed from the first state after a gap, even if fields are newly closed', () => {
        // Before the gap: field 20 has 2 marks for player 0 (not yet closed)
        parser.parse({
          channel: 'autodarts.matches',
          topic: `${MATCH_ID}.state`,
          data: cricketState({ '20': [2, 0] }),
        });

        // Connection gap (e.g. WebSocket reconnect) - the player may have closed
        // fields while disconnected, so the next state must not be diffed against
        // the pre-gap baseline.
        parser.markGap();

        // First state after the gap: field 20 AND 19 now show 3 marks (closed).
        // Some of that may have happened during the outage - must not be reported.
        const afterGap = parser.parse({
          channel: 'autodarts.matches',
          topic: `${MATCH_ID}.state`,
          data: cricketState({ '20': [3, 0], '19': [3, 0] }),
        });
        const afterGapEvents = Array.isArray(afterGap) ? afterGap : [afterGap];
        expect(afterGapEvents.filter((e) => e?.type === 'cricket.closed')).toHaveLength(0);

        // A later, real close (field 18) builds on the post-gap baseline and must
        // still be reported.
        const realClose = parser.parse({
          channel: 'autodarts.matches',
          topic: `${MATCH_ID}.state`,
          data: cricketState({ '20': [3, 0], '19': [3, 0], '18': [3, 0] }),
        });
        const realCloseEvents = Array.isArray(realClose) ? realClose : [realClose];
        const closedEvents = realCloseEvents.filter((e) => e?.type === 'cricket.closed');
        expect(closedEvents).toHaveLength(1);
        expect(closedEvents[0]!.data).toMatchObject({ field: '18', playerIndex: 0 });
      });
    });
  });

  describe('Unknown Events', () => {
    it('should return raw event for unknown messages', () => {
      const raw: AutodartsMessage = {
        channel: 'unknown.channel',
        topic: 'unknown.topic',
        data: { foo: 'bar' },
      };

      const event = parser.parse(raw);

      expect(event).not.toBeNull();
      if (!Array.isArray(event)) {
        expect(event!.type).toBe('raw');
      }
    });
  });
});

describe('Helper Functions', () => {
  describe('getLastThrow()', () => {
    it('should return null for empty turns', () => {
      const matchState = {
        turns: [],
      } as unknown as MatchStateData;

      expect(getLastThrow(matchState)).toBeNull();
    });

    it('should return last throw from last turn', () => {
      const matchState = {
        turns: [
          {
            playerId: 'player-1',
            throws: [
              { segment: { name: 'S20', multiplier: 1, number: 20, bed: 'SingleInner' }, throw: 1 },
              { segment: { name: 'T20', multiplier: 3, number: 20, bed: 'Triple' }, throw: 2 },
            ],
          },
        ],
      } as unknown as MatchStateData;

      const result = getLastThrow(matchState);

      expect(result).not.toBeNull();
      expect(result!.segment.name).toBe('T20');
      expect(result!.throwNumber).toBe(2);
    });
  });

  describe('calculateSegmentScore()', () => {
    it('should calculate single score', () => {
      const segment: ThrowSegment = { name: 'S20', multiplier: 1, number: 20, bed: 'SingleInner' };
      expect(calculateSegmentScore(segment)).toBe(20);
    });

    it('should calculate double score', () => {
      const segment: ThrowSegment = { name: 'D20', multiplier: 2, number: 20, bed: 'Double' };
      expect(calculateSegmentScore(segment)).toBe(40);
    });

    it('should calculate triple score', () => {
      const segment: ThrowSegment = { name: 'T20', multiplier: 3, number: 20, bed: 'Triple' };
      expect(calculateSegmentScore(segment)).toBe(60);
    });

    it('should return 0 for miss', () => {
      const segment: ThrowSegment = { name: 'Miss', multiplier: 0, number: 0, bed: 'Outside' };
      expect(calculateSegmentScore(segment)).toBe(0);
    });
  });

  describe('isHighValueSegment()', () => {
    it('should return true for T20', () => {
      const segment: ThrowSegment = { name: 'T20', multiplier: 3, number: 20, bed: 'Triple' };
      expect(isHighValueSegment(segment)).toBe(true);
    });

    it('should return true for D20', () => {
      const segment: ThrowSegment = { name: 'D20', multiplier: 2, number: 20, bed: 'Double' };
      expect(isHighValueSegment(segment)).toBe(true);
    });

    it('should return true for Bull', () => {
      const segment: ThrowSegment = { name: 'Bull', multiplier: 1, number: 25, bed: 'Bull' };
      expect(isHighValueSegment(segment)).toBe(true);
    });

    it('should return true for Double Bull', () => {
      const segment: ThrowSegment = { name: 'DBull', multiplier: 2, number: 25, bed: 'DoubleBull' };
      expect(isHighValueSegment(segment)).toBe(true);
    });

    it('should return false for regular segments', () => {
      const segment: ThrowSegment = { name: 'S19', multiplier: 1, number: 19, bed: 'SingleInner' };
      expect(isHighValueSegment(segment)).toBe(false);
    });
  });

  describe('isMiss()', () => {
    it('should return true for multiplier 0', () => {
      const segment: ThrowSegment = { name: 'Miss', multiplier: 0, number: 0, bed: 'Outside' };
      expect(isMiss(segment)).toBe(true);
    });

    it('should return true for Outside bed', () => {
      const segment: ThrowSegment = { name: 'Miss', multiplier: 0, number: 0, bed: 'Outside' };
      expect(isMiss(segment)).toBe(true);
    });

    it('should return false for valid hit', () => {
      const segment: ThrowSegment = { name: 'S20', multiplier: 1, number: 20, bed: 'SingleInner' };
      expect(isMiss(segment)).toBe(false);
    });
  });
});
