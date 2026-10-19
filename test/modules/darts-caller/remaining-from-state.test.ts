import { describe, it, expect } from 'vitest';
import { createDartsCallerHandler, type CallRequest } from '../../../modules/darts-caller/src/index.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('darts caller remaining score from the match state', () => {
  it('reads the remaining score from gameScores, not from the legs/sets scores', async () => {
    const handler = createDartsCallerHandler({ delayMs: 0, callerType: 'tts' });
    const calls: CallRequest[] = [];
    handler.onCallRequest((r) => calls.push(r));

    await handler.handleEvent({
      type: 'match.state', timestamp: Date.now(),
      data: {
        player: 0,
        players: [{ name: 'Anna', index: 0 }, { name: 'Ben', index: 1 }],
        gameScores: [301, 40],
        scores: [{ legs: 1, sets: 0 }, { legs: 0, sets: 0 }],
        game: { variant: 'X01', mode: 'x01', cutThroat: false },
      },
    } as never);
    // player change without a remaining value: the handler falls back to the stored state
    await handler.handleEvent({
      type: 'player.change', timestamp: Date.now(),
      data: { playerName: 'Ben', playerIndex: 1, currentPlayer: 1, game: { variant: 'X01', mode: 'x01', cutThroat: false } },
    } as never);
    await flush();

    expect(calls.map((c) => c.text).join(' | ')).toMatch(/require 40/i);
  });
});
