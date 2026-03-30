/**
 * EventMapper Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventMapper } from './EventMapper.js';
import { DEFAULT_CALLER_CONFIG } from './types.js';
import type { ParsedEvent } from '@autodarts-hub/module-sdk';

describe('EventMapper', () => {
  let mapper: EventMapper;

  beforeEach(() => {
    mapper = new EventMapper(DEFAULT_CALLER_CONFIG);
  });

  describe('match events', () => {
    it('should map match.start to game on call', () => {
      const event: ParsedEvent = {
        type: 'match.start',
        data: {},
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(event);

      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('game');
      expect(calls[0].text).toBe('game on');
      expect(calls[0].audioFile).toBe('game_on');
    });

    it('should map match.finished to match shot call', () => {
      const event: ParsedEvent = {
        type: 'match.finished',
        data: { winner: { name: 'John' } },
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(event);

      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('game');
      expect(calls[0].text).toBe('game shot and the match, John');
    });
  });

  describe('turn.finished events', () => {
    it('should map 180 score to special call', () => {
      const event: ParsedEvent = {
        type: 'turn.finished',
        data: { turnPoints: 180, remaining: 321 },
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(event);

      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('special');
      expect(calls[0].text).toBe('one hundred and eighty!');
      expect(calls[0].audioFile).toBe('180');
    });

    it('should map regular score to score call', () => {
      const event: ParsedEvent = {
        type: 'turn.finished',
        data: { turnPoints: 60, remaining: 301 },
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(event);

      expect(calls.length).toBeGreaterThanOrEqual(1);
      expect(calls[0].type).toBe('score');
      expect(calls[0].text).toBe('sixty');
    });

    it('should add checkout call when remaining is checkable', () => {
      const event: ParsedEvent = {
        type: 'turn.finished',
        data: { turnPoints: 100, remaining: 100 },
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(event);

      expect(calls.length).toBe(2);
      expect(calls[1].type).toBe('checkout');
      expect(calls[1].text).toContain('you require one hundred');
    });

    it('should not call score when busted', () => {
      const event: ParsedEvent = {
        type: 'turn.finished',
        data: { turnPoints: 60, remaining: 301, busted: true },
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(event);

      expect(calls).toHaveLength(0);
    });
  });

  describe('throw.detected events', () => {
    it('should map bust to bust call', () => {
      const event: ParsedEvent = {
        type: 'throw.detected',
        data: { busted: true },
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(event);

      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('special');
      expect(calls[0].text).toBe('bust');
      expect(calls[0].audioFile).toBe('bust');
    });
  });

  describe('player.change events', () => {
    it('should map player change to player call', () => {
      const event: ParsedEvent = {
        type: 'player.change',
        data: { playerName: 'Mike', remaining: 301 },
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(event);

      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('player');
      expect(calls[0].text).toBe('Mike');
    });

    it('should include remaining when checkout possible', () => {
      const event: ParsedEvent = {
        type: 'player.change',
        data: { playerName: 'Mike', remaining: 100 },
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(event);

      expect(calls).toHaveLength(1);
      expect(calls[0].text).toContain('you require one hundred');
    });
  });

  describe('disabled states', () => {
    it('should return empty when caller is disabled', () => {
      mapper.updateConfig({ ...DEFAULT_CALLER_CONFIG, enabled: false });

      const event: ParsedEvent = {
        type: 'match.start',
        data: {},
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(event);

      expect(calls).toHaveLength(0);
    });

    it('should not call scores when scores disabled', () => {
      mapper.updateConfig({
        ...DEFAULT_CALLER_CONFIG,
        scores: { ...DEFAULT_CALLER_CONFIG.scores, enabled: false },
      });

      const event: ParsedEvent = {
        type: 'turn.finished',
        data: { turnPoints: 60, remaining: 301 },
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(event);

      expect(calls).toHaveLength(0);
    });

    it('should only call high scores when highScoresOnly is true', () => {
      mapper.updateConfig({
        ...DEFAULT_CALLER_CONFIG,
        scores: { ...DEFAULT_CALLER_CONFIG.scores, highScoresOnly: true },
      });

      // Low score
      const lowEvent: ParsedEvent = {
        type: 'turn.finished',
        data: { turnPoints: 60, remaining: 301 },
        timestamp: Date.now(),
        raw: {},
      };

      expect(mapper.mapEvent(lowEvent)).toHaveLength(0);

      // High score
      const highEvent: ParsedEvent = {
        type: 'turn.finished',
        data: { turnPoints: 140, remaining: 161 },
        timestamp: Date.now(),
        raw: {},
      };

      const calls = mapper.mapEvent(highEvent);
      expect(calls.length).toBeGreaterThanOrEqual(1);
      expect(calls[0].type).toBe('score');
    });
  });
});
