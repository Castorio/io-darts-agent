import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, getEventBus, resetEventBus } from './EventBus.js';
import type { ParsedEvent, AutodartsEventType } from '../../types/index.js';

function createMockEvent<T>(type: AutodartsEventType, data: T): ParsedEvent<T> {
  return {
    type,
    timestamp: new Date(),
    raw: { channel: 'test', topic: 'test', data },
    data,
  };
}

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    resetEventBus();
  });

  describe('on()', () => {
    it('should subscribe to events', async () => {
      const handler = vi.fn();
      eventBus.on('throw.detected', handler);

      const event = createMockEvent('throw.detected', { segment: 'T20' });
      await eventBus.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should return subscription with unsubscribe', async () => {
      const handler = vi.fn();
      const subscription = eventBus.on('throw.detected', handler);

      subscription.unsubscribe();

      const event = createMockEvent('throw.detected', { segment: 'T20' });
      await eventBus.emit(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow multiple handlers for same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('throw.detected', handler1);
      eventBus.on('throw.detected', handler2);

      const event = createMockEvent('throw.detected', { segment: 'T20' });
      await eventBus.emit(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should support wildcard subscriptions', async () => {
      const handler = vi.fn();
      eventBus.on('*', handler);

      const event1 = createMockEvent('throw.detected', { segment: 'T20' });
      const event2 = createMockEvent('match.start', { matchId: '123' });

      await eventBus.emit(event1);
      await eventBus.emit(event2);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(event1);
      expect(handler).toHaveBeenCalledWith(event2);
    });
  });

  describe('once()', () => {
    it('should only trigger once', async () => {
      const handler = vi.fn();
      eventBus.once('throw.detected', handler);

      const event1 = createMockEvent('throw.detected', { segment: 'T20' });
      const event2 = createMockEvent('throw.detected', { segment: 'D20' });

      await eventBus.emit(event1);
      await eventBus.emit(event2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event1);
    });
  });

  describe('emit()', () => {
    it('should handle async handlers', async () => {
      const order: number[] = [];
      const handler1 = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push(1);
      });
      const handler2 = vi.fn(() => {
        order.push(2);
      });

      eventBus.on('throw.detected', handler1);
      eventBus.on('throw.detected', handler2);

      const event = createMockEvent('throw.detected', { segment: 'T20' });
      await eventBus.emit(event);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(order).toContain(1);
      expect(order).toContain(2);
    });

    it('should catch handler errors and continue', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Test error');
      });
      const successHandler = vi.fn();

      eventBus.on('throw.detected', errorHandler);
      eventBus.on('throw.detected', successHandler);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const event = createMockEvent('throw.detected', { segment: 'T20' });
      await eventBus.emit(event);

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle async handler errors', async () => {
      const errorHandler = vi.fn(async () => {
        throw new Error('Async test error');
      });
      const successHandler = vi.fn();

      eventBus.on('throw.detected', errorHandler);
      eventBus.on('throw.detected', successHandler);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const event = createMockEvent('throw.detected', { segment: 'T20' });
      await eventBus.emit(event);

      expect(successHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('off()', () => {
    it('should remove all handlers for event type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('throw.detected', handler1);
      eventBus.on('throw.detected', handler2);

      eventBus.off('throw.detected');

      const event = createMockEvent('throw.detected', { segment: 'T20' });
      await eventBus.emit(event);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    it('should remove all handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('throw.detected', handler1);
      eventBus.on('match.start', handler2);

      eventBus.clear();

      await eventBus.emit(createMockEvent('throw.detected', {}));
      await eventBus.emit(createMockEvent('match.start', {}));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount()', () => {
    it('should return count for specific event', () => {
      eventBus.on('throw.detected', vi.fn());
      eventBus.on('throw.detected', vi.fn());
      eventBus.on('match.start', vi.fn());

      expect(eventBus.listenerCount('throw.detected')).toBe(2);
      expect(eventBus.listenerCount('match.start')).toBe(1);
      expect(eventBus.listenerCount('match.delete')).toBe(0);
    });

    it('should return total count when no event specified', () => {
      eventBus.on('throw.detected', vi.fn());
      eventBus.on('throw.detected', vi.fn());
      eventBus.on('match.start', vi.fn());

      expect(eventBus.listenerCount()).toBe(3);
    });
  });

  describe('eventTypes()', () => {
    it('should return all registered event types', () => {
      eventBus.on('throw.detected', vi.fn());
      eventBus.on('match.start', vi.fn());
      eventBus.on('*', vi.fn());

      const types = eventBus.eventTypes();
      expect(types).toContain('throw.detected');
      expect(types).toContain('match.start');
      expect(types).toContain('*');
    });
  });

  describe('getEventBus()', () => {
    it('should return singleton instance', () => {
      const bus1 = getEventBus();
      const bus2 = getEventBus();

      expect(bus1).toBe(bus2);
    });

    it('should create new instance after reset', () => {
      const bus1 = getEventBus();
      resetEventBus();
      const bus2 = getEventBus();

      expect(bus1).not.toBe(bus2);
    });
  });
});
