import { describe, it, expect, beforeEach } from 'vitest';
import { EventMapper, WledActionExecutor } from './EventMapper.js';
import { DEFAULT_EVENT_ACTIONS, DEFAULT_PLAYER_COLORS, type EventAction, type WledModuleConfig } from './types.js';
import type { ParsedEvent } from '@autodarts-hub/module-sdk';

// Helper to create mock events
function createEvent<T>(type: string, data: T): ParsedEvent<T> {
  return {
    type: type as ParsedEvent['type'],
    timestamp: new Date(),
    raw: { channel: 'test', topic: 'test', data },
    data,
  };
}

describe('EventMapper', () => {
  let mapper: EventMapper;

  beforeEach(() => {
    mapper = new EventMapper();
  });

  describe('constructor', () => {
    it('should use default event actions', () => {
      const eventActions = mapper.getEventActions();
      expect(eventActions.matchStart.actionType).toBe('preset');
      expect(eventActions.throwHit.actionType).toBe('solid');
    });

    it('should use default player colors', () => {
      const colors = mapper.getPlayerColors();
      expect(colors).toHaveLength(6);
      expect(colors[0]).toEqual({ r: 0, g: 0, b: 255 }); // Blue
    });

    it('should accept custom config', () => {
      const customMapper = new EventMapper({
        eventActions: {
          ...DEFAULT_EVENT_ACTIONS,
          matchStart: { ...DEFAULT_EVENT_ACTIONS.matchStart, enabled: false },
        },
      });
      const eventActions = customMapper.getEventActions();
      expect(eventActions.matchStart.enabled).toBe(false);
    });
  });

  describe('updateConfig()', () => {
    it('should update event actions', () => {
      mapper.updateConfig({
        eventActions: {
          ...DEFAULT_EVENT_ACTIONS,
          throwHit: { ...DEFAULT_EVENT_ACTIONS.throwHit, color: { r: 255, g: 255, b: 0 } },
        },
      });
      const eventActions = mapper.getEventActions();
      expect(eventActions.throwHit.color).toEqual({ r: 255, g: 255, b: 0 });
    });

    it('should update player colors', () => {
      mapper.updateConfig({
        playerColors: [{ r: 100, g: 100, b: 100 }],
      });
      expect(mapper.getPlayerColors()).toEqual([{ r: 100, g: 100, b: 100 }]);
    });
  });

  describe('mapEvent() - match.start', () => {
    it('should return preset action on match start', () => {
      const event = createEvent('match.start', { matchId: '123' });
      const actions = mapper.mapEvent(event);

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('preset');
      expect(actions[0].preset).toBe(DEFAULT_EVENT_ACTIONS.matchStart.presetId);
    });

    it('should set inMatch flag', () => {
      const event = createEvent('match.start', { matchId: '123' });
      mapper.mapEvent(event);
      expect(mapper.isInMatch()).toBe(true);
    });

    it('should not return action when disabled', () => {
      mapper.updateConfig({
        eventActions: {
          ...DEFAULT_EVENT_ACTIONS,
          matchStart: { ...DEFAULT_EVENT_ACTIONS.matchStart, enabled: false },
        },
      });
      const event = createEvent('match.start', { matchId: '123' });
      const actions = mapper.mapEvent(event);
      expect(actions).toHaveLength(0);
    });
  });

  describe('mapEvent() - match.finished', () => {
    it('should return effect action on match finished', () => {
      mapper.mapEvent(createEvent('match.start', { matchId: '123' }));
      const event = createEvent('match.finished', { matchId: '123' });
      const actions = mapper.mapEvent(event);

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('effect');
      expect(actions[0].effect).toBe(DEFAULT_EVENT_ACTIONS.matchFinished.effectId);
    });

    it('should clear inMatch flag', () => {
      mapper.mapEvent(createEvent('match.start', { matchId: '123' }));
      mapper.mapEvent(createEvent('match.finished', { matchId: '123' }));
      expect(mapper.isInMatch()).toBe(false);
    });
  });

  describe('mapEvent() - throw.detected', () => {
    it('should use throwHit action on normal hit', () => {
      const event = createEvent('throw.detected', {
        segment: { bed: 'Single', multiplier: 1, name: 'S20', number: 20 },
        throwNumber: 1,
        boardId: 'board1',
      });

      const actions = mapper.mapEvent(event);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('solid');
      expect(actions[0].color).toEqual(DEFAULT_EVENT_ACTIONS.throwHit.color);
    });

    it('should use throwMiss action on miss', () => {
      const event = createEvent('throw.detected', {
        segment: { bed: 'Outside', multiplier: 0, name: 'Outside', number: 0 },
        throwNumber: 1,
        boardId: 'board1',
      });

      const actions = mapper.mapEvent(event);
      expect(actions).toHaveLength(1);
      expect(actions[0].color).toEqual(DEFAULT_EVENT_ACTIONS.throwMiss.color);
    });

    it('should use throwHighlight action on T20', () => {
      const event = createEvent('throw.detected', {
        segment: { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 },
        throwNumber: 1,
        boardId: 'board1',
      });

      const actions = mapper.mapEvent(event);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('effect');
      expect(actions[0].effect).toBe(DEFAULT_EVENT_ACTIONS.throwHighlight.effectId);
    });

    it('should use throwHighlight action on Bull', () => {
      const event = createEvent('throw.detected', {
        segment: { bed: 'Bull', multiplier: 1, name: 'Bull', number: 25 },
        throwNumber: 1,
        boardId: 'board1',
      });

      const actions = mapper.mapEvent(event);
      expect(actions[0].type).toBe('effect');
    });

    it('should use throwHighlight action on Double Bull', () => {
      const event = createEvent('throw.detected', {
        segment: { bed: 'DoubleBull', multiplier: 2, name: 'D Bull', number: 25 },
        throwNumber: 1,
        boardId: 'board1',
      });

      const actions = mapper.mapEvent(event);
      expect(actions[0].type).toBe('effect');
    });
  });

  describe('mapEvent() - player.change', () => {
    it('should return playerColor action', () => {
      const event = createEvent('player.change', {
        previousPlayer: 0,
        currentPlayer: 1,
        playerName: 'Player 2',
      });

      const actions = mapper.mapEvent(event);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('playerColor');
      expect(actions[0].playerIndex).toBe(1);
    });

    it('should update current player', () => {
      mapper.mapEvent(createEvent('player.change', { currentPlayer: 2 }));
      expect(mapper.getCurrentPlayer()).toBe(2);
    });
  });

  describe('mapEvent() - turn.finished', () => {
    it('should trigger 180 action', () => {
      // Simulate 3 T20 throws
      mapper.mapEvent(createEvent('throw.detected', {
        segment: { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 },
        throwNumber: 1,
        boardId: 'board1',
      }));
      mapper.mapEvent(createEvent('throw.detected', {
        segment: { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 },
        throwNumber: 2,
        boardId: 'board1',
      }));
      mapper.mapEvent(createEvent('throw.detected', {
        segment: { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 },
        throwNumber: 3,
        boardId: 'board1',
      }));

      const actions = mapper.mapEvent(createEvent('turn.finished', {}));
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('effect');
      expect(actions[0].effect).toBe(DEFAULT_EVENT_ACTIONS.throw180.effectId);
    });

    it('should not trigger 180 for less than 180 score', () => {
      mapper.mapEvent(createEvent('throw.detected', {
        segment: { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 },
        throwNumber: 1,
        boardId: 'board1',
      }));
      mapper.mapEvent(createEvent('throw.detected', {
        segment: { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 },
        throwNumber: 2,
        boardId: 'board1',
      }));
      mapper.mapEvent(createEvent('throw.detected', {
        segment: { bed: 'Triple', multiplier: 3, name: 'T19', number: 19 },
        throwNumber: 3,
        boardId: 'board1',
      }));

      const actions = mapper.mapEvent(createEvent('turn.finished', {}));
      expect(actions).toHaveLength(0);
    });
  });

  describe('mapEvent() - takeout.started', () => {
    it('should return brightness action', () => {
      const event = createEvent('takeout.started', {});
      const actions = mapper.mapEvent(event);

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('brightness');
      expect(actions[0].brightness).toBe(DEFAULT_EVENT_ACTIONS.takeoutStarted.brightness);
    });
  });

  describe('mapEvent() - takeout.finished', () => {
    it('should restore brightness', () => {
      const event = createEvent('takeout.finished', {});
      const actions = mapper.mapEvent(event);

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('brightness');
      expect(actions[0].brightness).toBe(DEFAULT_EVENT_ACTIONS.takeoutFinished.brightness);
    });
  });

  describe('mapEvent() - game.finished', () => {
    it('should return game finished action', () => {
      const event = createEvent('game.finished', { winner: 0 });
      const actions = mapper.mapEvent(event);

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('effect');
      expect(actions[0].effect).toBe(DEFAULT_EVENT_ACTIONS.gameFinished.effectId);
    });
  });

  describe('getPlayerColor()', () => {
    it('should return correct player color', () => {
      const color = mapper.getPlayerColor(0);
      expect(color).toEqual(DEFAULT_PLAYER_COLORS[0]);
    });

    it('should wrap around for large player index', () => {
      const color = mapper.getPlayerColor(6);
      expect(color).toEqual(DEFAULT_PLAYER_COLORS[0]);
    });
  });

  describe('state management', () => {
    it('should track match state', () => {
      expect(mapper.isInMatch()).toBe(false);
      mapper.mapEvent(createEvent('match.start', { matchId: '123' }));
      expect(mapper.isInMatch()).toBe(true);
      mapper.mapEvent(createEvent('match.delete', { matchId: '123' }));
      expect(mapper.isInMatch()).toBe(false);
    });

    it('should track current player', () => {
      expect(mapper.getCurrentPlayer()).toBe(0);
      mapper.mapEvent(createEvent('player.change', { currentPlayer: 2 }));
      expect(mapper.getCurrentPlayer()).toBe(2);
    });
  });
});

