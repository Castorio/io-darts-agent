import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameDisplayHandler } from '../../../modules/game-display/src/index.js';
import type { ParsedEvent } from '../../../src/types/index.js';

function event(type: string, data: Record<string, unknown> = {}): ParsedEvent {
  return { type, timestamp: new Date(), raw: {} as never, data } as unknown as ParsedEvent;
}

describe('GameDisplayHandler (hub side, statistics only)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('counts events and matches without deciding animations', async () => {
    const handler = new GameDisplayHandler({ animations: { enabled: true } } as never);
    await handler.handleEvent(event('match.start'));
    await handler.handleEvent(event('throw.detected', { segment: { number: 20, multiplier: 3 }, turnPoints: 180 }));
    await handler.handleEvent(event('match.finished'));
    expect(handler.getStats()).toEqual({
      eventsProcessed: 3,
      matchesStarted: 1,
      matchesFinished: 1,
      checkouts: 0,
    });
  });
});
