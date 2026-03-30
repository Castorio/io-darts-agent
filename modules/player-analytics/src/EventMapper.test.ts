/**
 * EventMapper Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventMapper } from './EventMapper.js';
import type { ParsedEvent } from '@autodarts-hub/module-sdk';
import { PlayerAnalyticsConfig } from './types.js';

const defaultConfig: PlayerAnalyticsConfig = {
  dataRetentionDays: 90,
  aiProvider: 'none',
  trackAllPlayers: true,
  generateTipsAfterMatch: false,
  minMatchesForTips: 5,
};

describe('EventMapper', () => {
  let mapper: EventMapper;

  beforeEach(() => {
    mapper = new EventMapper(defaultConfig);
  });

  describe('mapEvent', () => {
    it('should handle match.start event', () => {
      const event: ParsedEvent = {
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {
          id: 'match-123',
          variant: 'X01',
          players: [
            { name: 'Player 1', id: 'p1' },
            { name: 'Player 2', id: 'p2' },
          ],
          settings: {
            baseScore: 501,
          },
        },
      };

      const action = mapper.mapEvent(event);

      expect(action).not.toBeNull();
      expect(action!.type).toBe('match.start');
      expect(action!.matchId).toBe('match-123');

      const data = action!.data as {
        autodartsMatchId: string;
        gameType: string;
        startingScore: number;
        players: Array<{ name: string }>;
      };
      expect(data.gameType).toBe('X01');
      expect(data.startingScore).toBe(501);
      expect(data.players).toHaveLength(2);
    });

    it('should track match state after match.start', () => {
      const event: ParsedEvent = {
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {
          id: 'match-456',
          variant: 'X01',
          players: [{ name: 'Solo Player' }],
          settings: { baseScore: 301 },
        },
      };

      mapper.mapEvent(event);
      const state = mapper.getCurrentMatch();

      expect(state).not.toBeNull();
      expect(state!.autodartsMatchId).toBe('match-456');
      expect(state!.startingScore).toBe(301);
      expect(state!.players).toHaveLength(1);
      expect(state!.currentTurnIndex).toBe(0);
    });

    it('should handle throw.detected event', () => {
      // First start a match
      mapper.mapEvent({
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {
          id: 'match-789',
          variant: 'X01',
          players: [{ name: 'Player 1' }],
          settings: { baseScore: 501 },
        },
      });

      const throwEvent: ParsedEvent = {
        type: 'throw.detected',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {
          matchId: 'match-789',
          playerIndex: 0,
          playerName: 'Player 1',
          segment: { number: 20, bed: 'triple' },
          score: 60,
          multiplier: 3,
          remaining: 441,
          turnScore: 60,
          turnThrows: 1,
        },
      };

      const action = mapper.mapEvent(throwEvent);

      expect(action).not.toBeNull();
      expect(action!.type).toBe('throw.record');

      const data = action!.data as {
        throwData: { score: number; segment: { bed: string } };
      };
      expect(data.throwData.score).toBe(60);
      expect(data.throwData.segment.bed).toBe('triple');
    });

    it('should handle turn.finished event', () => {
      // Start match and throw some darts
      mapper.mapEvent({
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {
          id: 'match-turn',
          variant: 'X01',
          players: [{ name: 'Player 1' }, { name: 'Player 2' }],
          settings: { baseScore: 501 },
        },
      });

      // Simulate 3 throws
      for (let i = 1; i <= 3; i++) {
        mapper.mapEvent({
          type: 'throw.detected',
          timestamp: new Date(),
          raw: { channel: 'test', topic: 'test', data: {} },
          data: {
            matchId: 'match-turn',
            playerIndex: 0,
            segment: { number: 20, bed: 'triple' },
            score: 60,
            multiplier: 3,
            remaining: 501 - 60 * i,
            turnScore: 60 * i,
            turnThrows: i,
          },
        });
      }

      const turnEndEvent: ParsedEvent = {
        type: 'turn.finished',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {
          matchId: 'match-turn',
          playerIndex: 0,
          playerName: 'Player 1',
          turnScore: 180,
          remaining: 321,
          isBust: false,
          dartsThrown: 3,
        },
      };

      const action = mapper.mapEvent(turnEndEvent);

      expect(action).not.toBeNull();
      expect(action!.type).toBe('turn.end');

      const data = action!.data as {
        turnData: { totalScore: number; throws: unknown[] };
      };
      expect(data.turnData.totalScore).toBe(180);
      expect(data.turnData.throws).toHaveLength(3);
    });

    it('should handle match.delete event', () => {
      mapper.mapEvent({
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {
          id: 'match-delete',
          variant: 'X01',
          players: [{ name: 'Player 1' }],
        },
      });

      const action = mapper.mapEvent({
        type: 'match.delete',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: { matchId: 'match-delete' },
      });

      expect(action).not.toBeNull();
      expect(action!.type).toBe('match.abort');
      expect(mapper.getCurrentMatch()).toBeNull();
    });

    it('should return null for events without active match', () => {
      const action = mapper.mapEvent({
        type: 'throw.detected',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {
          matchId: 'non-existent',
          playerIndex: 0,
          segment: { number: 20, bed: 'single' },
          score: 20,
          multiplier: 1,
          remaining: 481,
          turnScore: 20,
          turnThrows: 1,
        },
      });

      expect(action).toBeNull();
    });

    it('should return null for unsupported event types', () => {
      const action = mapper.mapEvent({
        type: 'board.state',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {},
      });

      expect(action).toBeNull();
    });
  });

  describe('segment parsing', () => {
    beforeEach(() => {
      mapper.mapEvent({
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {
          id: 'match-segment',
          variant: 'X01',
          players: [{ name: 'Player' }],
        },
      });
    });

    const testCases = [
      { bed: 'single', expected: 'single' },
      { bed: 'd', expected: 'double' },
      { bed: 'double', expected: 'double' },
      { bed: 't', expected: 'triple' },
      { bed: 'triple', expected: 'triple' },
      { bed: 'ob', expected: 'outer-bull' },
      { bed: 'outer-bull', expected: 'outer-bull' },
      { bed: 'ib', expected: 'inner-bull' },
      { bed: 'bull', expected: 'inner-bull' },
      { bed: 'm', expected: 'miss' },
      { bed: 'miss', expected: 'miss' },
    ];

    testCases.forEach(({ bed, expected }) => {
      it(`should parse '${bed}' as '${expected}'`, () => {
        const action = mapper.mapEvent({
          type: 'throw.detected',
          timestamp: new Date(),
          raw: { channel: 'test', topic: 'test', data: {} },
          data: {
            matchId: 'match-segment',
            playerIndex: 0,
            segment: { number: 20, bed },
            score: 20,
            multiplier: 1,
            remaining: 481,
            turnScore: 20,
            turnThrows: 1,
          },
        });

        const data = action!.data as {
          throwData: { segment: { bed: string } };
        };
        expect(data.throwData.segment.bed).toBe(expected);
      });
    });
  });
});