describe('DEFAULT_EVENT_ACTIONS', () => {
  it('should have all required event actions', () => {
    expect(DEFAULT_EVENT_ACTIONS.matchStart).toBeDefined();
    expect(DEFAULT_EVENT_ACTIONS.matchFinished).toBeDefined();
    expect(DEFAULT_EVENT_ACTIONS.gameFinished).toBeDefined();
    expect(DEFAULT_EVENT_ACTIONS.throwHit).toBeDefined();
    expect(DEFAULT_EVENT_ACTIONS.throwMiss).toBeDefined();
    expect(DEFAULT_EVENT_ACTIONS.throwHighlight).toBeDefined();
    expect(DEFAULT_EVENT_ACTIONS.throw180).toBeDefined();
    expect(DEFAULT_EVENT_ACTIONS.throwBust).toBeDefined();
    expect(DEFAULT_EVENT_ACTIONS.playerChange).toBeDefined();
    expect(DEFAULT_EVENT_ACTIONS.takeoutStarted).toBeDefined();
    expect(DEFAULT_EVENT_ACTIONS.takeoutFinished).toBeDefined();
  });

  it('should have correct action types', () => {
    expect(DEFAULT_EVENT_ACTIONS.matchStart.actionType).toBe('preset');
    expect(DEFAULT_EVENT_ACTIONS.throwHit.actionType).toBe('solid');
    expect(DEFAULT_EVENT_ACTIONS.throwHighlight.actionType).toBe('effect');
    expect(DEFAULT_EVENT_ACTIONS.playerChange.actionType).toBe('playerColor');
    expect(DEFAULT_EVENT_ACTIONS.takeoutStarted.actionType).toBe('brightness');
  });
});

describe('DEFAULT_PLAYER_COLORS', () => {
  it('should have 6 default colors', () => {
    expect(DEFAULT_PLAYER_COLORS).toHaveLength(6);
  });

  it('should have valid RGB values', () => {
    for (const color of DEFAULT_PLAYER_COLORS) {
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(255);
      expect(color.g).toBeGreaterThanOrEqual(0);
      expect(color.g).toBeLessThanOrEqual(255);
      expect(color.b).toBeGreaterThanOrEqual(0);
      expect(color.b).toBeLessThanOrEqual(255);
    }
  });
});
